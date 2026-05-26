import { CourseSummary } from "../edstem/courses";
import { sanitizeErrorMessage } from "../edstem/errors";
import { buildCourseMarkdownManifest } from "../export/manifest";
import { DownloadMarkdownResult, downloadMarkdownFiles, openDownloadsFolder } from "../export/downloads";
import { openSyncDb, SyncRepository } from "../sync/db";
import { ExportCourseResult, ExportRunSummary, ExportSnapshot, SyncRun } from "../sync/types";
import { notifyExportResult } from "./notifications";
import {
  GET_EXPORT_SNAPSHOT,
  OPEN_DOWNLOADS_FOLDER,
  START_ALL_COURSES_EXPORT,
  START_COURSE_EXPORT,
} from "./messageTypes";
import { SessionSnapshot, loadSessionSnapshot } from "./session";
import { createSyncController, SyncCommandResult } from "./sync";

export interface ExportSnapshotRequest {
  type: typeof GET_EXPORT_SNAPSHOT;
}

export interface StartCourseExportRequest {
  type: typeof START_COURSE_EXPORT;
  courseId: string;
}

export interface StartAllCoursesExportRequest {
  type: typeof START_ALL_COURSES_EXPORT;
}

export interface OpenDownloadsFolderRequest {
  type: typeof OPEN_DOWNLOADS_FOLDER;
}

export type ExportBackgroundRequest =
  | ExportSnapshotRequest
  | StartCourseExportRequest
  | StartAllCoursesExportRequest
  | OpenDownloadsFolderRequest;

export interface ExportCommandResult {
  ok: boolean;
  snapshot?: ExportSnapshot;
  run?: ExportRunSummary;
  downloads?: DownloadMarkdownResult;
  message?: string;
}

export interface ExportControllerDeps {
  loadSession?: () => Promise<SessionSnapshot>;
  makeRepository?: () => Promise<SyncRepository>;
  syncController?: Pick<ReturnType<typeof createSyncController>, "startAllCourses" | "startCourse">;
  downloadFiles?: typeof downloadMarkdownFiles;
  openFolder?: typeof openDownloadsFolder;
  notify?: typeof notifyExportResult;
  now?: () => string;
}

export function isExportBackgroundRequest(message: unknown): message is ExportBackgroundRequest {
  if (!message || typeof message !== "object") {
    return false;
  }
  const record = message as { type?: unknown; courseId?: unknown };
  if (
    record.type === GET_EXPORT_SNAPSHOT ||
    record.type === START_ALL_COURSES_EXPORT ||
    record.type === OPEN_DOWNLOADS_FOLDER
  ) {
    return true;
  }
  if (record.type === START_COURSE_EXPORT) {
    return typeof record.courseId === "string" && record.courseId.trim() !== "";
  }
  return false;
}

