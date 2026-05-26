export type EdstemErrorKind =
  | "unauthenticated"
  | "forbidden"
  | "rate_limited"
  | "network_error"
  | "unexpected_status"
  | "parse_error";

export interface EdstemSuccess<T> {
  ok: true;
  data: T;
  status: number;
}

export interface EdstemError {
  ok: false;
  kind: EdstemErrorKind;
  status?: number;
  message: string;
  url?: string;
  retryAfterRaw?: string;
  retryAfterSeconds?: number;
}

export type EdstemResult<T> = EdstemSuccess<T> | EdstemError;

export function sanitizeUrlForDisplay(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    return `${url.origin}${url.pathname}`;
  } catch {
    return "unknown URL";
  }
}

export function sanitizeErrorMessage(message: unknown): string {
  if (typeof message !== "string" || message.trim() === "") {
    return "Request failed.";
  }

  let sanitized = message.replace(/https?:\/\/[^\s"'<>`)]+/g, (rawUrl) =>
    sanitizeUrlForDisplay(rawUrl),
  );
  sanitized = sanitized.replace(/[?&][^\s"'<>`)]+/g, "");
  sanitized = sanitized.replace(/#[^\s"'<>`)]+/g, "");
  sanitized = sanitized.replace(/\s+/g, " ").trim();

  return sanitized || "Request failed.";
}

export function parseRetryAfter(rawValue: string | null): {
  retryAfterRaw?: string;
  retryAfterSeconds?: number;
} {
  if (!rawValue) {
    return {};
  }

  const retryAfterRaw = rawValue.trim();
  const seconds = Number(retryAfterRaw);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return { retryAfterRaw, retryAfterSeconds: Math.floor(seconds) };
  }

  const retryAt = Date.parse(retryAfterRaw);
  if (!Number.isNaN(retryAt)) {
    const retryAfterSeconds = Math.max(0, Math.ceil((retryAt - Date.now()) / 1000));
    return { retryAfterRaw, retryAfterSeconds };
  }

  return { retryAfterRaw };
}
