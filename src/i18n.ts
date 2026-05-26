export const DEFAULT_MESSAGES = {
  actionTitle: "Edstem Archive",
  allVisibleCourses: "All visible courses",
  appName: "Edstem Archive",
  cancelSync: "Cancel sync",
  checkingBody: "Checking your existing EDstem browser session.",
  checkingEyebrow: "Checking",
  checkingStatus: "Checking EDstem session",
  connectionEyebrow: "Retry needed",
  connectionLabel: "Connection",
  connectionStatus: "Connection problem",
  courseNotVisibleHint: "The active course is not visible in this EDstem session.",
  coursesLabel: "Courses",
  currentCourse: "Current course",
  defaultDownloadHint: "Markdown files are saved to your browser Downloads folder.",
  downloadActionsLabel: "Download actions",
  downloadAllCourses: "Download all courses",
  downloadCurrentCourse: "Download current course",
  downloadFailed: "Download failed.",
  downloadResultLabel: "Download result",
  downloadedFiles: "downloaded $count$ files",
  emptyCoursesBody: "The extension could not find courses for this EDstem session.",
  emptyCoursesEyebrow: "No courses",
  emptyCoursesLabel: "No visible courses found",
  exportDiagnostics: "Export diagnostics",
  exportFinishedWithErrors: "Export finished with errors.",
  loginNeededBody: "Open EDstem, sign in, then try again.",
  loginNeededEyebrow: "Login needed",
  loginNeededStatus: "Please log in to EDstem",
  manifestDescription: "Download accessible EDstem discussions as local Markdown.",
  manifestName: "Edstem Archive",
  notificationCompleteMessage: "Downloaded $succeeded$/$attempted$ files.",
  notificationCompleteTitle: "Edstem Archive download complete",
  notificationIssueMessage: "Downloaded $succeeded$/$attempted$ files. Open the result for details.",
  notificationIssueTitle: "Edstem Archive finished with errors",
  notCoursePageHint: "Open an Edstem course tab to enable current-course download.",
  notEdstemHint: "Open an Edstem course tab to enable current-course download.",
  notSignedInHint: "Log in to Edstem before downloading Markdown.",
  onboardingLede: "Download accessible course discussions as local Markdown from your own browser session.",
  onboardingOpenEdstem: "Open Edstem",
  onboardingTitle: "Archive your Edstem discussions",
  openDownloadsFolder: "Open downloads folder",
  openEdstem: "Open Edstem",
  pausedEyebrow: "Paused",
  privacyNote: "No credentials or cookies are collected.",
  readyEyebrow: "Ready",
  retry: "Retry",
  sessionExpiredStatus: "Session expired",
  sessionLabel: "Session",
  signedInStatus: "Logged in to EDstem",
  syncPaused: "Sync is paused at the last saved checkpoint. Log in to EDstem, then resume.",
  syncPausedCheckpoint: "Sync is paused at the last saved checkpoint: $checkpoint$. Log in to EDstem, then resume.",
  syncPausedLabel: "Sync paused",
  syncProgressLabel: "Sync progress",
  threadsProgress: "$completed$/$total$ threads",
  trustExistingSession: "Uses your existing EDstem session",
  trustLocalMarkdown: "Saves Markdown locally",
  trustNoCredentials: "No credential or activity collection",
  waitingRetryAt: "Waiting to retry at $time$.",
} as const;

export type MessageKey = keyof typeof DEFAULT_MESSAGES;
export type MessageValues = Partial<Record<MessageKey, string>>;
export type I18n = (key: MessageKey, substitutions?: Record<string, string | number>) => string;

export function createI18n(messages: MessageValues = DEFAULT_MESSAGES): I18n {
  return (key, substitutions = {}) => {
    const chromeMessage = readChromeMessage(key, substitutions);
    if (chromeMessage) {
      return chromeMessage;
    }
    const message = messages[key] ?? DEFAULT_MESSAGES[key];
    return interpolateMessage(message, substitutions);
  };
}

export const defaultI18n = createI18n();

export function assertMessageKeyParity(left: Record<string, unknown>, right: Record<string, unknown>): void {
  const leftKeys = Object.keys(left).sort();
  const rightKeys = Object.keys(right).sort();
  if (leftKeys.join("\n") !== rightKeys.join("\n")) {
    throw new Error("Locale message keys do not match.");
  }
}

function readChromeMessage(key: MessageKey, substitutions: Record<string, string | number>): string | undefined {
  const runtime = globalThis.chrome?.i18n;
  if (!runtime?.getMessage) {
    return undefined;
  }
  const values = Object.values(substitutions).map(String);
  const message = runtime.getMessage(key, values);
  return message || undefined;
}

function interpolateMessage(message: string, substitutions: Record<string, string | number>): string {
  return Object.entries(substitutions).reduce(
    (current, [key, value]) => current.replaceAll(`$${key}$`, String(value)),
    message,
  );
}
