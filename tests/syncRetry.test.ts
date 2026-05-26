import { describe, expect, it } from "vitest";

import { nextRetryDecision } from "../src/sync/retry";

const now = new Date("2026-05-24T00:00:00.000Z");

describe("sync retry policy", () => {
  it("honors Retry-After seconds for rate limits", () => {
    expect(
      nextRetryDecision({
        kind: "rate_limited",
        retryAfterSeconds: 120,
        attempt: 0,
        now,
      }),
    ).toEqual({
      action: "retry",
      attempt: 1,
      delaySeconds: 120,
      nextAttemptAt: "2026-05-24T00:02:00.000Z",
    });
  });

  it("uses bounded exponential backoff with deterministic jitter", () => {
    expect(
      nextRetryDecision({
        kind: "network_error",
        attempt: 1,
        now,
        random: () => 0.4,
        baseDelaySeconds: 10,
        maxDelaySeconds: 25,
      }),
    ).toEqual({
      action: "retry",
      attempt: 2,
      delaySeconds: 24,
      nextAttemptAt: "2026-05-24T00:00:24.000Z",
    });
  });

  it("pauses auth failures instead of retrying", () => {
    expect(nextRetryDecision({ kind: "unauthenticated", attempt: 0, now })).toEqual({
      action: "pause_auth",
      message: "Please log in to Edstem, then resume.",
    });
  });

  it("fails after max attempts", () => {
    expect(
      nextRetryDecision({
        kind: "unexpected_status",
        attempt: 4,
        now,
        maxAttempts: 4,
      }),
    ).toEqual({ action: "fail", message: "Sync failed after several retry attempts." });
  });
});
