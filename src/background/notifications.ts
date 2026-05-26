import { sanitizeErrorMessage } from "../edstem/errors";
import { defaultI18n, I18n } from "../i18n";
import { ExportRunSummary, SyncRunStatus } from "../sync/types";

export interface NotificationApi {
  create(id: string, options: chrome.notifications.NotificationOptions): Promise<string> | string | void;
  clear?(id: string): Promise<boolean> | boolean | void;
  onClicked: {
    addListener(listener: (notificationId: string) => void): void;
  };
}

export interface NotificationRuntimeApi {
  getURL(path: string): string;
}

export interface NotificationTabsApi {
  create(options: { url: string }): Promise<chrome.tabs.Tab> | void;
}

export interface NotificationDeps {
  notifications?: NotificationApi;
  runtime?: NotificationRuntimeApi;
  tabs?: NotificationTabsApi;
  t?: I18n;
}

const NOTIFICATION_PREFIX = "edstemArchive.export.";
const RESULT_PAGE = "popup.html";

export function notificationIdForRun(runId: string): string {
  return `${NOTIFICATION_PREFIX}${runId}`;
}

export async function notifyExportResult(run: ExportRunSummary, deps: NotificationDeps = {}): Promise<string | undefined> {
  if (!isTerminalExportStatus(run.status)) {
    return undefined;
  }
  const notifications = deps.notifications ?? chrome.notifications;
  const t = deps.t ?? defaultI18n;
  const id = notificationIdForRun(run.runId);
  const issue = run.status !== "success";
  const title = issue ? t("notificationIssueTitle") : t("notificationCompleteTitle");
  const message = issue
    ? t("notificationIssueMessage", { succeeded: run.succeeded, attempted: run.attempted })
    : t("notificationCompleteMessage", { succeeded: run.succeeded, attempted: run.attempted });

  const created = await notifications.create(id, {
    type: "basic",
    iconUrl: "icon-128.png",
    title,
    message: sanitizeErrorMessage(message),
    priority: issue ? 1 : 0,
  });
  return created || id;
}

export function shouldNotifyStatus(status: SyncRunStatus | ExportRunSummary["status"]): boolean {
  return status === "success" || status === "partial" || status === "failed";
}

export function registerNotificationClickHandler(deps: NotificationDeps = {}): void {
  const notifications = deps.notifications ?? chrome.notifications;
  const runtime = deps.runtime ?? chrome.runtime;
  const tabs = deps.tabs ?? chrome.tabs;

  notifications.onClicked.addListener((notificationId) => {
    if (!notificationId.startsWith(NOTIFICATION_PREFIX)) {
      return;
    }
    notifications.clear?.(notificationId);
    void tabs.create({ url: runtime.getURL(RESULT_PAGE) });
  });
}

function isTerminalExportStatus(status: ExportRunSummary["status"]): boolean {
  return shouldNotifyStatus(status);
}
