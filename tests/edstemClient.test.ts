import { describe, expect, it } from "vitest";

import { edstemFetch, FetchLike } from "../src/edstem/client";
import { sanitizeErrorMessage, sanitizeUrlForDisplay } from "../src/edstem/errors";

function jsonResponse(status: number, body: unknown, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  });
}

function fetchReturning(response: Response): FetchLike {
  return async () => response;
}

describe("edstemFetch", () => {
  it("returns typed success for 200 JSON", async () => {
    const result = await edstemFetch<{ ok: boolean }>("/api/user", {
      fetchImpl: fetchReturning(jsonResponse(200, { ok: true })),
    });

    expect(result).toEqual({ ok: true, data: { ok: true }, status: 200 });
  });

  it.each([
    [401, "unauthenticated"],
    [403, "forbidden"],
    [500, "unexpected_status"],
  ] as const)("classifies HTTP %s", async (status, kind) => {
    const result = await edstemFetch("/api/user", {
      fetchImpl: fetchReturning(jsonResponse(status, { error: "hidden" })),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.kind).toBe(kind);
      expect(result.url).toBe("https://edstem.org/api/user");
    }
  });

  it("preserves Retry-After metadata for rate limiting", async () => {
    const result = await edstemFetch("/api/user", {
      fetchImpl: fetchReturning(jsonResponse(429, {}, { "Retry-After": "120" })),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.kind).toBe("rate_limited");
      expect(result.retryAfterRaw).toBe("120");
      expect(result.retryAfterSeconds).toBe(120);
    }
  });

  it("classifies rejected fetch as network failure", async () => {
    const result = await edstemFetch("/api/user?secret=value#frag", {
      fetchImpl: async () => {
        throw new Error("Failed https://edstem.org/api/user?secret=value#frag");
      },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.kind).toBe("network_error");
      expect(result.message).not.toContain("secret=value");
      expect(result.message).not.toContain("#frag");
    }
  });

  it("classifies invalid JSON as parse failure", async () => {
    const result = await edstemFetch("/api/user", {
      fetchImpl: async () =>
        new Response("not json", {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.kind).toBe("parse_error");
    }
  });

  it("rejects disallowed request targets before calling fetch", async () => {
    let called = false;
    const result = await edstemFetch("https://example.com/api", {
      fetchImpl: async () => {
        called = true;
        return jsonResponse(200, {});
      },
    });

    expect(called).toBe(false);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.kind).toBe("network_error");
    }
  });

  it("uses browser-managed credentials without constructing credential headers", async () => {
    let init: RequestInit | undefined;
    await edstemFetch("/api/user", {
      fetchImpl: async (_input, requestInit) => {
        init = requestInit;
        return jsonResponse(200, {});
      },
    });

    expect(init?.credentials).toBe("include");
    expect(JSON.stringify(init?.headers)).not.toContain("Bearer");
  });
});

describe("sanitizers", () => {
  it("strips query strings and fragments from display URLs", () => {
    expect(sanitizeUrlForDisplay("https://edstem.org/api/user?secret=value#frag")).toBe(
      "https://edstem.org/api/user",
    );
  });

  it("sanitizes embedded URLs in messages", () => {
    expect(
      sanitizeErrorMessage("Failed at https://edstem.org/api/user?secret=value#frag"),
    ).not.toContain("secret=value");
  });
});
