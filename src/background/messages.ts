import { detectCurrentCourseFromActiveTab, CurrentCourseEligibility } from "./activeCourse";
import { EDSTEM_ORIGIN, loadSessionSnapshot, SessionSnapshot } from "./session";
import { GET_CURRENT_COURSE, GET_SESSION_SNAPSHOT, OPEN_EDSTEM } from "./messageTypes";
import { isSyncBackgroundRequest } from "./sync";

export { GET_CURRENT_COURSE, GET_SESSION_SNAPSHOT, OPEN_EDSTEM } from "./messageTypes";

export interface SessionSnapshotRequest {
  type: typeof GET_SESSION_SNAPSHOT;
}

export interface CurrentCourseRequest {
  type: typeof GET_CURRENT_COURSE;
}

export interface OpenEdstemRequest {
  type: typeof OPEN_EDSTEM;
}

export type BackgroundRequest = SessionSnapshotRequest | CurrentCourseRequest | OpenEdstemRequest;

export function isBackgroundRequest(message: unknown): message is BackgroundRequest {
  if (!message || typeof message !== "object") {
    return false;
  }

  const type = (message as { type?: unknown }).type;
  return type === GET_SESSION_SNAPSHOT || type === GET_CURRENT_COURSE || type === OPEN_EDSTEM;
}

export async function getSessionSnapshot(): Promise<SessionSnapshot> {
  return loadSessionSnapshot();
}

export async function getCurrentCourse(): Promise<CurrentCourseEligibility> {
  return detectCurrentCourseFromActiveTab(await loadSessionSnapshot());
}

export function registerBackgroundMessageHandlers(): void {
  chrome.runtime.onMessage.addListener((message: unknown, _sender, sendResponse) => {
    if (isSyncBackgroundRequest(message)) {
      return undefined;
    }

    if (!isBackgroundRequest(message)) {
      return undefined;
    }

    if (message.type === GET_SESSION_SNAPSHOT) {
      void getSessionSnapshot().then(sendResponse);
      return true;
    }

    if (message.type === GET_CURRENT_COURSE) {
      void getCurrentCourse().then(sendResponse);
      return true;
    }

    if (message.type === OPEN_EDSTEM) {
      void chrome.tabs.create({ url: EDSTEM_ORIGIN }).then(() => sendResponse({ ok: true }));
      return true;
    }

    return undefined;
  });
}
