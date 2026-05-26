import { CourseSummary } from "../edstem/courses";
import { edstemFetch } from "../edstem/client";
import { EdstemResult } from "../edstem/errors";
import { createEdstemDiscussionProvider } from "../sync/provider";
import { openSyncDb } from "../sync/db";
import { SyncEngine } from "../sync/engine";
import { ArchivedCourse, SyncRun, SyncSnapshot } from "../sync/types";
import { loadSessionSnapshot, SessionSnapshot } from "./session";
import {
  CANCEL_SYNC,
  FETCH_EDSTEM_API,
  GET_SYNC_SNAPSHOT,
  START_ALL_COURSES_SYNC,
  START_COURSE_SYNC,
} from "./messageTypes";

export const SYNC_ALARM_NAME = "edstemArchive.sync.resume";

export interface SyncSnapshotRequest {
  type: typeof GET_SYNC_SNAPSHOT;
}

export interface StartCourseSyncRequest {
  type: typeof START_COURSE_SYNC;
  courseId: string;
}

export interface StartAllCoursesSyncRequest {
  type: typeof START_ALL_COURSES_SYNC;
}

export interface CancelSyncRequest {
  type: typeof CANCEL_SYNC;
  runId: string;
}

export type SyncBackgroundRequest =
  | SyncSnapshotRequest
  | StartCourseSyncRequest
  | StartAllCoursesSyncRequest
  | CancelSyncRequest;

export interface SyncCommandResult {
  ok: boolean;
  snapshot?: SyncSnapshot;
  run?: SyncRun;
  message?: string;
}

export interface SyncControllerDeps {
  loadSession?: () => Promise<SessionSnapshot>;
  makeEngine?: () => Promise<SyncEngine>;
  createAlarm?: (name: string, info: chrome.alarms.AlarmCreateInfo) => Promise<void> | void;
}

export function isSyncBackgroundRequest(message: unknown): message is SyncBackgroundRequest {
  if (!message || typeof message !== "object") {
    return false;
  }
  const record = message as { type?: unknown; courseId?: unknown; runId?: unknown };
  if (record.type === GET_SYNC_SNAPSHOT || record.type === START_ALL_COURSES_SYNC) {
    return true;
  }
  if (record.type === START_COURSE_SYNC) {
    return typeof record.courseId === "string" && record.courseId.trim() !== "";
  }
  if (record.type === CANCEL_SYNC) {
    return typeof record.runId === "string" && record.runId.trim() !== "";
  }
  return false;
}

export function createSyncController(deps: SyncControllerDeps = {}) {
  const loadSession = deps.loadSession ?? loadSessionSnapshot;
  const makeEngine = deps.makeEngine ?? createDefaultSyncEngine;
  const createAlarm = deps.createAlarm ?? ((name, info) => chrome.alarms.create(name, info));

  async function getSnapshot(): Promise<SyncCommandResult> {
    const engine = await makeEngine();
    return { ok: true, snapshot: await engine.snapshot() };
  }

  async function startAllCourses(): Promise<SyncCommandResult> {
    const snapshot = await loadSession();
    if (snapshot.state !== "signed_in") {
      return { ok: false, message: "Log in to Edstem before starting sync." };
    }
    const engine = await makeEngine();
    const result = await engine.start({
      mode: "all_courses",
      courses: snapshot.courses.map(courseSummaryToArchiveCourse),
    });
    await scheduleRetryAlarm(result.run, createAlarm);
    return { ok: true, run: result.run, snapshot: await engine.snapshot() };
  }

  async function startCourse(courseId: string): Promise<SyncCommandResult> {
    const snapshot = await loadSession();
    if (snapshot.state !== "signed_in") {
      return { ok: false, message: "Log in to Edstem before starting sync." };
    }
    const course = snapshot.courses.find((candidate) => candidate.id === courseId);
    if (!course) {
      return { ok: false, message: "Course is not visible in the current Edstem session." };
    }
    const engine = await makeEngine();
    const result = await engine.start({
      mode: "course",
      courses: [courseSummaryToArchiveCourse(course)],
    });
    await scheduleRetryAlarm(result.run, createAlarm);
    return { ok: true, run: result.run, snapshot: await engine.snapshot() };
  }

  async function cancel(runId: string): Promise<SyncCommandResult> {
    const engine = await makeEngine();
    const run = await engine.cancel(runId);
    return { ok: Boolean(run), run, snapshot: await engine.snapshot() };
  }

  async function resumeFromAlarm(): Promise<void> {
    const engine = await makeEngine();
    const result = await engine.resume();
    await scheduleRetryAlarm(result.run, createAlarm);
  }

  return { getSnapshot, startAllCourses, startCourse, cancel, resumeFromAlarm };
}

