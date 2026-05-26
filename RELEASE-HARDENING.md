# Release Hardening Evidence

Pre-release hardening evidence for the EDstem Archive browser extension v0.4.

**v0.4 distribution path: open-source self-install** via GitHub Releases (see [INSTALL.md](INSTALL.md)). Chrome Web Store and Microsoft Edge Add-ons submission is deferred to a future milestone. Sections below remain authoritative for the future store milestone.

---

## Package Inventory

### Artifact Names and Hashes

| Target | Artifact | Bytes | SHA-256 |
|--------|----------|-------|---------|
| Chrome | extension-chrome-v0.4.0.zip | 31965 | 188cf4f8a42534d5f8e15c9e063bc1fef9b5be24a3d73088da9a9a08e60bc0c3 |
| Edge   | extension-edge-v0.4.0.zip   | 31965 | d1e92d50dfbf68e68226e6e00afa78a3d82003ebfdd54cfc5f0de0da8c35a0aa |

**Manifest version:** 0.4.0

**GitHub Release:** https://github.com/returdex/edstem-archive/releases/tag/v0.4.0

> Hashes above are from the 2026-05-26 rebuild after the real-EDstem extension fixes for regional API paths, in-page authenticated API fetches, visible-thread fallback discovery, complete question/reply/comment parsing, and replacement of stale per-thread post records. These are the canonical v0.4.0 self-install zips prepared for GitHub Releases. Rebuild before any future store-submission and re-record hashes, because the zip build timestamp and source code changes affect the hash.

### Inventory Check Results

Command: `npm run package:check`

```
Package inventory:
  extension-chrome-v0.4.0.zip (31965 bytes) SHA-256: 188cf4f8a42534d5f8e15c9e063bc1fef9b5be24a3d73088da9a9a08e60bc0c3
  extension-edge-v0.4.0.zip (31965 bytes) SHA-256: d1e92d50dfbf68e68226e6e00afa78a3d82003ebfdd54cfc5f0de0da8c35a0aa
  Manifest version: 0.4.0
```

**Result:** PASS — no forbidden artifacts detected.

> Note: The package-check private-marker scan currently has a known fail-open edge case under symlink cycles and unreadable files (REVIEW.md CR-01). For v0.4 self-install distribution this is `recommended-fix`; for any future store-submission milestone it is `required-fix` before the gate can be treated as security-grade.

Forbidden artifact categories checked:

| Category | Pattern | Result |
|----------|---------|--------|
| Source maps | `*.map` | Not present |
| Node modules | `node_modules/` | Not present |
| Test directories | `tests?/` | Not present |
| Environment files | `.env` | Not present |
| Local config | `local.json` | Not present |
| SQLite archives | `*.sqlite`, `*.db` | Not present |
| Export paths | `exports/` | Not present |
| AI metadata | `.edstem/` | Not present |
| Broad permissions | `<all_urls>` | Not in manifest |

---

## Privacy Policy URL

**Status:** [PENDING — Phase 17 checkpoint required]

The public privacy-policy URL must be provided by the user before submission. Requirements:

- Must be an HTTPS URL reachable at submission time.
- Substantive content must match `extension/PRIVACY.md` on these claims:
  - No credentials collected.
  - No cookies collected.
  - Network access limited to `https://edstem.org/*` and `https://*.edstem.org/*`.
  - No telemetry, analytics, crash-reporting SDKs, or third-party trackers.
  - Data stays in local browser storage and local Downloads folder.
  - Extension does not share or transmit course content to third parties.

Once the user provides the URL, update this section with:
- The verified URL.
- Fetch date and HTTP status.
- Confirmation that substantive claims match.

---

## Local Verification Command Results

Commands and pass/fail status from Phase 17 plan-03 Task 4 execution (2026-05-25, Windows 11):

