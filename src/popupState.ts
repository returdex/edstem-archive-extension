import {
  CANCEL_SYNC,
  GET_CURRENT_COURSE,
  GET_EXPORT_SNAPSHOT,
  GET_SESSION_SNAPSHOT,
  GET_SYNC_SNAPSHOT,
  OPEN_DOWNLOADS_FOLDER,
  OPEN_EDSTEM,
  START_ALL_COURSES_EXPORT,
  START_COURSE_EXPORT,
} from "./background/messageTypes";
import type { CurrentCourseEligibility } from "./background/activeCourse";
import type { SessionSnapshot } from "./background/session";
import type { CourseSummary } from "./edstem/courses";
import { defaultI18n, I18n } from "./i18n";
import type { ExportRunSummary, ExportSnapshot, SyncSnapshot } from "./sync/types";

export interface PopupCommandResult {
  ok?: boolean;
  message?: string;
}

export interface PopupAction {
  id:
    | "retry"
    | "open-edstem"
    | "start-all-export"
    | "start-course-export"
    | "open-downloads-folder"
    | "cancel-sync";
  label: string;
  disabled?: boolean;
  value?: string;
}

export interface PopupViewModel {
  eyebrow: string;
  status: string;
  statusTone: "neutral" | "success" | "warning" | "error";
  bodyLabel: string;
  bodyHtml: string;
  actions: PopupAction[];
}

export function viewModelForSnapshot(snapshot: SessionSnapshot, t: I18n = defaultI18n): PopupViewModel {
  switch (snapshot.state) {
    case "checking":
      return {
        eyebrow: t("checkingEyebrow"),
        status: t("checkingStatus"),
        statusTone: "neutral",
        bodyLabel: t("sessionLabel"),
        bodyHtml: `<p>${escapeHtml(t("checkingBody"))}</p>`,
        actions: [],
      };
    case "signed_in":
      return {
        eyebrow: t("readyEyebrow"),
        status: t("signedInStatus"),
        statusTone: "success",
        bodyLabel: t("coursesLabel"),
        bodyHtml: renderCourseList(snapshot.courses),
        actions: [],
      };
    case "empty_courses":
      return {
        eyebrow: t("emptyCoursesEyebrow"),
        status: t("signedInStatus"),
        statusTone: "warning",
        bodyLabel: t("emptyCoursesLabel"),
        bodyHtml: `<p>${escapeHtml(t("emptyCoursesBody"))}</p>`,
        actions: [{ id: "retry", label: t("retry") }],
      };
    case "needs_login":
      return {
        eyebrow: t("loginNeededEyebrow"),
        status: t("loginNeededStatus"),
        statusTone: "warning",
        bodyLabel: t("sessionLabel"),
        bodyHtml: `<p>${escapeHtml(t("loginNeededBody"))}</p>${renderDiagnostic(snapshot.diagnostic)}`,
        actions: [
          { id: "open-edstem", label: t("openEdstem") },
          { id: "retry", label: t("retry") },
        ],
      };
    case "connection_problem":
      return {
        eyebrow: t("connectionEyebrow"),
        status: t("connectionStatus"),
        statusTone: "error",
        bodyLabel: t("connectionLabel"),
        bodyHtml: `<p>${escapeHtml(snapshot.message)}</p>${renderDiagnostic(snapshot.diagnostic)}`,
        actions: [
          { id: "retry", label: t("retry") },
          { id: "open-edstem", label: t("openEdstem") },
        ],
      };
    case "auth_expired_paused":
      return {
        eyebrow: t("pausedEyebrow"),
        status: t("sessionExpiredStatus"),
        statusTone: "warning",
        bodyLabel: t("syncPausedLabel"),
        bodyHtml: `<p>${escapeHtml(
          snapshot.checkpointLabel
            ? t("syncPausedCheckpoint", { checkpoint: snapshot.checkpointLabel })
            : t("syncPaused"),
        )}</p>`,
        actions: [{ id: "open-edstem", label: t("openEdstem") }],
      };
  }
}

export function renderPopup(
  snapshot: SessionSnapshot,
  syncSnapshot?: SyncSnapshot,
  currentCourse?: CurrentCourseEligibility,
  exportSnapshot?: ExportSnapshot,
  t: I18n = defaultI18n,
): string {
  const view = viewModelForSnapshot(snapshot, t);
  const syncView = viewModelForSyncSnapshot(syncSnapshot, t);
  const exportView = syncView ? undefined : viewModelForExportSnapshot(exportSnapshot, t);
  const showDownloadActions = canShowDownloadActions(snapshot, syncSnapshot);

  return `
    <section class="popup-shell">
      <header class="popup-header">
        <div>
          <p class="eyebrow">${view.eyebrow}</p>
          <h1>${escapeHtml(t("appName"))}</h1>
        </div>
        <span class="status-pill ${view.statusTone}">${view.status}</span>
      </header>

      ${showDownloadActions ? `
      <section class="action-group" aria-label="${escapeHtml(t("downloadActionsLabel"))}">
        ${renderDownloadButtons(snapshot, syncSnapshot, currentCourse, exportSnapshot, t)}
        <p class="button-note">${escapeHtml(downloadHint(currentCourse, t))}</p>
      </section>
      ` : ""}

      <section class="progress-panel" aria-label="${escapeHtml(syncView?.label ?? exportView?.label ?? view.bodyLabel)}">
        ${syncView ? renderProgressView(syncView) : exportView ? renderProgressView(exportView) : `
        <p class="label">${escapeHtml(view.bodyLabel)}</p>
        ${view.bodyHtml}
        ${renderActions(view.actions)}
        `}
      </section>

      <p class="privacy-note">${escapeHtml(t("privacyNote"))}</p>
    </section>
  `;
}

