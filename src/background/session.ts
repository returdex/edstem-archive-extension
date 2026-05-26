import { edstemFetch } from "../edstem/client";
import { CourseSummary, normalizeCourses } from "../edstem/courses";
import { EdstemResult } from "../edstem/errors";
import { GET_SIDEBAR_COURSES } from "./messageTypes";

export const EDSTEM_ORIGIN = "https://edstem.org";
const USER_SESSION_PATH = "/api/user";

export type SessionSnapshot =
  | { state: "checking" }
  | { state: "signed_in"; courses: CourseSummary[] }
  | { state: "empty_courses" }
  | { state: "needs_login"; diagnostic?: string }
  | { state: "connection_problem"; message: string; diagnostic?: string }
  | { state: "auth_expired_paused"; checkpointLabel?: string };

export interface EdstemContext {
  origin: string;
  regionCode?: string;
}

export type SessionClient = <T>(path: string) => Promise<EdstemResult<T>>;
export type SidebarCourseProvider = () => Promise<CourseSummary[]>;
export type EdstemContextResolver = () => Promise<EdstemContext | null>;
export type EdstemOriginResolver = () => Promise<string | null>;

export function isEdstemHostname(hostname: string): boolean {
  return hostname === "edstem.org" || hostname.endsWith(".edstem.org");
}

const REGION_CODE_PATTERN = /^[a-z]{2,4}$/;

function extractEdstemContext(rawUrl: string | undefined): EdstemContext | null {
  if (!rawUrl) {
    return null;
  }
  try {
    const url = new URL(rawUrl);
    if (url.protocol !== "https:" || !isEdstemHostname(url.hostname)) {
      return null;
    }
    const firstPathPart = url.pathname.split("/").filter(Boolean)[0];
    const regionCode =
      firstPathPart && REGION_CODE_PATTERN.test(firstPathPart) && firstPathPart !== "api"
        ? firstPathPart
        : undefined;
    return { origin: url.origin, regionCode };
  } catch {
    // not a parseable URL
  }
  return null;
}

export async function detectActiveEdstemContext(
  queryTabs: (queryInfo: chrome.tabs.QueryInfo) => Promise<Array<Pick<chrome.tabs.Tab, "url">>> = (queryInfo) =>
    chrome.tabs.query(queryInfo),
): Promise<EdstemContext | null> {
  try {
    const [activeTab] = await queryTabs({ active: true, currentWindow: true });
    const activeContext = extractEdstemContext(activeTab?.url);
    if (activeContext) {
      return activeContext;
    }
    const edstemTabs = await queryTabs({ url: ["https://edstem.org/*", "https://*.edstem.org/*"] });
    for (const tab of edstemTabs) {
      const context = extractEdstemContext(tab?.url);
      if (context) {
        return context;
      }
    }
  } catch {
    // chrome.tabs may be unavailable in non-extension contexts
  }
  return null;
}

export async function detectActiveEdstemOrigin(
  queryTabs?: (queryInfo: chrome.tabs.QueryInfo) => Promise<Array<Pick<chrome.tabs.Tab, "url">>>,
): Promise<string | null> {
  const context = await detectActiveEdstemContext(queryTabs);
  return context?.origin ?? null;
}

function createDefaultSessionClient(originResolver: EdstemOriginResolver): SessionClient {
  return async <T>(path: string) => {
    const origin = await originResolver();
    return edstemFetch<T>(path, origin ? { baseOrigin: origin } : {});
  };
}

export async function loadSessionSnapshot(
  client: SessionClient = createDefaultSessionClient(detectActiveEdstemOrigin),
  sidebarProvider: SidebarCourseProvider = loadSidebarCoursesFromActiveTab,
  contextResolver: EdstemContextResolver = detectActiveEdstemContext,
): Promise<SessionSnapshot> {
  const context = await contextResolver();
  if (context) {
    const sidebarCourses = await sidebarProvider();
    if (sidebarCourses.length > 0) {
      return { state: "signed_in", courses: sidebarCourses };
    }
  }

  const candidatePaths = buildCandidateSessionPaths(context);

  let lastUnauthDiagnostic: string | undefined;
  let lastConnectionError: { message: string; diagnostic?: string } | undefined;

  for (const path of candidatePaths) {
    const result = await client<unknown>(path);
    if (result.ok) {
      const courses = normalizeCourses(result.data);
      if (courses.length === 0) {
        const sidebarCourses = await sidebarProvider();
        if (sidebarCourses.length > 0) {
          return { state: "signed_in", courses: sidebarCourses };
        }
        return { state: "empty_courses" };
      }
      return { state: "signed_in", courses };
    }

    if (result.kind === "unauthenticated") {
      lastUnauthDiagnostic = describeAttempt(context?.origin, path);
      continue;
    }

    if (result.kind === "network_error") {
      const sidebarCourses = await sidebarProvider();
      if (sidebarCourses.length > 0) {
        return { state: "signed_in", courses: sidebarCourses };
      }
      lastConnectionError = { message: result.message, diagnostic: describeAttempt(context?.origin, path) };
      continue;
    }

    if (shouldTryNextSessionPath(path, candidatePaths)) {
      lastConnectionError = { message: result.message, diagnostic: describeAttempt(context?.origin, path) };
      continue;
    }

    return {
      state: "connection_problem",
      message: result.message,
      diagnostic: describeAttempt(context?.origin, path),
    };
  }

  if (lastUnauthDiagnostic !== undefined) {
    return { state: "needs_login", diagnostic: lastUnauthDiagnostic };
  }
  if (lastConnectionError) {
    return { state: "connection_problem", ...lastConnectionError };
  }
  return { state: "needs_login" };
}

function buildCandidateSessionPaths(context: EdstemContext | null): string[] {
  if (context?.regionCode) {
    return [`/${context.regionCode}${USER_SESSION_PATH}`, USER_SESSION_PATH];
  }
  return [USER_SESSION_PATH];
}

function shouldTryNextSessionPath(path: string, candidatePaths: string[]): boolean {
  return path !== USER_SESSION_PATH && candidatePaths.indexOf(path) < candidatePaths.length - 1;
}

function describeAttempt(origin: string | undefined, path: string): string {
  return `${origin ?? EDSTEM_ORIGIN}${path}`;
}

export function authExpiredPaused(checkpointLabel?: string): SessionSnapshot {
  return {
    state: "auth_expired_paused",
    checkpointLabel,
  };
}

async function loadSidebarCoursesFromActiveTab(): Promise<CourseSummary[]> {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) {
      return [];
    }

    const response = await chrome.tabs.sendMessage(tab.id, { type: GET_SIDEBAR_COURSES });
    if (!response || typeof response !== "object" || !Array.isArray(response.courses)) {
      return [];
    }

    return response.courses as CourseSummary[];
  } catch {
    return [];
  }
}
