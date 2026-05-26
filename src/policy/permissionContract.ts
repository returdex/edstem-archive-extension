export const EXPECTED_PERMISSIONS = [
  "activeTab",
  "downloads",
  "notifications",
  "alarms",
  "storage",
] as const;

export const EXPECTED_HOST_PERMISSIONS = [
  "https://edstem.org/*",
  "https://*.edstem.org/*",
] as const;