function canShowDownloadActions(snapshot: SessionSnapshot, syncSnapshot?: SyncSnapshot): boolean {
  const runStatus = syncSnapshot?.activeRun?.status;
  if (runStatus && ["queued", "running", "waiting_retry", "cancelling"].includes(runStatus)) {
    return true;
  }
  return snapshot.state === "signed_in" || snapshot.state === "empty_courses";
}

export async function requestSessionSnapshot(): Promise<SessionSnapshot> {
  return chrome.runtime.sendMessage({ type: GET_SESSION_SNAPSHOT });
}

export async function requestSyncSnapshot(): Promise<SyncSnapshot | undefined> {
  const response = await chrome.runtime.sendMessage({ type: GET_SYNC_SNAPSHOT });
  return response?.snapshot;
}

export async function requestCurrentCourse(): Promise<CurrentCourseEligibility | undefined> {
  return chrome.runtime.sendMessage({ type: GET_CURRENT_COURSE });
}

export async function requestExportSnapshot(): Promise<ExportSnapshot | undefined> {
  const response = await chrome.runtime.sendMessage({ type: GET_EXPORT_SNAPSHOT });
  return response?.snapshot;
}

export async function startAllCoursesExport(): Promise<PopupCommandResult | undefined> {
  return chrome.runtime.sendMessage({ type: START_ALL_COURSES_EXPORT });
}

export async function startCourseExport(courseId: string): Promise<PopupCommandResult | undefined> {
  return chrome.runtime.sendMessage({ type: START_COURSE_EXPORT, courseId });
}

export async function cancelSync(runId: string): Promise<void> {
  await chrome.runtime.sendMessage({ type: CANCEL_SYNC, runId });
}

export async function openEdstem(): Promise<void> {
  await chrome.runtime.sendMessage({ type: OPEN_EDSTEM });
}

export async function openDownloadsFolder(): Promise<void> {
  await chrome.runtime.sendMessage({ type: OPEN_DOWNLOADS_FOLDER });
}

function renderCourseList(courses: CourseSummary[]): string {
  const rows = courses
    .map(
      (course) =>
        `<li><span>${escapeHtml(course.name)}</span><small>${escapeHtml(course.source)}</small></li>`,
    )
    .join("");

  return `<ul class="course-list">${rows}</ul>`;
}

function renderActions(actions: PopupAction[]): string {
  if (actions.length === 0) {
    return "";
  }

  return `<div class="inline-actions">${actions
    .map(
      (action) =>
        `<button type="button" data-action="${action.id}"${
          action.value ? ` data-value="${escapeHtml(action.value)}"` : ""
        }${action.disabled ? " disabled" : ""}>${escapeHtml(action.label)}</button>`,
    )
    .join("")}</div>`;
}

function renderDownloadButtons(
  snapshot: SessionSnapshot,
  syncSnapshot?: SyncSnapshot,
  currentCourse?: CurrentCourseEligibility,
  exportSnapshot?: ExportSnapshot,
  t: I18n = defaultI18n,
): string {
  const activeRun = syncSnapshot?.activeRun;
  if (activeRun && ["queued", "running", "waiting_retry", "cancelling"].includes(activeRun.status)) {
    if (activeRun.runId === "starting") {
      return `
        <button type="button" disabled>${escapeHtml(t("downloadCurrentCourse"))}</button>
        <button type="button" disabled>${escapeHtml(t("downloadAllCourses"))}</button>
      `;
    }
    return `
      <button type="button" disabled>${escapeHtml(t("downloadCurrentCourse"))}</button>
      <button type="button" disabled>${escapeHtml(t("downloadAllCourses"))}</button>
      <button type="button" data-action="cancel-sync" data-value="${escapeHtml(activeRun.runId)}">${escapeHtml(t("cancelSync"))}</button>
    `;
  }

  const signedIn = snapshot.state === "signed_in";
  const currentCourseButton =
    signedIn && currentCourse?.state === "eligible"
      ? `<button type="button" data-action="start-course-export" data-value="${escapeHtml(currentCourse.course.id)}">${escapeHtml(t("downloadCurrentCourse"))}</button>`
      : `<button type="button" disabled>${escapeHtml(t("downloadCurrentCourse"))}</button>`;
  const folderButton =
    exportSnapshot?.recentRuns[0]?.attempted || exportSnapshot?.recentRuns[0]?.status
      ? `<button type="button" data-action="open-downloads-folder">${escapeHtml(t("openDownloadsFolder"))}</button>`
      : "";

  return `
    ${currentCourseButton}
    <button type="button"${signedIn ? ` data-action="start-all-export"` : " disabled"}>${escapeHtml(t("downloadAllCourses"))}</button>
    ${folderButton}
  `;
}

