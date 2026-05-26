import {
  cancelSync,
  openDownloadsFolder,
  openEdstem,
  renderPopup,
  requestCurrentCourse,
  requestExportSnapshot,
  requestSessionSnapshot,
  requestSyncSnapshot,
  startAllCoursesExport,
  startCourseExport,
} from "./popupState";
import type { CurrentCourseEligibility } from "./background/activeCourse";
import type { SessionSnapshot } from "./background/session";
import type { ExportSnapshot, SyncSnapshot } from "./sync/types";

const app = document.querySelector<HTMLDivElement>("#app");

if (!app) {
  throw new Error("Popup root element was not found.");
}

const root = app;
let lastSessionSnapshot: SessionSnapshot = { state: "checking" };
let lastCurrentCourse: CurrentCourseEligibility | undefined;
let lastExportSnapshot: ExportSnapshot | undefined;
let progressPoll: number | undefined;

async function loadSnapshot(): Promise<void> {
  root.innerHTML = renderPopup({ state: "checking" });

  try {
    const [sessionSnapshot, syncSnapshot] = await Promise.all([
      requestSessionSnapshot(),
      requestSyncSnapshot(),
    ]);
    const [currentCourse, exportSnapshot] = await Promise.all([
      requestCurrentCourse(),
      requestExportSnapshot(),
    ]);
    lastSessionSnapshot = sessionSnapshot;
    lastCurrentCourse = currentCourse;
    lastExportSnapshot = exportSnapshot;
    root.innerHTML = renderPopup(sessionSnapshot, syncSnapshot, currentCourse, exportSnapshot);
  } catch {
    root.innerHTML = renderPopup({
      state: "connection_problem",
      message: "The extension could not reach its background worker.",
    });
  }
}

root.addEventListener("click", (event) => {
  const target = event.target instanceof HTMLElement
    ? event.target.closest<HTMLButtonElement>("button[data-action]")
    : null;
  if (!target) {
    return;
  }

  const action = target.dataset.action;
  if (action === "retry") {
    void loadSnapshot();
  }
  if (action === "open-edstem") {
    void openEdstem();
  }
  if (action === "start-all-export") {
    renderStartingProgress("all_courses");
    startProgressPolling();
    void runExportCommand(() => startAllCoursesExport());
  }
  if (action === "start-course-export" && target.dataset.value) {
    renderStartingProgress("course", target.dataset.value);
    startProgressPolling();
    void runExportCommand(() => startCourseExport(target.dataset.value ?? ""));
  }
  if (action === "cancel-sync" && target.dataset.value) {
    void cancelSync(target.dataset.value).then(loadSnapshot);
  }
  if (action === "open-downloads-folder") {
    void openDownloadsFolder();
  }
});

void loadSnapshot();

function renderStartingProgress(mode: "course" | "all_courses", courseId?: string): void {
  const now = new Date().toISOString();
  const selectedCourse =
    lastCurrentCourse?.state === "eligible" && lastCurrentCourse.course.id === courseId
      ? lastCurrentCourse.course
      : lastSessionSnapshot.state === "signed_in"
        ? lastSessionSnapshot.courses.find((course) => course.id === courseId) ?? lastSessionSnapshot.courses[0]
        : undefined;
  const courseProgress =
    mode === "all_courses" && lastSessionSnapshot.state === "signed_in"
      ? lastSessionSnapshot.courses.map((course) => ({
          courseId: course.id,
          courseName: course.name,
          completedThreads: 0,
          message: "Starting download...",
        }))
      : [
          {
            courseId: courseId ?? selectedCourse?.id ?? "current-course",
            courseName: selectedCourse?.name ?? "Current course",
            completedThreads: 0,
            message: "Starting download...",
          },
        ];

  const optimisticSync: SyncSnapshot = {
    activeRun: {
      runId: "starting",
      mode,
      status: "queued",
      courseIds: courseProgress.map((course) => course.courseId),
      currentCourseId: courseProgress[0]?.courseId,
      startedAt: now,
      updatedAt: now,
      retryAttempt: 0,
      message: "Starting download...",
      courseProgress,
    },
    recentRuns: [],
  };

  root.innerHTML = renderPopup(lastSessionSnapshot, optimisticSync, lastCurrentCourse, lastExportSnapshot);
}

function startProgressPolling(): void {
  if (progressPoll !== undefined) {
    window.clearInterval(progressPoll);
  }

  let ticks = 0;
  progressPoll = window.setInterval(() => {
    ticks += 1;
    void refreshProgressOnly();
    if (ticks > 120 && progressPoll !== undefined) {
      window.clearInterval(progressPoll);
      progressPoll = undefined;
    }
  }, 1000);
}

async function runExportCommand(command: () => Promise<{ ok?: boolean; message?: string } | undefined>): Promise<void> {
  try {
    const result = await command();
    if (result && result.ok === false) {
      stopProgressPolling();
      root.innerHTML = renderPopup({
        state: "connection_problem",
        message: result.message ?? "Download did not start.",
      });
      return;
    }
    await loadSnapshot();
  } catch (error) {
    stopProgressPolling();
    root.innerHTML = renderPopup({
      state: "connection_problem",
      message: error instanceof Error && error.message ? error.message : "Download did not start.",
    });
  }
}

function stopProgressPolling(): void {
  if (progressPoll !== undefined) {
    window.clearInterval(progressPoll);
    progressPoll = undefined;
  }
}

async function refreshProgressOnly(): Promise<void> {
  try {
    const [syncSnapshot, exportSnapshot] = await Promise.all([
      requestSyncSnapshot(),
      requestExportSnapshot(),
    ]);
    lastExportSnapshot = exportSnapshot;
    root.innerHTML = renderPopup(lastSessionSnapshot, syncSnapshot, lastCurrentCourse, exportSnapshot);
    if (!syncSnapshot?.activeRun && progressPoll !== undefined) {
      window.clearInterval(progressPoll);
      progressPoll = undefined;
    }
  } catch {
    // Keep the existing optimistic progress panel visible.
  }
}
