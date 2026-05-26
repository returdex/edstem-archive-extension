# Pre-Submit Checklist

**v0.4 distribution path: open-source self-install** — see [INSTALL.md](INSTALL.md). Chrome Web Store and Microsoft Edge Add-ons submission is **deferred to a later milestone**. The Store Materials, Submission Results Template, and Submission Sequence sections below remain authoritative for the future store-submission milestone — they are not gating the v0.4 self-install release.

For v0.4 self-install release readiness, only the following are required:

- Local Commands all pass.
- Expected Artifacts exist under `.output/`.
- Inventory Rules pass (`npm run package:check`).
- `MANUAL-VERIFICATION.md` rows attempted (Windows Chrome and at least one other target). Failures are filed as issues; they do **not** block self-install release.

Phase 16 prepares reviewable artifacts only. Phase 17 owns live E2E, dual-OS manual verification infrastructure, and pre-submission hardening; actual store uploads are deferred to a future milestone.

## Local Commands

- `npm run build`
- `npm run package:chrome`
- `npm run package:edge`
- `npm run package:check`
- `npm run screenshots`
- `npm run policy:check`
- `npm test`

## Expected Artifacts

- `.output/extension-chrome-v0.4.0.zip`
- `.output/extension-edge-v0.4.0.zip`
- `store-assets/screenshots/popup-success.html`
- `store-assets/screenshots/popup-error.html`
- `store-assets/screenshots/onboarding.html`

## Inventory Rules

- No source maps.
- No `.env` files.
- No `tests/` directories.
- No `node_modules/`.
- No Python CLI storage paths such as local archive folders, local config files, or SQLite files.
- No real course names, ids, student names, instructor names, or private discussion bodies.
- No broad host permissions.
- Use synthetic screenshots only.

## Store Materials

- English listing: `STORE-LISTING.en.md`
- Chinese listing: `STORE-LISTING.zh-CN.md`
- Privacy policy source: `PRIVACY.md`
- Permission rationale source: `PERMISSIONS.md`
- Dashboard copy (paste-ready): `STORE-DASHBOARD-COPY.md`
- Release hardening evidence: `RELEASE-HARDENING.md`
- Public privacy-policy URL: `[Phase 17 checkpoint — user must supply HTTPS URL before submission]`

## Manual Browser Verification

Real-browser verification (Windows Chrome, Windows Edge, macOS Chrome) is required before
store submission. Automated Playwright/Chromium E2E does not replace this step.

- **Runbook:** `MANUAL-VERIFICATION.md` — step-by-step instructions for all three targets.
- **Results template:** `MANUAL-VERIFICATION-RESULTS.md` — sanitized evidence rows (OS,
  browser version, package source, row status, file counts, notes).

Fill in all three target sections in `MANUAL-VERIFICATION-RESULTS.md` and confirm
"Submission-ready: YES" before proceeding to the Submission Sequence below.

## Submission Results Template

- Submission evidence tracker: `STORE-SUBMISSION-RESULTS.md`
  - Records per-store package names, versions, rebuilt hashes, privacy-policy URL, submission ids, review/certification outcomes, and reviewer feedback.
  - Contains a gate checklist that must all pass before any upload proceeds.
  - Chrome section gates Edge section: Edge submission is blocked until Chrome review material is finalized.
  - EXTPUBLISH-02 is complete only when Edge certification outcome shows ACCEPTED/LIVE.

Fill in `STORE-SUBMISSION-RESULTS.md` as you complete each step below.

## Submission Sequence

1. Complete Phase 17 live E2E and manual verification (owned by Phase 17 plans 01-04).
   - Run the runbook in `MANUAL-VERIFICATION.md` for Windows Chrome, Windows Edge, and macOS Chrome.
   - Record sanitized evidence in `MANUAL-VERIFICATION-RESULTS.md`.
   - Fix any platform-specific issues before continuing.
2. Provide the public privacy-policy URL and confirm it matches `PRIVACY.md` (Phase 17 plan-03 Task 2 checkpoint). Record verified URL in `STORE-SUBMISSION-RESULTS.md` Privacy Policy URL section.
3. Rebuild final packages from source (`npm run package:chrome && npm run package:edge`) and re-record hashes in `RELEASE-HARDENING.md` and `STORE-SUBMISSION-RESULTS.md`.
4. Verify all gates in the `STORE-SUBMISSION-RESULTS.md` Submission Gate Checklist show PASS before proceeding.
5. Submit the Chrome package first — paste dashboard text from `STORE-DASHBOARD-COPY.md`. Record submission id and status in `STORE-SUBMISSION-RESULTS.md`.
6. Submit the Edge package after Chrome review material is finalized — paste dashboard text from `STORE-DASHBOARD-COPY.md`. Record certification id and status in `STORE-SUBMISSION-RESULTS.md`.
