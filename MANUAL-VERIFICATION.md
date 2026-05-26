# Manual Browser Verification Runbook

Pre-submission manual verification for EDstem Archive browser extension v0.4.0.

This runbook covers the three required browser/OS targets before Chrome Web Store and
Microsoft Edge Add-ons submission:

- **Target A — Windows Chrome**
- **Target B — Windows Edge**
- **Target C — macOS Chrome**

Automated Playwright/Chromium E2E (`npm run test:e2e`) does NOT replace this runbook.
These checks use the real browser and the user's live EDstem session.

---

## Prerequisites (all targets)

1. You have a normal, logged-in EDstem browser session in the target browser.
   The extension piggybacks on this session; it does not prompt for credentials.
2. The target browser is Chrome (stable) or Edge (stable) on the listed OS.
3. You have the packaged zip **or** the unpacked build for the correct target:
   - Chrome: `.output/extension-chrome-v0.4.0.zip` (or unpacked Chrome build folder)
   - Edge:   `.output/extension-edge-v0.4.0.zip`   (or unpacked Edge build folder)
4. You are on a machine where downloads land in a predictable folder
   (e.g., `~/Downloads` on macOS, `C:\Users\<you>\Downloads` on Windows).

Rebuild packages before testing if you have local source changes:

```powershell
# Windows
npm run package:chrome
npm run package:edge
```

```bash
# macOS
npm run package:chrome
npm run package:edge
```

---

## Install / Load Steps

### Option A — Load unpacked (easiest for local testing)

1. Open the browser's extensions page:
   - Chrome: `chrome://extensions/`
   - Edge:   `edge://extensions/`
2. Enable **Developer mode** (toggle in top-right on Chrome; left sidebar on Edge).
3. Click **Load unpacked**.
4. Select the `.output/` subfolder for the target:
   - Chrome build: `.output/chrome-mv3/` (run `npm run build` first if absent)
   - Edge build:   `.output/edge-mv3/`   (run `npm run build:edge` first if absent)
5. Confirm the extension name "EDstem Archive" and version "0.4.0" appear in the list.

### Option B — Install from zip (closer to store install)

1. Follow Option A steps 1-2 (Developer mode).
2. Drag-and-drop the zip file onto the extensions page, **or** unzip it and use
   **Load unpacked** on the unzipped folder.

---

## Login Prerequisite

Before running any download test:

1. Navigate to `https://edstem.org` in the target browser and confirm you are logged in.
2. Open at least one course page so the extension can detect the active course.
3. If the popup shows "Not logged in" or "No courses found", log in through the normal
   EDstem site first, then return to the popup.

---

## Test Matrix

Work through each row in order. Record pass/fail in
`MANUAL-VERIFICATION-RESULTS.md`.

### Row 1 — Install and popup opens

| Step | Action | Expected |
|------|--------|----------|
| 1.1 | Install/load the extension (see above). | Extension icon appears in toolbar. |
| 1.2 | Click the extension icon. | Popup opens without JS errors. |
| 1.3 | Inspect the popup — no console errors. | Browser DevTools → no red errors. |

### Row 2 — Login state detection

| Step | Action | Expected |
|------|--------|----------|
| 2.1 | With EDstem session active, open popup. | Popup shows course list or "Download" buttons. |
| 2.2 | Optionally log out of EDstem and reopen popup. | Popup shows a "not logged in" state (no crash). |
| 2.3 | Log back in and reopen popup. | Course list / buttons appear again. |

### Row 3 — Current-course download

| Step | Action | Expected |
|------|--------|----------|
| 3.1 | Navigate to any course page on EDstem. | URL contains `edstem.org/courses/<id>/`. |
| 3.2 | Open the extension popup. | "Download current course" button is enabled. |
| 3.3 | Click "Download current course". | Progress indicator appears. |
| 3.4 | Wait for completion. | Success state shows; no error banner. |
| 3.5 | Open Downloads folder (toolbar shortcut or OS shortcut). | Markdown files are present for the course. |
| 3.6 | Check that file count is reasonable (> 0 files). | At least 1 `.md` file in a course subfolder. |

### Row 4 — All-courses smoke (optional but recommended)

| Step | Action | Expected |
|------|--------|----------|
| 4.1 | Open the extension popup from any EDstem page. | Course list visible. |
| 4.2 | Click "Download all courses". | Progress shows per-course. |
| 4.3 | Wait for completion or let it run for ~30 s then check. | No crash or unhandled error. |
| 4.4 | Check Downloads folder. | New course subfolders / Markdown files present. |

If you have many courses and this takes too long, skip step 4.2 onwards and mark Row 4
as "skipped — large course list" in the results. That is an accepted outcome; Row 3 is
the critical path.

### Row 5 — Downloads folder shortcut

| Step | Action | Expected |
|------|--------|----------|
| 5.1 | After any successful download, click "Open downloads folder" in popup. | OS file explorer opens to the Downloads folder. |
| 5.2 | Confirm the folder path is the standard Downloads folder for the OS. | macOS: `~/Downloads`; Windows: `C:\Users\<you>\Downloads`. |

### Row 6 — Notification and onboarding

| Step | Action | Expected |
|------|--------|----------|
| 6.1 | On first install (or after clearing extension storage), open the popup. | Onboarding / welcome message visible if first install. |
| 6.2 | After a successful download completes, look for a system notification. | "Download complete" notification appears (if OS allows). |
| 6.3 | Dismiss the notification. | No crash; popup remains stable. |

Note: system notifications require the browser and OS to allow notifications from
extensions. If notifications are blocked by OS settings, mark as "skipped — OS blocked"
and note the OS notification permission state.

### Row 7 — Chinese locale spot check (optional)

| Step | Action | Expected |
|------|--------|----------|
| 7.1 | Set the browser UI language to Simplified Chinese (`zh-CN`) in browser settings. | Language setting saved. |
| 7.2 | Reopen the extension popup. | UI labels appear in Chinese (e.g., "下载当前课程"). |
| 7.3 | Reset browser language back to English. | UI labels revert. |

This row is optional. If you do not have a Chinese locale available, mark as
"skipped — locale not available".

---

## After Completing All Rows

1. Fill in `MANUAL-VERIFICATION-RESULTS.md` with sanitized evidence (counts, versions,
   pass/fail, notes — never paste downloaded Markdown content or private discussion text).
2. If any row failed:
   - Describe the failure in the results file under "Issues Found".
   - File a fix before proceeding to store submission.
   - Re-run the affected rows after the fix and record the re-test result.
3. Once all required rows (1-6) pass across all three targets (Windows Chrome, Windows
   Edge, macOS Chrome), Task 5 consolidation can be run.

**Task 5 note:** Task 5 (consolidate manual verification readiness and update the
pre-submit checklist) will be run ONLY after all three dual-OS target rows are completed
and recorded as passed in `MANUAL-VERIFICATION-RESULTS.md`. Do not run Task 5 with
incomplete rows.

---

## Privacy / Safety Reminders

- Record only: OS name/version, browser name/version, package name, file counts,
  row status (PASS/FAIL/SKIP), and sanitized notes.
- Do NOT paste: downloaded Markdown content, private discussion bodies, course titles,
  student/instructor names, cookies, auth headers, tokenized EDstem URLs, raw API
  responses, or browser profile paths.
- If a bug produces an error message containing a course name or user name, redact
  it before recording. Write e.g. `"[REDACTED: course name]"` in its place.
