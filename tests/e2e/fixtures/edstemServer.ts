/**
 * Synthetic EDstem fixture server for Phase 17 E2E tests.
 *
 * Starts a local HTTP server that serves synthetic EDstem API responses
 * matching the schemas consumed by the extension at runtime. All data is
 * entirely synthetic — no real course names, course IDs, student names,
 * instructor names, cookies, auth headers, or private thread bodies appear
 * in any fixture response.
 *
 * Configurable states via the `X-Fixture-State` request header:
 *   (not set / "signed-in") → normal signed-in responses
 *   "auth-expired"          → 401 Unauthorized
 *   "rate-limited"          → 429 Too Many Requests
 *   "error"                 → 500 Internal Server Error
 *
 * Private-data marker guard: fixture IDs and names must not include known
 * private course/user markers. Tests in packageInventory.test.ts enforce this.
 *
 * Schema alignment: responses mirror the normalization logic in
 * extension/src/edstem/courses.ts and extension/src/sync/provider.ts so the
 * extension's own parsers can handle them without modification.
 */

import * as http from "node:http";
import { AddressInfo } from "node:net";

// ─── Synthetic fixture data ───────────────────────────────────────────────────
// All identifiers, names, and content below are synthetic placeholders.
// They must never include real EDstem course IDs, student names, instructor
// names, private thread content, or other private data.

// The real EDstem /api/user response embeds course memberships in the payload.
// The extension's loadSessionSnapshot() calls normalizeCourses() on this response
// to determine the signed-in course list, so the user object must contain a
// "courses" array that normalizeCourseRecord() can parse.
const SYNTHETIC_USER = {
  id: "synthetic-user-001",
  name: "Test Student (Synthetic)",
  email: "test@example.invalid",
  role: "student",
  courses: [
    {
      id: "synthetic-course-101",
      name: "Introduction to Synthetic Computing",
      url: "https://edstem.org/us/courses/synthetic-course-101/discussion/",
      source: "api",
    },
    {
      id: "synthetic-course-202",
      name: "Advanced Synthetic Algorithms",
      url: "https://edstem.org/us/courses/synthetic-course-202/discussion/",
      source: "api",
    },
  ],
};

const SYNTHETIC_COURSES = [
  {
    id: "synthetic-course-101",
    name: "Introduction to Synthetic Computing",
    url: "https://edstem.org/us/courses/synthetic-course-101/discussion/",
    source: "api",
  },
  {
    id: "synthetic-course-202",
    name: "Advanced Synthetic Algorithms",
    url: "https://edstem.org/us/courses/synthetic-course-202/discussion/",
    source: "api",
  },
];

const SYNTHETIC_THREADS: Record<string, unknown[]> = {
  "synthetic-course-101": [
    {
      id: "thread-101-001",
      title: "Welcome to Synthetic Computing",
      number: 1,
      category: "general",
      created_at: "2025-01-01T10:00:00Z",
      updated_at: "2025-01-02T10:00:00Z",
      user: { name: "Synthetic Instructor", role: "staff" },
    },
    {
      id: "thread-101-002",
      title: "Assignment 1 Clarification (Synthetic)",
      number: 2,
      category: "assignments",
      created_at: "2025-01-03T10:00:00Z",
      updated_at: "2025-01-04T10:00:00Z",
      user: { name: "Test Student (Synthetic)", role: "student" },
    },
  ],
  "synthetic-course-202": [
    {
      id: "thread-202-001",
      title: "Synthetic Algorithm Complexity",
      number: 1,
      category: "general",
      created_at: "2025-01-05T10:00:00Z",
      updated_at: "2025-01-06T10:00:00Z",
      user: { name: "Synthetic TA", role: "staff" },
    },
  ],
};

