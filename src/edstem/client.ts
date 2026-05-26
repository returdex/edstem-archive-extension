import { isAllowedNetworkUrl } from "../policy/policyAllowlist";
import {
  EdstemError,
  EdstemResult,
  parseRetryAfter,
  sanitizeErrorMessage,
  sanitizeUrlForDisplay,
} from "./errors";

const DEFAULT_EDSTEM_ORIGIN = "https://edstem.org";

export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

export interface EdstemFetchOptions {
  fetchImpl?: FetchLike;
  init?: RequestInit;
  baseOrigin?: string;
}

export async function edstemFetch<T>(
  pathOrUrl: string,
  options: EdstemFetchOptions = {},
): Promise<EdstemResult<T>> {
  const targetUrl = resolveEdstemUrl(pathOrUrl, options.baseOrigin ?? DEFAULT_EDSTEM_ORIGIN);
  if (!targetUrl || !isAllowedNetworkUrl(targetUrl.href)) {
    return makeError("network_error", "Request target is outside the Edstem allowlist.", targetUrl);
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  let response: Response;
  try {
    response = await fetchImpl(targetUrl, {
      ...options.init,
      credentials: "include",
      headers: {
        Accept: "application/json",
        ...options.init?.headers,
      },
    });
  } catch (error) {
    return makeError("network_error", sanitizeErrorMessage(error), targetUrl);
  }

  if (response.status === 401) {
    return makeError("unauthenticated", "Please log in to Edstem.", targetUrl, response.status);
  }

  if (response.status === 403) {
    return makeError("forbidden", "This Edstem session cannot access that resource.", targetUrl, response.status);
  }

  if (response.status === 429) {
    return {
      ...makeError("rate_limited", "Edstem asked the extension to retry later.", targetUrl, response.status),
      ...parseRetryAfter(response.headers.get("Retry-After")),
    };
  }

  if (!response.ok) {
    return makeError(
      "unexpected_status",
      `Edstem returned HTTP ${response.status}.`,
      targetUrl,
      response.status,
    );
  }

  try {
    const data = (await response.json()) as T;
    return { ok: true, data, status: response.status };
  } catch (error) {
    return makeError("parse_error", sanitizeErrorMessage(error), targetUrl, response.status);
  }
}

function resolveEdstemUrl(pathOrUrl: string, baseOrigin: string): URL | null {
  try {
    if (/^https?:\/\//i.test(pathOrUrl)) {
      return new URL(pathOrUrl);
    }

    const base = new URL(baseOrigin);
    return new URL(pathOrUrl.startsWith("/") ? pathOrUrl : `/${pathOrUrl}`, base);
  } catch {
    return null;
  }
}

function makeError(
  kind: EdstemError["kind"],
  message: string,
  url?: URL | null,
  status?: number,
): EdstemError {
  return {
    ok: false,
    kind,
    status,
    message: sanitizeErrorMessage(message),
    url: url ? sanitizeUrlForDisplay(url.href) : undefined,
  };
}
