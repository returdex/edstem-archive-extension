import { sanitizeErrorMessage } from "../edstem/errors";
import {
  ArchivedCourse,
  ArchivedPost,
  ArchivedThread,
  CourseCheckpoint,
  ExportRunSummary,
  ExportSnapshot,
  SyncEvent,
  SyncRun,
  SyncSnapshot,
  ThreadArchiveBundle,
  postStorageKey,
  threadStorageKey,
} from "./types";

const DB_NAME = "edstem-archive-sync";
const DB_VERSION = 2;

type StoreName =
  | "courses"
  | "threads"
  | "posts"
  | "checkpoints"
  | "syncRuns"
  | "syncEvents"
  | "exportRuns";

export interface SyncRepository {
  putCourse(course: ArchivedCourse): Promise<void>;
  getCourse(courseId: string): Promise<ArchivedCourse | undefined>;
  getCourseCheckpoint(courseId: string): Promise<CourseCheckpoint | undefined>;
  persistThreadWithCheckpoint(bundle: ThreadArchiveBundle): Promise<void>;
  listThreads(courseId: string): Promise<ArchivedThread[]>;
  listPosts(courseId: string, threadId: string): Promise<ArchivedPost[]>;
  upsertSyncRun(run: SyncRun): Promise<void>;
  getSyncRun(runId: string): Promise<SyncRun | undefined>;
  requestCancel(runId: string, requestedAt: string): Promise<SyncRun | undefined>;
  appendSyncEvent(event: SyncEvent): Promise<void>;
  listSyncEvents(runId?: string): Promise<SyncEvent[]>;
  getSyncSnapshot(): Promise<SyncSnapshot>;
  putExportRun(run: ExportRunSummary): Promise<void>;
  getExportSnapshot(): Promise<ExportSnapshot>;
  close(): void;
}

export interface OpenSyncDbOptions {
  indexedDb?: IDBFactory;
  namespace?: string;
}

export async function openSyncDb(options: OpenSyncDbOptions = {}): Promise<SyncRepository> {
  const factory = options.indexedDb ?? globalThis.indexedDB;
  if (factory) {
    return openIndexedDbRepository(factory);
  }

  return openMemoryRepository(options.namespace ?? "default");
}

function openIndexedDbRepository(factory: IDBFactory): Promise<SyncRepository> {
  return new Promise((resolve, reject) => {
    const request = factory.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("courses")) {
        db.createObjectStore("courses", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("threads")) {
        const threads = db.createObjectStore("threads", { keyPath: "storageKey" });
        ensureIndex(threads, "courseId", "courseId");
      }
      if (!db.objectStoreNames.contains("posts")) {
        const posts = db.createObjectStore("posts", { keyPath: "storageKey" });
        ensureIndex(posts, "threadKey", "threadKey");
        ensureIndex(posts, "courseId", "courseId");
      }
      if (!db.objectStoreNames.contains("checkpoints")) {
        db.createObjectStore("checkpoints", { keyPath: "courseId" });
      }
      if (!db.objectStoreNames.contains("syncRuns")) {
        const syncRuns = db.createObjectStore("syncRuns", { keyPath: "runId" });
        ensureIndex(syncRuns, "status", "status");
        ensureIndex(syncRuns, "nextAttemptAt", "nextAttemptAt");
      }
      if (!db.objectStoreNames.contains("syncEvents")) {
        const syncEvents = db.createObjectStore("syncEvents", { keyPath: "eventId" });
        ensureIndex(syncEvents, "runId", "runId");
      }
      if (!db.objectStoreNames.contains("exportRuns")) {
        const exportRuns = db.createObjectStore("exportRuns", { keyPath: "runId" });
        ensureIndex(exportRuns, "updatedAt", "updatedAt");
      }
    };

    request.onerror = () => reject(new Error(sanitizeErrorMessage(request.error?.message)));
    request.onsuccess = () => resolve(new IndexedDbSyncRepository(request.result));
  });
}

function ensureIndex(store: IDBObjectStore, name: string, keyPath: string): void {
  if (!store.indexNames.contains(name)) {
    store.createIndex(name, keyPath);
  }
}