const SYNTHETIC_THREAD_DETAIL: Record<string, unknown> = {
  "thread-101-001": {
    thread: {
      id: "thread-101-001",
      title: "Welcome to Synthetic Computing",
      number: 1,
      category: "general",
      created_at: "2025-01-01T10:00:00Z",
      updated_at: "2025-01-02T10:00:00Z",
      user: { name: "Synthetic Instructor", role: "staff" },
      posts: [
        {
          id: "post-101-001-001",
          body: "Welcome to this synthetic course. This is placeholder content only.",
          user: { name: "Synthetic Instructor", role: "staff" },
          created_at: "2025-01-01T10:00:00Z",
          updated_at: "2025-01-01T10:00:00Z",
        },
        {
          id: "post-101-001-002",
          body: "Thank you! Looking forward to this synthetic course.",
          user: { name: "Test Student (Synthetic)", role: "student" },
          created_at: "2025-01-01T11:00:00Z",
          updated_at: "2025-01-01T11:00:00Z",
        },
      ],
    },
  },
  "thread-101-002": {
    thread: {
      id: "thread-101-002",
      title: "Assignment 1 Clarification (Synthetic)",
      number: 2,
      category: "assignments",
      created_at: "2025-01-03T10:00:00Z",
      updated_at: "2025-01-04T10:00:00Z",
      user: { name: "Test Student (Synthetic)", role: "student" },
      posts: [
        {
          id: "post-101-002-001",
          body: "Synthetic question about the synthetic assignment.",
          user: { name: "Test Student (Synthetic)", role: "student" },
          created_at: "2025-01-03T10:00:00Z",
          updated_at: "2025-01-03T10:00:00Z",
        },
        {
          id: "post-101-002-002",
          body: "Synthetic clarification answer from the instructor.",
          user: { name: "Synthetic Instructor", role: "staff" },
          created_at: "2025-01-04T10:00:00Z",
          updated_at: "2025-01-04T10:00:00Z",
        },
      ],
    },
  },
  "thread-202-001": {
    thread: {
      id: "thread-202-001",
      title: "Synthetic Algorithm Complexity",
      number: 1,
      category: "general",
      created_at: "2025-01-05T10:00:00Z",
      updated_at: "2025-01-06T10:00:00Z",
      user: { name: "Synthetic TA", role: "staff" },
      posts: [
        {
          id: "post-202-001-001",
          body: "Synthetic lecture notes on algorithm complexity.",
          user: { name: "Synthetic TA", role: "staff" },
          created_at: "2025-01-05T10:00:00Z",
          updated_at: "2025-01-05T10:00:00Z",
        },
      ],
    },
  },
};

// ─── Route table ─────────────────────────────────────────────────────────────

type FixtureState = "signed-in" | "auth-expired" | "rate-limited" | "error";

function resolveFixtureState(headers: http.IncomingHttpHeaders): FixtureState {
  const override = headers["x-fixture-state"];
  if (override === "auth-expired") return "auth-expired";
  if (override === "rate-limited") return "rate-limited";
  if (override === "error") return "error";
  return "signed-in";
}

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(payload),
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "x-fixture-state, content-type",
  });
  res.end(payload);
}

function handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
  const url = new URL(req.url ?? "/", "http://localhost");
  const state = resolveFixtureState(req.headers);
  const path = url.pathname;

  // Handle CORS pre-flight
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "x-fixture-state, content-type",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
    });
    res.end();
    return;
  }

  // Apply global state overrides before routing
  if (state === "auth-expired") {
    sendJson(res, 401, { error: "Unauthorized", message: "Session expired (synthetic)" });
    return;
  }
  if (state === "rate-limited") {
    res.writeHead(429, {
      "Content-Type": "application/json",
      "Retry-After": "5",
      "Access-Control-Allow-Origin": "*",
    });
    res.end(JSON.stringify({ error: "Too Many Requests", message: "Rate limited (synthetic)" }));
    return;
  }
  if (state === "error") {
    sendJson(res, 500, { error: "Internal Server Error", message: "Synthetic error state" });
    return;
  }

  // Normal signed-in routing
  if (path === "/api/user") {
    sendJson(res, 200, SYNTHETIC_USER);
    return;
  }

  if (path === "/api/courses") {
    sendJson(res, 200, { courses: SYNTHETIC_COURSES });
    return;
  }

  // /api/courses/:courseId/threads
  const threadListMatch = /^\/api\/courses\/([^/]+)\/threads$/.exec(path);
  if (threadListMatch) {
    const courseId = decodeURIComponent(threadListMatch[1]);
    const threads = SYNTHETIC_THREADS[courseId] ?? [];
    sendJson(res, 200, {
      threads,
      total: threads.length,
      next_cursor: null,
    });
    return;
  }

  // /api/threads/:threadId
  const threadDetailMatch = /^\/api\/threads\/([^/]+)$/.exec(path);
  if (threadDetailMatch) {
    const threadId = decodeURIComponent(threadDetailMatch[1]);
    const detail = SYNTHETIC_THREAD_DETAIL[threadId];
    if (detail) {
      sendJson(res, 200, detail);
    } else {
      sendJson(res, 404, { error: "Not Found", message: `Thread ${threadId} not found in synthetic fixture` });
    }
    return;
  }

  sendJson(res, 404, { error: "Not Found", message: `No synthetic fixture for ${path}` });
}