interface SyncProgressView {
  label: string;
  html: string;
}

function viewModelForSyncSnapshot(snapshot?: SyncSnapshot, t: I18n = defaultI18n): SyncProgressView | undefined {
  const run = snapshot?.activeRun;
  if (!run) {
    return undefined;
  }
  const activeCourse =
    run.courseProgress.find((course) => course.courseId === run.currentCourseId) ??
    run.courseProgress.find((course) => !course.outcome) ??
    run.courseProgress[0];
  const total = activeCourse?.totalThreads === undefined ? "?" : String(activeCourse.totalThreads);
  const courseName = activeCourse?.courseName ?? activeCourse?.courseId ?? t("currentCourse");
  const message = activeCourse?.message ?? run.message ?? run.status;
  const waiting =
    run.status === "waiting_retry" && run.nextAttemptAt
      ? `<p>${escapeHtml(t("waitingRetryAt", { time: run.nextAttemptAt }))}</p>`
      : "";
  return {
    label: t("syncProgressLabel"),
    html: `
      <p class="label">${escapeHtml(t("syncProgressLabel"))}</p>
      <p>${escapeHtml(message)}</p>
      ${waiting}
      <ul class="course-list">
        <li><span>${escapeHtml(courseName)}</span><small>${escapeHtml(t("threadsProgress", { completed: activeCourse?.completedThreads ?? 0, total }))}</small></li>
      </ul>
    `,
  };
}

function viewModelForExportSnapshot(snapshot?: ExportSnapshot, t: I18n = defaultI18n): SyncProgressView | undefined {
  const run = snapshot?.recentRuns[0];
  if (!run) {
    return undefined;
  }

  return {
    label: t("downloadResultLabel"),
    html: `
      <p class="label">${escapeHtml(t("downloadResultLabel"))}</p>
      <p>${escapeHtml(run.message ?? run.status)}</p>
      ${renderExportResultRows(run, t)}
      ${renderExportDiagnostics(run, t)}
    `,
  };
}

function renderExportResultRows(run: ExportRunSummary, t: I18n): string {
  if (run.mode === "course") {
    const course = run.courseResults[0];
    const label = course?.courseName ?? t("currentCourse");
    const ratio = `${course?.succeeded ?? run.succeeded}/${course?.attempted ?? run.attempted}`;
    return `<ul class="course-list"><li><span>${escapeHtml(label)}</span><small>${ratio}</small></li></ul>`;
  }

  const rows = run.courseResults
    .map((course) => {
      const status = course.status === "success" ? "" : ` - ${course.status}`;
      const message = course.status === "success" || !course.message ? "" : ` <small>${escapeHtml(course.message)}</small>`;
      return `<li><span>${escapeHtml(course.courseName)}</span><small>${escapeHtml(t("downloadedFiles", { count: course.succeeded }))}${escapeHtml(status)}</small>${message}</li>`;
    })
    .join("");
  return `<ul class="course-list">${rows}</ul>`;
}

function renderExportDiagnostics(run: ExportRunSummary, t: I18n): string {
  if (run.status === "success") {
    return "";
  }
  const errorRows = run.courseResults
    .flatMap((course) =>
      course.files
        .filter((file) => file.error)
        .map(
          (file) =>
            `<li><span>${escapeHtml(course.courseName)}</span><small>${escapeHtml(file.filename)}</small><small>${escapeHtml(file.error ?? t("downloadFailed"))}</small></li>`,
        ),
    )
    .join("");
  return `
    <details class="diagnostic-details">
      <summary>${escapeHtml(t("exportDiagnostics"))}</summary>
      <ul class="course-list">${errorRows || `<li><span>${escapeHtml(t("exportFinishedWithErrors"))}</span></li>`}</ul>
    </details>
  `;
}

function renderProgressView(view: SyncProgressView): string {
  return view.html;
}

function downloadHint(currentCourse?: CurrentCourseEligibility, t: I18n = defaultI18n): string {
  if (!currentCourse || currentCourse.state === "eligible") {
    return t("defaultDownloadHint");
  }
  if (currentCourse.state === "not_course_page") {
    return t("notCoursePageHint");
  }
  if (currentCourse.state === "course_not_visible") {
    return t("courseNotVisibleHint");
  }
  if (currentCourse.state === "not_signed_in") {
    return t("notSignedInHint");
  }
  if (currentCourse.state === "not_edstem") {
    return t("notEdstemHint");
  }
  return currentCourse.message;
}

function renderDiagnostic(diagnostic?: string): string {
  if (!diagnostic) {
    return "";
  }
  return `<p class="diagnostic-line"><small>${escapeHtml(diagnostic)}</small></p>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
