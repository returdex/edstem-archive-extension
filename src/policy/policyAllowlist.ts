export interface PolicyAllowlistEntry {
  pattern: string;
  reason: string;
  phase: string;
  requirement: string;
}

export const NETWORK_ALLOWLIST = [
  {
    pattern: "https://edstem.org/*",
    reason: "The extension may access Edstem origins already available to the signed-in user.",
    phase: "Phase 13",
    requirement: "EXTAUTH-01, EXTDISC-01, EXTPRIVACY-01",
  },
  {
    pattern: "https://*.edstem.org/*",
    reason: "The extension may access Edstem origins already available to the signed-in user.",
    phase: "Phase 13",
    requirement: "EXTPRIVACY-01",
  },
] as const satisfies readonly PolicyAllowlistEntry[];

export function isAllowedNetworkUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    return url.protocol === "https:" && (url.hostname === "edstem.org" || url.hostname.endsWith(".edstem.org"));
  } catch {
    return false;
  }
}