export function registerSyncHandlers(): void {
  const controller = createSyncController();

  chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
    if (!isSyncBackgroundRequest(message)) {
      return undefined;
    }

    if (message.type === GET_SYNC_SNAPSHOT) {
      void controller.getSnapshot().then(sendResponse);
      return true;
    }
    if (message.type === START_ALL_COURSES_SYNC) {
      void controller.startAllCourses().then(sendResponse);
      return true;
    }
    if (message.type === START_COURSE_SYNC) {
      void controller.startCourse(message.courseId).then(sendResponse);
      return true;
    }
    if (message.type === CANCEL_SYNC) {
      void controller.cancel(message.runId).then(sendResponse);
      return true;
    }

    return undefined;
  });

  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === SYNC_ALARM_NAME) {
      void controller.resumeFromAlarm();
    }
  });
}

async function createDefaultSyncEngine(): Promise<SyncEngine> {
  return new SyncEngine({
    repository: await openSyncDb(),
    provider: createEdstemDiscussionProvider(createActiveTabEdstemFetcher()),
    maxThreadConcurrency: 2,
  });
}

export function createActiveTabEdstemFetcher(
  queryTabs: (queryInfo: chrome.tabs.QueryInfo) => Promise<Array<Pick<chrome.tabs.Tab, "id" | "url">>> = (queryInfo) =>
    chrome.tabs.query(queryInfo),
  sendMessage: (tabId: number, message: unknown) => Promise<unknown> = (tabId, message) =>
    chrome.tabs.sendMessage(tabId, message),
): <T>(path: string) => Promise<EdstemResult<T>> {
  return async <T>(path: string): Promise<EdstemResult<T>> => {
    const tab = await findEdstemTab(queryTabs);
    if (!tab?.id) {
      return edstemFetch<T>(path);
    }

    try {
      const response = await sendMessage(tab.id, { type: FETCH_EDSTEM_API, path });
      if (isEdstemResult<T>(response)) {
        return response;
      }
    } catch {
      // Fall through to the service-worker fetch path when the page bridge is unavailable.
    }

    return edstemFetch<T>(path);
  };
}

async function findEdstemTab(
  queryTabs: (queryInfo: chrome.tabs.QueryInfo) => Promise<Array<Pick<chrome.tabs.Tab, "id" | "url">>>,
): Promise<Pick<chrome.tabs.Tab, "id" | "url"> | undefined> {
  const [activeTab] = await queryTabs({ active: true, currentWindow: true });
  if (activeTab?.id && isEdstemUrl(activeTab.url)) {
    return activeTab;
  }

  const tabs = await queryTabs({ url: ["https://edstem.org/*", "https://*.edstem.org/*"] });
  return tabs.find((tab) => tab.id && isEdstemUrl(tab.url));
}

function isEdstemUrl(rawUrl: string | undefined): boolean {
  if (!rawUrl) {
    return false;
  }
  try {
    const url = new URL(rawUrl);
    return url.protocol === "https:" && (url.hostname === "edstem.org" || url.hostname.endsWith(".edstem.org"));
  } catch {
    return false;
  }
}

function isEdstemResult<T>(value: unknown): value is EdstemResult<T> {
  return Boolean(value && typeof value === "object" && "ok" in value);
}

async function scheduleRetryAlarm(
  run: SyncRun,
  createAlarm: (name: string, info: chrome.alarms.AlarmCreateInfo) => Promise<void> | void,
): Promise<void> {
  if (run.status !== "waiting_retry" || !run.nextAttemptAt) {
    return;
  }
  await createAlarm(SYNC_ALARM_NAME, { when: Date.parse(run.nextAttemptAt) });
}

function courseSummaryToArchiveCourse(course: CourseSummary): ArchivedCourse {
  return {
    id: course.id,
    name: course.name,
    url: course.url,
  };
}