| Command | Status | Notes |
|---------|--------|-------|
| `npm run build` | PASS | Chrome build: 15 emitted files, 88.92 kB total, ~264 ms |
| `npm run build:edge` | PASS | Edge build: same extension payload under `.output/edge-mv3` |
| `npm run package:chrome` | PASS | Zip: extension-chrome-v0.4.0.zip (31965 bytes) |
| `npm run package:edge` | PASS | Zip: extension-edge-v0.4.0.zip (31965 bytes) |
| `npm run package:check` | PASS | No forbidden artifacts; SHA-256 inventory reported |
| `npm run lint` | PASS | wxt prepare + tsc --noEmit + policy:check all pass |
| `npm run verify` | PASS | build + 187 unit tests (24 test files) + policy:check all pass |
| `npm test` | PASS | 187 tests / 24 test files pass |
| `npm run test:e2e` | PASS | 32/32 E2E tests pass (Playwright/Chromium bundled, 11.5 s) |
| `npm run policy:check` | PASS | No policy violations in production source |

> E2E test results (`npm run test:e2e`) require a Chromium build via `npx playwright install chromium`. Cross-OS verification (Windows + macOS/Linux) is a residual manual step in Phase 17.

---

## Manifest Permission Audit

Manifest permissions as of v0.4.0 (verified against `extension/src/policy/permissionContract.ts`):

| Permission | Manifest | Justified in PERMISSIONS.md | Dashboard copy |
|------------|----------|------------------------------|----------------|
| `activeTab` | Yes | Yes (Phase 15, EXTDISC-02/03) | Yes |
| `downloads` | Yes | Yes (Phase 15, EXTEXPORT-01) | Yes |
| `notifications` | Yes | Yes (Phase 16, EXTUI-06) | Yes |
| `alarms` | Yes | Yes (Phase 14, EXTSYNC-02/EXTBUILD-04) | Yes |
| `storage` | Yes | Yes (Phase 14, EXTSYNC-01/EXTPRIVACY-04) | Yes |
| `https://edstem.org/*` | Yes (host_permission) | Yes (Phase 13, EXTAUTH-01/EXTDISC-01/EXTPRIVACY-01) | Yes |
| `https://*.edstem.org/*` | Yes (host_permission) | Yes (Phase 13, EXTAUTH-01/EXTDISC-01/EXTPRIVACY-01) | Yes |
| `<all_urls>` | No — rejected | N/A | Explicitly denied |
| `cookies` | No — rejected | N/A | Not requested |

No new permissions, broad hosts, remote code, telemetry, or Python CLI storage access introduced in Phase 17.

---

## Submission Sequence (Residual Manual Steps)

These steps require human action and cannot be automated:

1. **Provide privacy-policy URL** — Supply the HTTPS public URL that will be submitted to both stores. Verify it matches `extension/PRIVACY.md`.
2. **Rebuild final artifacts** — Run `npm run package:chrome && npm run package:edge` immediately before submission and record new hashes.
3. **Submit Chrome package** — Upload `extension-chrome-v0.4.0.zip` to Chrome Web Store. Paste dashboard text from `STORE-DASHBOARD-COPY.md`. Enter the privacy-policy URL. Complete reviewer notes.
4. **Wait for Chrome review** — Do not submit to Edge until Chrome review material is finalized.
5. **Submit Edge package** — Upload `extension-edge-v0.4.0.zip` to Microsoft Edge Add-ons. Paste dashboard text from `STORE-DASHBOARD-COPY.md`. Enter the privacy-policy URL.

---

## Privacy / Security Evidence Summary

- No credentials, cookies, auth headers, or raw API payloads are logged or committed.
- All synthetic test data uses `SYNTHETIC_` prefix constants; no real course names, IDs, student names, or instructor names appear in test fixtures or store screenshots.
- Store screenshots are generated from `store-assets/screenshots/` HTML fixtures which contain only synthetic data.
- Package inventory confirms no source maps, test files, node_modules, env files, or Python CLI paths in store zips.
- Policy check confirms no `<all_urls>`, no `chrome.storage.sync` for archive data, no eval/dynamic code, no remote scripts, no telemetry packages, no direct cookie API, no credential headers, and no Python CLI storage paths in production source.