class IndexedDbSyncRepository implements SyncRepository {
  constructor(private readonly db: IDBDatabase) {}

  async putCourse(course: ArchivedCourse): Promise<void> {
    await putOne(this.db, "courses", course);
  }

  async getCourse(courseId: string): Promise<ArchivedCourse | undefined> {
    return getOne(this.db, "courses", courseId);
  }

  async getCourseCheckpoint(courseId: string): Promise<CourseCheckpoint | undefined> {
    return getOne(this.db, "checkpoints", courseId);
  }

  async persistThreadWithCheckpoint(bundle: ThreadArchiveBundle): Promise<void> {
    const threadKey = threadStorageKey(bundle.thread.courseId, bundle.thread.threadId);
    const existingPosts = await getAllFromIndex<ArchivedPost & { storageKey: string; threadKey: string }>(
      this.db,
      "posts",
      "threadKey",
      threadKey,
    );
    const tx = this.db.transaction(["courses", "threads", "posts", "checkpoints"], "readwrite");
    if (bundle.course) {
      tx.objectStore("courses").put(bundle.course);
    }
    tx.objectStore("threads").put({
      ...bundle.thread,
      storageKey: threadKey,
    });
    const posts = tx.objectStore("posts");
    for (const post of existingPosts) {
      posts.delete(post.storageKey);
    }
    for (const post of bundle.posts) {
      posts.put({
        ...post,
        threadKey: threadStorageKey(post.courseId, post.threadId),
        storageKey: postStorageKey(post.courseId, post.threadId, post.postId),
      });
    }
    tx.objectStore("checkpoints").put(bundle.checkpoint);
    await transactionDone(tx);
  }

  async listThreads(courseId: string): Promise<ArchivedThread[]> {
    const rows = await getAllFromIndex<ArchivedThread & { storageKey: string }>(
      this.db,
      "threads",
      "courseId",
      courseId,
    );
    return rows.map(({ storageKey: _storageKey, ...thread }) => thread);
  }

  async listPosts(courseId: string, threadId: string): Promise<ArchivedPost[]> {
    const rows = await getAllFromIndex<
      ArchivedPost & { storageKey: string; threadKey: string }
    >(this.db, "posts", "threadKey", threadStorageKey(courseId, threadId));
    return rows.map(({ storageKey: _storageKey, threadKey: _threadKey, ...post }) => post);
  }

  async upsertSyncRun(run: SyncRun): Promise<void> {
    await putOne(this.db, "syncRuns", run);
  }

  async getSyncRun(runId: string): Promise<SyncRun | undefined> {
    return getOne(this.db, "syncRuns", runId);
  }

  async requestCancel(runId: string, requestedAt: string): Promise<SyncRun | undefined> {
    const run = await this.getSyncRun(runId);
    if (!run) {
      return undefined;
    }
    const updated = {
      ...run,
      status: "cancelling" as const,
      cancelRequested: true,
      updatedAt: requestedAt,
    };
    await this.upsertSyncRun(updated);
    return updated;
  }

  async appendSyncEvent(event: SyncEvent): Promise<void> {
    await putOne(this.db, "syncEvents", sanitizeSyncEvent(event));
  }

  async listSyncEvents(runId?: string): Promise<SyncEvent[]> {
    if (!runId) {
      return getAll<SyncEvent>(this.db, "syncEvents");
    }
    return getAllFromIndex<SyncEvent>(this.db, "syncEvents", "runId", runId);
  }

  async getSyncSnapshot(): Promise<SyncSnapshot> {
    const runs = await getAll<SyncRun>(this.db, "syncRuns");
    return snapshotFromRuns(runs);
  }

  async putExportRun(run: ExportRunSummary): Promise<void> {
    await putOne(this.db, "exportRuns", sanitizeExportRun(run));
  }

  async getExportSnapshot(): Promise<ExportSnapshot> {
    const runs = await getAll<ExportRunSummary>(this.db, "exportRuns");
    return snapshotFromExportRuns(runs);
  }

