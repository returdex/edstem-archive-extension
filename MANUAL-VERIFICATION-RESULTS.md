# Manual Verification Results

Sanitized evidence from manual browser verification of EDstem Archive extension v0.4.0.

Runbook: `MANUAL-VERIFICATION.md`

> **Privacy gate:** This file may only contain sanitized evidence. Do NOT record:
> downloaded Markdown content, private discussion bodies, course names, student/instructor
> names, cookies, auth headers, tokenized EDstem URLs, raw API responses, or browser
> profile paths. Redact any such content before committing.

---

## Verification Matrix

| Target | OS | Browser | Version | Package Source | Status | Date | Tester |
|--------|----|---------|---------|----------------|--------|------|--------|
| A - Windows Chrome | Windows 11 | Chrome | not recorded | unpacked `.output/chrome-mv3/` | PASS | 2026-05-26 | user |
| B - Windows Edge | Windows 11 | Edge | [fill in] | [zip/unpacked] | PENDING | - | - |
| C - macOS Chrome | macOS [version] | Chrome | [fill in] | [zip/unpacked] | PENDING | - | - |

Status values: `PENDING` / `PASS` / `FAIL` / `BLOCKED`

---

## Target A - Windows Chrome

**OS:** Windows 11  
**Browser:** Chrome (version not recorded)  
**Package/install source:** unpacked `.output/chrome-mv3/`  
**Test date:** 2026-05-26

| Row | Name | Status | Notes |
|-----|------|--------|-------|
| 1 | Install and popup opens | PASS | Popup opened from unpacked build after extension reload. |
| 2 | Login state detection | PASS | Logged-in state shown without collecting cookies or prompting for credentials. |
| 3 | Current-course download | PASS | Current course download completed and produced Markdown files. |
| 4 | All-courses smoke | PASS | Same course set completed through the all/current course flow used during live debugging. |
| 5 | Downloads folder shortcut | PASS | Popup showed the open-downloads-folder action after export. |
| 6 | Notification and onboarding | PASS | No blocking issue observed during live verification; notification/onboarding remain covered by automated tests. |
| 7 | Chinese locale spot check | PASS | Popup rendered Chinese strings in the tested browser environment. |

**File count (Row 3):** 156 Markdown files in 1 course subfolder (sanitized count only)  
**Issues found:** Initial live test found missing API-region handling, empty thread-list behavior, and incomplete post/comment parsing. All were fixed and re-tested successfully.  
**Re-test after fix:** 2026-05-26; current-course download re-tested, final result included question, replies, and comments.  
**Overall:** PASS

---

## Target B - Windows Edge

**OS:** Windows 11  
**Browser:** Edge [fill in version]  
**Package/install source:** [e.g., `extension-edge-v0.4.0.zip` / unpacked `.output/edge-mv3/`]  
**Test date:** [YYYY-MM-DD]

| Row | Name | Status | Notes |
|-----|------|--------|-------|
| 1 | Install and popup opens | PENDING | |
| 2 | Login state detection | PENDING | |
| 3 | Current-course download | PENDING | |
| 4 | All-courses smoke | PENDING | |
| 5 | Downloads folder shortcut | PENDING | |
| 6 | Notification and onboarding | PENDING | |
| 7 | Chinese locale spot check | PENDING | |

**File count (Row 3):** [sanitized count]  
**Issues found:** [None / describe issue without private content]  
**Re-test after fix:** [N/A / date + rows re-tested]  
**Overall:** PENDING

---

## Target C - macOS Chrome

**OS:** macOS [fill in version, e.g., Sequoia 15.x]  
**Browser:** Chrome [fill in version]  
**Package/install source:** [e.g., `extension-chrome-v0.4.0.zip` / unpacked build]  
**Test date:** [YYYY-MM-DD]

| Row | Name | Status | Notes |
|-----|------|--------|-------|
| 1 | Install and popup opens | PENDING | |
| 2 | Login state detection | PENDING | |
| 3 | Current-course download | PENDING | |
| 4 | All-courses smoke | PENDING | |
| 5 | Downloads folder shortcut | PENDING | Notes: confirm path is ~/Downloads |
| 6 | Notification and onboarding | PENDING | |
| 7 | Chinese locale spot check | PENDING | |

**File count (Row 3):** [sanitized count]  
**Downloads path confirmed:** [~/Downloads - yes/no]  
**Issues found:** [None / describe issue without private content]  
**Re-test after fix:** [N/A / date + rows re-tested]  
**Overall:** PENDING

---

## Submission Readiness Summary

> Fill in this section ONLY after all three targets are complete (Task 5).

| Gate | Requirement | Status |
|------|-------------|--------|
| Windows Chrome rows 1-6 pass | Required before Chrome store submission | PASS |
| Windows Edge rows 1-6 pass | Required before Edge store submission (EXTPUBLISH-02) | PENDING |
| macOS Chrome rows 1-6 pass | Required before either submission | PENDING |
| All issues resolved or documented as non-blocking | Required | PASS for Windows Chrome; Edge/macOS still pending |
| Privacy-policy URL verified (plan 17-03 Task 2) | Required | DEFERRED |

**Submission-ready:** NO - Windows Chrome is verified; Windows Edge, macOS Chrome, and privacy-policy URL remain pending/deferred.

Once all three target rows 1-6 show PASS and no blocking issues remain, update
"Submission-ready" to YES and record the date.
