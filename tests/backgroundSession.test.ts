import { describe, expect, it } from "vitest";

import { isBackgroundRequest } from "../src/background/messages";
import { GET_CURRENT_COURSE, GET_SESSION_SNAPSHOT, OPEN_EDSTEM } from "../src/background/messageTypes";
import {
  authExpiredPaused,
  detectActiveEdstemContext,
  detectActiveEdstemOrigin,
  EdstemContext,
  EdstemContextResolver,
  isEdstemHostname,
  loadSessionSnapshot,
  SessionClient,
  SidebarCourseProvider,
} from "../src/background/session";
import { EdstemResult } from "../src/edstem/errors";

function clientReturning(result: EdstemResult<unknown>): SessionClient {
  return async <T>() => result as EdstemResult<T>;
}

function recordingClient(byPath: Record<string, EdstemResult<unknown>>, fallback?: EdstemResult<unknown>) {
  const calls: string[] = [];
  const client: SessionClient = async <T>(path: string) => {
    calls.push(path);
    const result = byPath[path] ?? fallback;
    if (!result) {
      throw new Error(`No mocked result for path: ${path}`);
    }
    return result as EdstemResult<T>;
  };
  return { client, calls };
}

function contextResolver(value: EdstemContext | null): EdstemContextResolver {
  return async () => value;
}

const noSidebar: SidebarCourseProvider = async () => [];

function makeTabsQuery(activeUrl?: string, fallbackUrls: string[] = []) {
  return async (queryInfo: chrome.tabs.QueryInfo): Promise<Array<Pick<chrome.tabs.Tab, "url">>> => {
    if (queryInfo.active) {
      return activeUrl ? [{ url: activeUrl }] : [];
    }
    return fallbackUrls.map((url) => ({ url }));
  };
}