  close(): void {
    this.db.close();
  }
}

interface MemoryState {
  courses: Map<string, ArchivedCourse>;
  threads: Map<string, ArchivedThread>;
  posts: Map<string, ArchivedPost>;
  checkpoints: Map<string, CourseCheckpoint>;
  syncRuns: Map<string, SyncRun>;
  syncEvents: Map<string, SyncEvent>;
  exportRuns: Map<string, ExportRunSummary>;
}

const memoryStates = new Map<string, MemoryState>();

function openMemoryRepository(namespace: string): SyncRepository {
  let state = memoryStates.get(namespace);
  if (!state) {
    state = {
      courses: new Map(),
      threads: new Map(),
      posts: new Map(),
      checkpoints: new Map(),
      syncRuns: new Map(),
      syncEvents: new Map(),
      exportRuns: new Map(),
    };
    memoryStates.set(namespace, state);
  }
  return new MemorySyncRepository(state);
}

class MemorySyncRepository implements SyncRepository {
  constructor(private readonly state: MemoryState) {}

  async putCourse(course: ArchivedCourse): Promise<void> {
    this.state.courses.set(course.id, clone(course));
  }

  async getCourse(courseId: string): Promise<ArchivedCourse | undefined> {
    return clone(this.state.courses.get(courseId));
  }

  async getCourseCheckpoint(courseId: string): Promise<CourseCheckpoint | undefined> {
    return clone(this.state.checkpoints.get(courseId));
  }

  async persistThreadWithCheckpoint(bundle: ThreadArchiveBundle): Promise<void> {
    const next = cloneMemoryState(this.state);
    if (bundle.course) {
      next.courses.set(bundle.course.id, clone(bundle.course));
    }
    const threadKey = threadStorageKey(bundle.thread.courseId, bundle.thread.threadId);
    next.threads.set(threadKey, clone(bundle.thread));
    for (const [postKey, post] of next.posts) {
      if (post.courseId === bundle.thread.courseId && post.threadId === bundle.thread.threadId) {
        next.posts.delete(postKey);
      }
    }
    for (const post of bundle.posts) {
      next.posts.set(postStorageKey(post.courseId, post.threadId, post.postId), clone(post));
    }
    next.checkpoints.set(bundle.checkpoint.courseId, clone(bundle.checkpoint));
    replaceMemoryState(this.state, next);
  }

  async listThreads(courseId: string): Promise<ArchivedThread[]> {
    return [...this.state.threads.values()].filter((thread) => thread.courseId === courseId).map(clone);
  }

  async listPosts(courseId: string, threadId: string): Promise<ArchivedPost[]> {
    return [...this.state.posts.values()]
      .filter((post) => post.courseId === courseId && post.threadId === threadId)
      .map(clone);
  }

  async upsertSyncRun(run: SyncRun): Promise<void> {
    this.state.syncRuns.set(run.runId, clone(run));
  }

  async getSyncRun(runId: string): Promise<SyncRun | undefined> {
    return clone(this.state.syncRuns.get(runId));
  }

  async requestCancel(runId: string, requestedAt: string): Promise<SyncRun | undefined> {
    const run = await this.getSyncRun(runId);
    if (!run) {
      return undefined;
    }
    const updated = {
      ...run,
      status: "cancelling" as const,
      cancelRequested: true,
      updatedAt: requestedAt,
    };
    await this.upsertSyncRun(updated);
    return updated;
  }

  async appendSyncEvent(event: SyncEvent): Promise<void> {
    this.state.syncEvents.set(event.eventId, sanitizeSyncEvent(event));
  }

  async listSyncEvents(runId?: string): Promise<SyncEvent[]> {
    return [...this.state.syncEvents.values()]
      .filter((event) => !runId || event.runId === runId)
      .map(clone);
  }

  async getSyncSnapshot(): Promise<SyncSnapshot> {
    return snapshotFromRuns([...this.state.syncRuns.values()].map(clone));
  }

  async putExportRun(run: ExportRunSummary): Promise<void> {
    this.state.exportRuns.set(run.runId, sanitizeExportRun(run));
  }

