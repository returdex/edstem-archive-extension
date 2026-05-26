import { EdstemErrorKind } from "../edstem/errors";

export interface RetryDecisionInput {
  kind: EdstemErrorKind;
  retryAfterSeconds?: number;
  attempt: number;
  now: Date;
  random?: () => number;
  baseDelaySeconds?: number;
  maxDelaySeconds?: number;
  maxAttempts?: number;
}

export type RetryDecision =
  | { action: "pause_auth"; message: string }
  | { action: "retry"; attempt: number; nextAttemptAt: string; delaySeconds: number }
  | { action: "fail"; message: string };

export function nextRetryDecision(input: RetryDecisionInput): RetryDecision {
  if (input.kind === "unauthenticated") {
    return { action: "pause_auth", message: "Please log in to Edstem, then resume." };
  }

  if (!isRetryable(input.kind)) {
    return { action: "fail", message: "Sync failed. Please try again later." };
  }

  const maxAttempts = input.maxAttempts ?? 4;
  const nextAttempt = input.attempt + 1;
  if (nextAttempt > maxAttempts) {
    return { action: "fail", message: "Sync failed after several retry attempts." };
  }

  const delaySeconds =
    input.kind === "rate_limited" && input.retryAfterSeconds !== undefined
      ? input.retryAfterSeconds
      : exponentialBackoffSeconds({
          attempt: nextAttempt,
          random: input.random ?? Math.random,
          baseDelaySeconds: input.baseDelaySeconds ?? 5,
          maxDelaySeconds: input.maxDelaySeconds ?? 300,
        });
  const nextAttemptAt = new Date(input.now.getTime() + delaySeconds * 1000).toISOString();
  return { action: "retry", attempt: nextAttempt, nextAttemptAt, delaySeconds };
}

function isRetryable(kind: EdstemErrorKind): boolean {
  return kind === "rate_limited" || kind === "network_error" || kind === "unexpected_status";
}

function exponentialBackoffSeconds(input: {
  attempt: number;
  random: () => number;
  baseDelaySeconds: number;
  maxDelaySeconds: number;
}): number {
  const exponential = input.baseDelaySeconds * 2 ** Math.max(0, input.attempt - 1);
  const jitter = Math.floor(input.random() * input.baseDelaySeconds);
  return Math.min(input.maxDelaySeconds, exponential + jitter);
}