describe("loadSessionSnapshot", () => {
  it("accepts session, active-course, and open commands as background messages", () => {
    expect(isBackgroundRequest({ type: GET_SESSION_SNAPSHOT })).toBe(true);
    expect(isBackgroundRequest({ type: GET_CURRENT_COURSE })).toBe(true);
    expect(isBackgroundRequest({ type: OPEN_EDSTEM })).toBe(true);
  });

  it("returns signed-in state with normalized courses", async () => {
    const snapshot = await loadSessionSnapshot(
      clientReturning({
        ok: true,
        status: 200,
        data: { courses: [{ id: "101", name: "Example Algorithms" }] },
      }),
      noSidebar,
      contextResolver(null),
    );

    expect(snapshot).toEqual({
      state: "signed_in",
      courses: [
        {
          id: "101",
          name: "Example Algorithms",
          url: "https://edstem.org/us/courses/101/discussion/",
          source: "api",
        },
      ],
    });
  });

  it("uses visible page courses before probing /api/user", async () => {
    const calls: string[] = [];
    const client: SessionClient = async (path) => {
      calls.push(path);
      throw new Error("session probe should not run when page courses are visible");
    };

    const snapshot = await loadSessionSnapshot(
      client,
      async () => [
        {
          id: "5145",
          name: "Foundations of data science",
          url: "https://edstem.org/au/courses/5145/discussion/",
          source: "sidebar",
        },
      ],
      contextResolver({ origin: "https://edstem.org", regionCode: "au" }),
    );

    expect(calls).toEqual([]);
    expect(snapshot).toEqual({
      state: "signed_in",
      courses: [
        {
          id: "5145",
          name: "Foundations of data science",
          url: "https://edstem.org/au/courses/5145/discussion/",
          source: "sidebar",
        },
      ],
    });
  });

  it("tries the region-prefixed path first when the active tab exposes one", async () => {
    const { client, calls } = recordingClient({
      "/au/api/user": {
        ok: true,
        status: 200,
        data: { courses: [{ id: "777", name: "FIT5057" }] },
      },
    });

    const snapshot = await loadSessionSnapshot(
      client,
      noSidebar,
      contextResolver({ origin: "https://edstem.org", regionCode: "au" }),
    );

    expect(calls).toEqual(["/au/api/user"]);
    expect(snapshot.state).toBe("signed_in");
  });

  it("falls back to the bare /api/user path when the region-prefixed path returns 401", async () => {
    const { client, calls } = recordingClient({
      "/au/api/user": { ok: false, kind: "unauthenticated", message: "Please log in." },
      "/api/user": {
        ok: true,
        status: 200,
        data: { courses: [{ id: "888", name: "FIT5145" }] },
      },
    });

    const snapshot = await loadSessionSnapshot(
      client,
      noSidebar,
      contextResolver({ origin: "https://edstem.org", regionCode: "au" }),
    );

    expect(calls).toEqual(["/au/api/user", "/api/user"]);
    expect(snapshot.state).toBe("signed_in");
  });

  it("falls back to the bare /api/user path when the region-prefixed path returns 404", async () => {
    const { client, calls } = recordingClient({
      "/au/api/user": {
        ok: false,
        kind: "unexpected_status",
        status: 404,
        message: "Edstem returned HTTP 404.",
      },
      "/api/user": {
        ok: true,
        status: 200,
        data: { courses: [{ id: "999", name: "FIT5225" }] },
      },
    });

    const snapshot = await loadSessionSnapshot(
      client,
      noSidebar,
      contextResolver({ origin: "https://edstem.org", regionCode: "au" }),
    );

    expect(calls).toEqual(["/au/api/user", "/api/user"]);
    expect(snapshot.state).toBe("signed_in");
  });

  it("falls back to the bare /api/user path when the region-prefixed path is not JSON", async () => {
    const { client, calls } = recordingClient({
      "/au/api/user": {
        ok: false,
        kind: "parse_error",
        status: 200,
        message: "Request failed.",
      },
      "/api/user": {
        ok: true,
        status: 200,
        data: { courses: [{ id: "5145", name: "Foundations of data science" }] },
      },
    });

    const snapshot = await loadSessionSnapshot(
      client,
      noSidebar,
      contextResolver({ origin: "https://edstem.org", regionCode: "au" }),
    );

    expect(calls).toEqual(["/au/api/user", "/api/user"]);
    expect(snapshot.state).toBe("signed_in");
  });

  it("reports the bare /api/user diagnostic when the region fallback also fails", async () => {
    const { client, calls } = recordingClient({
      "/au/api/user": {
        ok: false,
        kind: "parse_error",
        status: 200,
        message: "Request failed.",
      },
      "/api/user": {
        ok: false,
        kind: "network_error",
        message: "Request failed.",
      },
    });

    const snapshot = await loadSessionSnapshot(
      client,
      noSidebar,
      contextResolver({ origin: "https://edstem.org", regionCode: "au" }),
    );

    expect(calls).toEqual(["/au/api/user", "/api/user"]);
    expect(snapshot).toEqual({
      state: "connection_problem",
      message: "Request failed.",
      diagnostic: "https://edstem.org/api/user",
    });
  });

  it("reports needs_login with diagnostic when every probed path returns 401", async () => {
    const { client, calls } = recordingClient({
      "/au/api/user": { ok: false, kind: "unauthenticated", message: "Please log in." },
      "/api/user": { ok: false, kind: "unauthenticated", message: "Please log in." },
    });

    const snapshot = await loadSessionSnapshot(
      client,
      noSidebar,
      contextResolver({ origin: "https://edstem.org", regionCode: "au" }),
    );

    expect(calls).toEqual(["/au/api/user", "/api/user"]);
    expect(snapshot.state).toBe("needs_login");
    if (snapshot.state === "needs_login") {
      expect(snapshot.diagnostic).toBe("https://edstem.org/api/user");
    }
  });

  it("uses only the bare path when no region segment is detected", async () => {
    const { client, calls } = recordingClient({
      "/api/user": { ok: false, kind: "unauthenticated", message: "Please log in." },
    });

    const snapshot = await loadSessionSnapshot(
      client,
      noSidebar,
      contextResolver({ origin: "https://us.edstem.org" }),
    );

    expect(calls).toEqual(["/api/user"]);
    expect(snapshot.state).toBe("needs_login");
    if (snapshot.state === "needs_login") {
      expect(snapshot.diagnostic).toBe("https://us.edstem.org/api/user");
    }
  });

  it("returns empty-course state for a valid empty list", async () => {
    await expect(
      loadSessionSnapshot(
        clientReturning({ ok: true, status: 200, data: { courses: [] } }),
        noSidebar,
        contextResolver(null),
      ),
    ).resolves.toEqual({ state: "empty_courses" });
  });

  it("uses sidebar fallback when API course list is empty", async () => {
    await expect(
      loadSessionSnapshot(
        clientReturning({ ok: true, status: 200, data: { courses: [] } }),
        async () => [
          {
            id: "202",
            name: "Example Biology",
            url: "https://edstem.org/us/courses/202/discussion/",
            source: "sidebar",
          },
        ],
        contextResolver(null),
      ),
    ).resolves.toEqual({
      state: "signed_in",
      courses: [
        {
          id: "202",
          name: "Example Biology",
          url: "https://edstem.org/us/courses/202/discussion/",
          source: "sidebar",
        },
      ],
    });
  });

  it("uses sidebar fallback on network failure when sidebar courses are available", async () => {
    await expect(
      loadSessionSnapshot(
        clientReturning({ ok: false, kind: "network_error", message: "Network failed." }),
        async () => [
          {
            id: "303",
            name: "Example Studio",
            url: "https://edstem.org/us/courses/303/discussion/",
            source: "sidebar",
          },
        ],
        contextResolver(null),
      ),
    ).resolves.toEqual({
      state: "signed_in",
      courses: [
        {
          id: "303",
          name: "Example Studio",
          url: "https://edstem.org/us/courses/303/discussion/",
          source: "sidebar",
        },
      ],
    });
  });

  it("returns needs-login state for unauthenticated result", async () => {
    await expect(
      loadSessionSnapshot(
        clientReturning({ ok: false, kind: "unauthenticated", message: "Please log in." }),
        noSidebar,
        contextResolver(null),
      ),
    ).resolves.toEqual({ state: "needs_login", diagnostic: "https://edstem.org/api/user" });
  });

  it("returns connection problem for sanitized failures", async () => {
    await expect(
      loadSessionSnapshot(
        clientReturning({ ok: false, kind: "network_error", message: "Network failed." }),
        async () => [],
        contextResolver(null),
      ),
    ).resolves.toEqual({
      state: "connection_problem",
      message: "Network failed.",
      diagnostic: "https://edstem.org/api/user",
    });
  });

  it("defines auth-expired paused contract for the sync phase", () => {
    expect(authExpiredPaused("thread 12")).toEqual({
      state: "auth_expired_paused",
      checkpointLabel: "thread 12",
    });
  });
});