  async getExportSnapshot(): Promise<ExportSnapshot> {
    return snapshotFromExportRuns([...this.state.exportRuns.values()].map(clone));
  }

  close(): void {}
}

function sanitizeSyncEvent(event: SyncEvent): SyncEvent {
  return {
    ...event,
    message: sanitizeErrorMessage(event.message),
  };
}

function snapshotFromRuns(runs: SyncRun[]): SyncSnapshot {
  const sorted = [...runs].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  const activeRun = sorted.find((run) =>
    ["queued", "running", "waiting_retry", "cancelling"].includes(run.status),
  );
  return { activeRun, recentRuns: sorted.slice(0, 5) };
}

function snapshotFromExportRuns(runs: ExportRunSummary[]): ExportSnapshot {
  const sorted = [...runs].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return { recentRuns: sorted.slice(0, 5).map(sanitizeExportRun) };
}

function sanitizeExportRun(run: ExportRunSummary): ExportRunSummary {
  return {
    ...run,
    message: run.message ? sanitizeErrorMessage(run.message) : undefined,
    courseResults: run.courseResults.map((course) => ({
      ...course,
      message: course.message ? sanitizeErrorMessage(course.message) : undefined,
      files: course.files.map((file) => ({
        courseId: file.courseId,
        threadId: file.threadId,
        filename: file.filename,
        downloadId: file.downloadId,
        error: file.error ? sanitizeErrorMessage(file.error) : undefined,
      })),
    })),
  };
}

function putOne(db: IDBDatabase, store: StoreName, value: unknown): Promise<void> {
  const tx = db.transaction(store, "readwrite");
  tx.objectStore(store).put(value);
  return transactionDone(tx);
}

function getOne<T>(db: IDBDatabase, store: StoreName, key: IDBValidKey): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    const request = tx.objectStore(store).get(key);
    request.onerror = () => reject(new Error(sanitizeErrorMessage(request.error?.message)));
    request.onsuccess = () => resolve(request.result as T | undefined);
  });
}

function getAll<T>(db: IDBDatabase, store: StoreName): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    const request = tx.objectStore(store).getAll();
    request.onerror = () => reject(new Error(sanitizeErrorMessage(request.error?.message)));
    request.onsuccess = () => resolve(request.result as T[]);
  });
}

function getAllFromIndex<T>(
  db: IDBDatabase,
  store: StoreName,
  index: string,
  value: IDBValidKey,
): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, "readonly");
    const request = tx.objectStore(store).index(index).getAll(value);
    request.onerror = () => reject(new Error(sanitizeErrorMessage(request.error?.message)));
    request.onsuccess = () => resolve(request.result as T[]);
  });
}

function transactionDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(new Error(sanitizeErrorMessage(tx.error?.message)));
    tx.onabort = () => reject(new Error(sanitizeErrorMessage(tx.error?.message)));
  });
}

function clone<T>(value: T): T {
  return value === undefined ? value : JSON.parse(JSON.stringify(value));
}

function cloneMemoryState(state: MemoryState): MemoryState {
  return {
    courses: new Map([...state.courses].map(([key, value]) => [key, clone(value)])),
    threads: new Map([...state.threads].map(([key, value]) => [key, clone(value)])),
    posts: new Map([...state.posts].map(([key, value]) => [key, clone(value)])),
    checkpoints: new Map([...state.checkpoints].map(([key, value]) => [key, clone(value)])),
    syncRuns: new Map([...state.syncRuns].map(([key, value]) => [key, clone(value)])),
    syncEvents: new Map([...state.syncEvents].map(([key, value]) => [key, clone(value)])),
    exportRuns: new Map([...state.exportRuns].map(([key, value]) => [key, clone(value)])),
  };
}

function replaceMemoryState(target: MemoryState, source: MemoryState): void {
  target.courses = source.courses;
  target.threads = source.threads;
  target.posts = source.posts;
  target.checkpoints = source.checkpoints;
  target.syncRuns = source.syncRuns;
  target.syncEvents = source.syncEvents;
}