// ─── Server lifecycle ─────────────────────────────────────────────────────────

export interface EdstemFixtureServer {
  baseUrl: string;
  port: number;
  stop(): Promise<void>;
}

/**
 * Patches the global `fetch` function inside the extension's service worker
 * so that all requests to `https://edstem.org/` are transparently redirected
 * to the synthetic fixture server.
 *
 * This works by injecting a fetch wrapper via Playwright's Worker.evaluate()
 * API, which runs code inside the service worker context. The wrapper rewrites
 * the URL from https://edstem.org/... to http://127.0.0.1:<port>/... before
 * calling the real fetch.
 *
 * NOTE: Must be called BEFORE any background fetch occurs (i.e., before the
 * popup is opened). The patch persists for the lifetime of the service worker
 * context since service workers persist across test cases within a beforeAll.
 */
export async function patchServiceWorkerFetch(
  serviceWorker: import("@playwright/test").Worker,
  server: EdstemFixtureServer,
  options?: { fixtureState?: FixtureState },
): Promise<void> {
  await serviceWorker.evaluate(
    ({ baseUrl, fixtureState }: { baseUrl: string; fixtureState: string | undefined }) => {
      const originalFetch = globalThis.fetch.bind(globalThis);
      globalThis.fetch = function patchedFetch(
        input: RequestInfo | URL,
        init?: RequestInit,
      ): Promise<Response> {
        const url =
          input instanceof Request
            ? input.url
            : typeof input === "string"
              ? input
              : String(input);

        // Rewrite edstem.org requests to the synthetic fixture server.
        if (url.startsWith("https://edstem.org/")) {
          const rewritten = url.replace("https://edstem.org", baseUrl);
          // Strip credentials — the fixture server is on http://127.0.0.1 and
          // cannot satisfy the credentials:include + CORS combination.
          // Inject the fixture state header if specified.
          const extraHeaders: Record<string, string> = fixtureState
            ? { "x-fixture-state": fixtureState }
            : {};
          const patchedInit: RequestInit = {
            ...init,
            credentials: "omit",
            headers: {
              ...((init?.headers instanceof Headers
                ? Object.fromEntries((init.headers as Headers).entries())
                : (init?.headers as Record<string, string> | undefined)) ?? {}),
              ...extraHeaders,
            },
          };
          if (input instanceof Request) {
            return originalFetch(new Request(rewritten, { ...input, credentials: "omit" }), patchedInit);
          }
          return originalFetch(rewritten, patchedInit);
        }

        return originalFetch(input, init);
      };
    },
    { baseUrl: server.baseUrl, fixtureState: options?.fixtureState },
  );
}

/**
 * Patches `chrome.tabs.query` in the extension service worker to always return
 * a tab with the given URL. This simulates having a specific EDstem course page
 * as the active browser tab, independently of which Playwright page is focused.
 *
 * Call this before opening the popup to ensure `detectCurrentCourseFromActiveTab`
 * sees the correct URL for the active-tab gating tests.
 *
 * Pass `null` to restore the original behaviour (tab query returns normally).
 */
