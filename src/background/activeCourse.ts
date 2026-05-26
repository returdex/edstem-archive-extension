import { CourseSummary } from "../edstem/courses";
import { SessionSnapshot } from "./session";

export interface ParsedEdstemCourseUrl {
  courseId: string;
  url: string;
}

export type CurrentCourseEligibility =
  | { state: "eligible"; course: CourseSummary; tabUrl: string }
  | { state: "not_signed_in" }
  | { state: "not_edstem" }
  | { state: "not_course_page"; tabUrl: string }
  | { state: "course_not_visible"; courseId: string; tabUrl: string }
  | { state: "unavailable"; message: string };

export type QueryActiveTab = (
  queryInfo: chrome.tabs.QueryInfo,
) => Promise<Array<Pick<chrome.tabs.Tab, "url">>>;

export async function detectCurrentCourseFromActiveTab(
  session: SessionSnapshot,
  queryTabs: QueryActiveTab = (queryInfo) => chrome.tabs.query(queryInfo),
): Promise<CurrentCourseEligibility> {
  if (session.state !== "signed_in") {
    return { state: "not_signed_in" };
  }

  let tabs: Array<Pick<chrome.tabs.Tab, "url">>;
  try {
    tabs = await queryTabs({ active: true, lastFocusedWindow: true });
  } catch {
    return { state: "unavailable", message: "The active tab could not be inspected." };
  }

  const tabUrl = tabs[0]?.url;
  if (!tabUrl) {
    return { state: "unavailable", message: "No active browser tab was found." };
  }

  const parsed = parseEdstemCourseUrl(tabUrl);
  if (!parsed) {
    return isEdstemUrl(tabUrl) ? { state: "not_course_page", tabUrl } : { state: "not_edstem" };
  }

  const course = session.courses.find((candidate) => candidate.id === parsed.courseId);
  if (!course) {
    return { state: "course_not_visible", courseId: parsed.courseId, tabUrl };
  }

  return { state: "eligible", course, tabUrl };
}

export function parseEdstemCourseUrl(rawUrl: string): ParsedEdstemCourseUrl | null {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return null;
  }

  if (!isEdstemHost(url.hostname)) {
    return null;
  }

  const pathParts = url.pathname.split("/").filter(Boolean);
  const coursesIndex = pathParts.indexOf("courses");
  if (coursesIndex < 0 || !pathParts[coursesIndex + 1]) {
    return null;
  }

  return {
    courseId: decodeURIComponent(pathParts[coursesIndex + 1]),
    url: `${url.origin}${url.pathname}`,
  };
}

function isEdstemUrl(rawUrl: string): boolean {
  try {
    return isEdstemHost(new URL(rawUrl).hostname);
  } catch {
    return false;
  }
}

function isEdstemHost(hostname: string): boolean {
  return hostname === "edstem.org" || hostname.endsWith(".edstem.org");
}