describe("isEdstemHostname", () => {
  it("accepts the bare edstem.org host and any subdomain", () => {
    expect(isEdstemHostname("edstem.org")).toBe(true);
    expect(isEdstemHostname("us.edstem.org")).toBe(true);
    expect(isEdstemHostname("au.edstem.org")).toBe(true);
    expect(isEdstemHostname("eu.edstem.org")).toBe(true);
    expect(isEdstemHostname("sandbox.edstem.org")).toBe(true);
  });

  it("rejects unrelated and look-alike hosts", () => {
    expect(isEdstemHostname("example.com")).toBe(false);
    expect(isEdstemHostname("edstem.org.evil.com")).toBe(false);
    expect(isEdstemHostname("notedstem.org")).toBe(false);
    expect(isEdstemHostname("edstem.com")).toBe(false);
  });
});

describe("detectActiveEdstemContext", () => {
  it("extracts a region segment when the path starts with a 2-4 letter prefix", async () => {
    const context = await detectActiveEdstemContext(
      makeTabsQuery("https://edstem.org/au/dashboard"),
    );
    expect(context).toEqual({ origin: "https://edstem.org", regionCode: "au" });
  });

  it("does not treat /api/ as a region segment", async () => {
    const context = await detectActiveEdstemContext(
      makeTabsQuery("https://edstem.org/api/whoami"),
    );
    expect(context).toEqual({ origin: "https://edstem.org", regionCode: undefined });
  });

  it("does not extract a region for paths whose first segment is longer than 4 chars", async () => {
    const context = await detectActiveEdstemContext(
      makeTabsQuery("https://edstem.org/dashboard"),
    );
    expect(context).toEqual({ origin: "https://edstem.org", regionCode: undefined });
  });

  it("returns no region when the host is a subdomain (region is in the host, not the path)", async () => {
    const context = await detectActiveEdstemContext(
      makeTabsQuery("https://us.edstem.org/courses/7/discussion"),
    );
    expect(context).toEqual({ origin: "https://us.edstem.org", regionCode: undefined });
  });

  it("returns null when no Edstem tab is open", async () => {
    const context = await detectActiveEdstemContext(
      makeTabsQuery("https://github.com/some/repo", []),
    );
    expect(context).toBeNull();
  });
});

describe("detectActiveEdstemOrigin", () => {
  it("returns the active tab origin when it is an Edstem subdomain", async () => {
    const origin = await detectActiveEdstemOrigin(
      makeTabsQuery("https://au.edstem.org/courses/123/discussion"),
    );
    expect(origin).toBe("https://au.edstem.org");
  });

  it("returns the active tab origin for the bare edstem.org host", async () => {
    const origin = await detectActiveEdstemOrigin(
      makeTabsQuery("https://edstem.org/us/courses/42/discussion"),
    );
    expect(origin).toBe("https://edstem.org");
  });

  it("falls back to any open Edstem tab when the active tab is not Edstem", async () => {
    const origin = await detectActiveEdstemOrigin(
      makeTabsQuery("https://github.com/some/repo", [
        "https://us.edstem.org/courses/7/discussion",
      ]),
    );
    expect(origin).toBe("https://us.edstem.org");
  });

  it("returns null when no Edstem tab is open anywhere", async () => {
    const origin = await detectActiveEdstemOrigin(
      makeTabsQuery("https://github.com/some/repo", []),
    );
    expect(origin).toBeNull();
  });

  it("returns null when chrome.tabs query throws", async () => {
    const origin = await detectActiveEdstemOrigin(async () => {
      throw new Error("tabs unavailable");
    });
    expect(origin).toBeNull();
  });

  it("rejects non-https Edstem URLs to keep the origin probe locked to TLS", async () => {
    const origin = await detectActiveEdstemOrigin(
      makeTabsQuery("http://edstem.org/us/courses/1/discussion"),
    );
    expect(origin).toBeNull();
  });

  it("rejects look-alike hostnames so a hostile tab cannot redirect the session probe", async () => {
    const origin = await detectActiveEdstemOrigin(
      makeTabsQuery("https://edstem.org.evil.example/courses/1"),
    );
    expect(origin).toBeNull();
  });
});