export async function patchServiceWorkerActiveTab(
  serviceWorker: import("@playwright/test").Worker,
  fakeActiveTabUrl: string | null,
): Promise<void> {
  await serviceWorker.evaluate((url: string | null) => {
    if (url === null) {
      // Restore original chrome.tabs.query if we patched it.
      if (typeof (globalThis as Record<string, unknown>).__originalTabsQuery === "function") {
        (chrome.tabs as unknown as Record<string, unknown>).query = (
          globalThis as Record<string, unknown>
        ).__originalTabsQuery as typeof chrome.tabs.query;
        delete (globalThis as Record<string, unknown>).__originalTabsQuery;
      }
      return;
    }

    // Save original only the first time.
    if (typeof (globalThis as Record<string, unknown>).__originalTabsQuery !== "function") {
      (globalThis as Record<string, unknown>).__originalTabsQuery = chrome.tabs.query.bind(chrome.tabs);
    }

    (chrome.tabs as unknown as Record<string, unknown>).query = (
      _queryInfo: chrome.tabs.QueryInfo,
      callback?: (result: chrome.tabs.Tab[]) => void,
    ): Promise<chrome.tabs.Tab[]> | void => {
      // Use a type cast so we are not tied to chrome type version differences.
      const fakeTab = {
        id: 9001,
        index: 0,
        windowId: 1,
        active: true,
        highlighted: true,
        pinned: false,
        incognito: false,
        selected: true,
        discarded: false,
        autoDiscardable: true,
        frozen: false,
        groupId: -1,
        url,
        title: "Synthetic EDstem Course (Test)",
      } as chrome.tabs.Tab;
      if (typeof callback === "function") {
        callback([fakeTab]);
        return;
      }
      return Promise.resolve([fakeTab]);
    };
  }, fakeActiveTabUrl);
}

/**
 * Routes all https://edstem.org/** requests in a Playwright BrowserContext to
 * the synthetic fixture server.
 *
 * Uses route.fulfill() (not route.continue()) because continue() does not allow
 * a protocol change from https to http. The fixture server response is fetched
 * via Node's http module and forwarded verbatim so headers (including
 * Content-Type) are preserved.
 *
 * Passing the `fixtureState` header allows individual tests to override the
 * fixture behaviour (e.g. "auth-expired", "rate-limited") per-request without
 * restarting the server.
 */
export async function routeEdstemToFixture(
  context: import("@playwright/test").BrowserContext,
  server: EdstemFixtureServer,
  options?: { fixtureState?: FixtureState },
): Promise<void> {
  await context.route("https://edstem.org/**", async (route) => {
    const originalUrl = new URL(route.request().url());
    const fixtureUrl = `${server.baseUrl}${originalUrl.pathname}${originalUrl.search}`;

    // Carry through any existing state header, or apply the override.
    const headers: Record<string, string> = {};
    if (options?.fixtureState) {
      headers["x-fixture-state"] = options.fixtureState;
    }

    try {
      const { status, responseHeaders, body } = await fetchViaNode(fixtureUrl, headers);
      await route.fulfill({ status, headers: responseHeaders, body });
    } catch {
      await route.fulfill({ status: 503, body: "fixture server unavailable" });
    }
  });
}

/**
 * Fetches a URL using Node's built-in http module and returns the status,
 * headers, and body. Used by routeEdstemToFixture to avoid protocol-mismatch
 * errors with Playwright's route.continue().
 */
function fetchViaNode(
  url: string,
  extraHeaders: Record<string, string> = {},
): Promise<{ status: number; responseHeaders: Record<string, string>; body: Buffer }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const options: http.RequestOptions = {
      hostname: parsed.hostname,
      port: parsed.port || 80,
      path: `${parsed.pathname}${parsed.search}`,
      method: "GET",
      headers: { Accept: "application/json", ...extraHeaders },
    };

    const req = http.request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => {
        const responseHeaders: Record<string, string> = {};
        for (const [key, value] of Object.entries(res.headers)) {
          if (value !== undefined) {
            responseHeaders[key] = Array.isArray(value) ? value.join(", ") : value;
          }
        }
        resolve({
          status: res.statusCode ?? 200,
          responseHeaders,
          body: Buffer.concat(chunks),
        });
      });
    });

    req.on("error", reject);
    req.end();
  });
}

/**
 * Starts the synthetic EDstem fixture server on a random available port.
 * Returns the server handle including the base URL for use in tests.
 */
export async function startEdstemFixtureServer(): Promise<EdstemFixtureServer> {
  const server = http.createServer(handleRequest);

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.removeListener("error", reject);
      resolve();
    });
  });

  const { port } = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${port}`;

  return {
    baseUrl,
    port,
    stop(): Promise<void> {
      return new Promise((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    },
  };
}
