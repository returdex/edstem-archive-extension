# Edstem Archive Extension

## v0.4 distribution — open-source self-install

v0.4 is the first public release of the browser extension and ships as **open-source self-install only**. Chrome Web Store and Microsoft Edge Add-ons listings are planned for a later milestone.

End users: see **[INSTALL.md](INSTALL.md)** (English) / **[INSTALL.zh-CN.md](INSTALL.zh-CN.md)** (中文) for the Load-unpacked install path on Chrome and Edge.

## Purpose

This directory contains the self-contained Chromium Manifest V3 extension for Edstem Archive. It is independent from the Python CLI and does not require a top-level Node project.

## Commands

```powershell
npm ci
npm run build
npm run build:edge
npm test
npm run test:e2e
npm run test:e2e:headed
npm run policy:check
npm run lint
npm run verify
npm run screenshots
npm run package:chrome
npm run package:edge
npm run package:check
```

`npm run verify` runs the extension build, tests, and policy check in sequence.
`npm run package:chrome` and `npm run package:edge` create predictable review artifacts under `.output/`; `npm run package:check` inspects those artifacts for forbidden package contents.
`npm run screenshots` regenerates synthetic HTML screenshot fixtures under `store-assets/screenshots/`.

### E2E Tests (Phase 17)

`npm run test:e2e` runs the Playwright end-to-end suite against the built extension using the bundled Chromium. Before running E2E tests, build the extension first with `npm run build`.

`npm run test:e2e:headed` runs the same suite with the browser window visible — useful for debugging.

E2E tests use synthetic EDstem fixture data only. No real course names, course IDs, student names, instructor names, cookies, auth headers, or private thread bodies are used in or committed by the E2E suite.

E2E output (browser profiles, downloads, Playwright reports) lives under `tests/e2e/.output/` and `tests/e2e/downloads/`, which are git-ignored.

## Load unpacked (developer workflow)

For day-to-day development:

1. Run `npm ci`.
2. Run `npm run build` (Chrome) or `npm run build:edge` (Edge).
3. Open `chrome://extensions` (or `edge://extensions`).
4. Enable Developer mode.
5. Choose Load unpacked and select `extension/.output/chrome-mv3` (or `extension/.output/edge-mv3`).

For end users installing a released zip, follow **[INSTALL.md](INSTALL.md)** instead.

## Privacy boundaries

The extension permission and privacy contracts live in `PERMISSIONS.md` and `PRIVACY.md`. The extension does not collect credentials or cookies, does not include telemetry, and does not read or write Python CLI archive paths.

## Release materials

- `INSTALL.md` / `INSTALL.zh-CN.md` — end-user install guide for the open-source self-install distribution (v0.4 path).
- `STORE-LISTING.en.md` and `STORE-LISTING.zh-CN.md` — bilingual listing copy retained for the future store-submission milestone.
- `STORE-DASHBOARD-COPY.md` — paste-ready Chrome / Edge dashboard text (retained for future store submission).
- `PRE_SUBMIT_CHECKLIST.md` — local verification commands, expected artifacts, inventory rules.
- `RELEASE-HARDENING.md` — pre-release hardening evidence with SHA-256 inventory.
- `MANUAL-VERIFICATION.md` / `MANUAL-VERIFICATION-RESULTS.md` — dual-OS real-browser verification runbook (still recommended for self-install too, since users will run on Windows and macOS).
- `STORE-SUBMISSION-RESULTS.md` — submission template for the future store milestone.
- `store-assets/screenshots/` — synthetic review fixtures.

Phase 16 stops at pre-submission readiness. Phase 17 lands the E2E + verification infrastructure; the actual Chrome Web Store / Microsoft Edge Add-ons submissions are deferred to a later milestone (the v0.4 release path is open-source self-install — see top of this README).