export function createExportController(deps: ExportControllerDeps = {}) {
  const loadSession = deps.loadSession ?? loadSessionSnapshot;
  const makeRepository = deps.makeRepository ?? openSyncDb;
  const syncController = deps.syncController ?? createSyncController();
  const downloadFiles = deps.downloadFiles ?? downloadMarkdownFiles;
  const openFolder = deps.openFolder ?? openDownloadsFolder;
  const notify = deps.notify ?? notifyExportResult;
  const now = deps.now ?? (() => new Date().toISOString());

  async function getSnapshot(): Promise<ExportCommandResult> {
    const repository = await makeRepository();
    try {
      return { ok: true, snapshot: await repository.getExportSnapshot() };
    } finally {
      repository.close();
    }
  }

  async function startCourseExport(courseId: string): Promise<ExportCommandResult> {
    const session = await loadSession();
    if (session.state !== "signed_in") {
      return { ok: false, message: "Log in to Edstem before downloading Markdown." };
    }
    const course = session.courses.find((candidate) => candidate.id === courseId);
    if (!course) {
      return { ok: false, message: "Course is not visible in the current Edstem session." };
    }

    const syncResult = await syncController.startCourse(courseId);
    if (!syncCanExport(syncResult)) {
      return { ok: false, message: syncResult.message ?? syncResult.run?.message ?? "Sync did not finish." };
    }

    return exportCourses("course", [course]);
  }

  async function startAllCoursesExport(): Promise<ExportCommandResult> {
    const session = await loadSession();
    if (session.state !== "signed_in") {
      return { ok: false, message: "Log in to Edstem before downloading Markdown." };
    }

    const syncResult = await syncController.startAllCourses();
    if (!syncCanExport(syncResult)) {
      return { ok: false, message: syncResult.message ?? syncResult.run?.message ?? "Sync did not finish." };
    }

    return exportCourses("all_courses", session.courses);
  }

  async function showDownloadsFolder(): Promise<ExportCommandResult> {
    try {
      await openFolder();
      return getSnapshot();
    } catch (error) {
      return { ok: false, message: sanitizeErrorMessage(error instanceof Error ? error.message : error) };
    }
  }

  async function exportCourses(
    mode: ExportRunSummary["mode"],
    courses: CourseSummary[],
  ): Promise<ExportCommandResult> {
    const repository = await makeRepository();
    try {
      const manifests = [];
      for (const course of courses) {
        manifests.push(
          await buildCourseMarkdownManifest(
            repository,
            course.id,
            { id: course.id, name: course.name, url: course.url },
            now(),
          ),
        );
      }
      const files = manifests.flatMap((manifest) => manifest.files);
      const downloads = await downloadFiles(files);
      const run = await rememberRun(repository, {
        runId: `export-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        mode,
        status: downloads.failed > 0 ? (downloads.succeeded > 0 ? "partial" : "failed") : "success",
        courseIds: courses.map((course) => course.id),
        courseResults: buildCourseResults(courses, manifests, downloads),
        attempted: downloads.attempted,
        succeeded: downloads.succeeded,
        failed: downloads.failed,
        updatedAt: now(),
        message:
          downloads.attempted === 0
            ? "No archived discussions were available to download."
            : `${downloads.succeeded}/${downloads.attempted} Markdown files downloaded.`,
      });
      await notify(run);
      return { ok: downloads.failed === 0, run, downloads, snapshot: await repository.getExportSnapshot() };
    } finally {
      repository.close();
    }
  }

  async function rememberRun(repository: SyncRepository, run: ExportRunSummary): Promise<ExportRunSummary> {
    await repository.putExportRun(run);
    return run;
  }

  return { getSnapshot, startCourseExport, startAllCoursesExport, showDownloadsFolder };
}

function buildCourseResults(
  courses: CourseSummary[],
  manifests: Awaited<ReturnType<typeof buildCourseMarkdownManifest>>[],
  downloads: DownloadMarkdownResult,
): ExportCourseResult[] {
  return courses.map((course, index) => {
    const attempted = manifests[index]?.files.length ?? 0;
    const files = downloads.files.filter((file) => file.courseId === course.id);
    const failed = files.filter((file) => file.error).length;
    const succeeded = attempted - failed;
    const status = failed > 0 ? (succeeded > 0 ? "partial" : "failed") : "success";
    return {
      courseId: course.id,
      courseName: course.name,
      status,
      attempted,
      succeeded,
      failed,
      files,
      message: failed > 0 ? `${succeeded}/${attempted} Markdown files downloaded.` : undefined,
    };
  });
}

export function registerExportHandlers(): void {
  const controller = createExportController();

  chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
    if (!isExportBackgroundRequest(message)) {
      return undefined;
    }

    if (message.type === GET_EXPORT_SNAPSHOT) {
      void controller.getSnapshot().then(sendResponse);
      return true;
    }
    if (message.type === START_COURSE_EXPORT) {
      void controller.startCourseExport(message.courseId).then(sendResponse);
      return true;
    }
    if (message.type === START_ALL_COURSES_EXPORT) {
      void controller.startAllCoursesExport().then(sendResponse);
      return true;
    }
    if (message.type === OPEN_DOWNLOADS_FOLDER) {
      void controller.showDownloadsFolder().then(sendResponse);
      return true;
    }

    return undefined;
  });
}

function syncCanExport(result: SyncCommandResult): result is SyncCommandResult & { run: SyncRun } {
  return Boolean(result.ok && result.run && ["success", "partial"].includes(result.run.status));
}
