# Store Submission Results

Sanitized submission evidence for EDstem Archive extension v0.4.0.

Chrome-first ordering is required. Edge submission must NOT proceed until Chrome review
material is finalized and any reviewer feedback is folded in.

> **Privacy gate:** This file may only contain sanitized submission evidence. Do NOT record
> credentials, developer-account secrets, raw dashboard session data, private course
> content, raw API responses, cookies, auth headers, tokenized EDstem URLs, or browser
> profile paths. Redact any such content before committing.

---

## Submission Gate Checklist

The following conditions MUST all be met before any store submission proceeds. Do NOT
upload a package until every gate below shows PASS.

| Gate | Source | Status |
|------|--------|--------|
| Automated E2E tests pass (`npm run test:e2e`) | `RELEASE-HARDENING.md` | PASS (8/8, 2026-05-25) |
| Unit tests pass (`npm test`) | `RELEASE-HARDENING.md` | PASS (149/23, 2026-05-25) |
| Package inventory clean (`npm run package:check`) | `RELEASE-HARDENING.md` | PASS (2026-05-25) |
| Policy check clean (`npm run policy:check`) | `RELEASE-HARDENING.md` | PASS (2026-05-25) |
| Lint clean (`npm run lint`) | `RELEASE-HARDENING.md` | PASS (2026-05-25) |
| Privacy-policy URL verified (public HTTPS, matches PRIVACY.md) | `RELEASE-HARDENING.md` | DEFERRED — plan 17-03 Task 2 |
| Windows Chrome manual verification rows 1-6 | `MANUAL-VERIFICATION-RESULTS.md` | DEFERRED — plan 17-04 Task 2 |
| Windows Edge manual verification rows 1-6 | `MANUAL-VERIFICATION-RESULTS.md` | DEFERRED — plan 17-04 Task 3 |
| macOS Chrome manual verification rows 1-6 | `MANUAL-VERIFICATION-RESULTS.md` | DEFERRED — plan 17-04 Task 4 |
| Dual-OS readiness consolidated | `MANUAL-VERIFICATION-RESULTS.md` | DEFERRED — plan 17-04 Task 5 |
| Final artifacts rebuilt from source (new hashes recorded) | `RELEASE-HARDENING.md` | PENDING — rebuild before submission |

If any gate shows DEFERRED or PENDING: do NOT proceed with store submission until resolved.

---

## Chrome Web Store Submission

### Package Details

| Field | Value |
|-------|-------|
| Package name | `extension-chrome-v0.4.0.zip` |
| Version | 0.4.0 |
| Target browser | Chrome (Manifest V3) |
| Dashboard copy source | `extension/STORE-DASHBOARD-COPY.md` — Chrome Web Store section |
| Permission rationale source | `extension/PERMISSIONS.md` |
| Privacy policy source | `extension/PRIVACY.md` |
| Expected listing name | Edstem Archive |
| Expected category | Education |

### Pre-Submission Hash

Rebuild from source immediately before uploading and record the new hash here.

| Field | Value |
|-------|-------|
| Recorded SHA-256 (plan 17-03 reference) | `bd48ec2de1195ae61d491875170feeb5aaeee347cf9aa6278af3fc0c70f287da` |
| Rebuilt SHA-256 (fill in before submission) | PENDING |
| Rebuilt bytes (fill in before submission) | PENDING |
| Rebuild date | PENDING |

> Note: rebuild timestamps affect the zip hash. Always rebuild immediately before uploading.

### Privacy Policy URL

| Field | Value |
|-------|-------|
| Public HTTPS URL | DEFERRED — user must supply before submission (plan 17-03 Task 2) |
| Fetch date | PENDING |
| HTTP status | PENDING |
| Matches PRIVACY.md | PENDING |

### Submission Status

| Field | Value |
|-------|-------|
| Submission date | PENDING |
| Dashboard submission id | PENDING |
| Initial review status | PENDING |
| Reviewer feedback (sanitized) | PENDING |
| Outcome | PENDING |

Status values: `PENDING` / `SUBMITTED` / `IN REVIEW` / `ACCEPTED/LIVE` / `REJECTED` / `DEFERRED`

### Chrome Review Outcome

| Field | Value |
|-------|-------|
| Review outcome | PENDING |
| Outcome date | PENDING |
| Reviewer notes (sanitized) | PENDING |
| Follow-up required | PENDING |
| Live URL (if accepted) | PENDING |

> If rejected: record sanitized reviewer findings here and route to fix/re-submit before
> proceeding to Edge submission. Edge submission is blocked until Chrome review material
> is finalized.

---

## Microsoft Edge Add-ons Submission

**Ordering constraint:** Edge submission must NOT proceed until Chrome review material is
finalized (Chrome outcome recorded above). See `STORE-DASHBOARD-COPY.md` Edge section for
dashboard-copy guidance.

### Package Details

| Field | Value |
|-------|-------|
| Package name | `extension-edge-v0.4.0.zip` |
| Version | 0.4.0 |
| Target browser | Microsoft Edge (Manifest V3, Chromium) |
| Dashboard copy source | `extension/STORE-DASHBOARD-COPY.md` — Microsoft Edge Add-ons section |
| Permission rationale source | `extension/PERMISSIONS.md` |
| Privacy policy source | `extension/PRIVACY.md` |
| Expected listing name | Edstem Archive |
| Expected category | Productivity |

### Pre-Submission Hash

Rebuild from source immediately before uploading and record the new hash here.

| Field | Value |
|-------|-------|
| Recorded SHA-256 (plan 17-03 reference) | `b991893b5233d652b6a8dc12f57376b73115081c1b7ecfc6a243f7c8fcb7c1e2` |
| Rebuilt SHA-256 (fill in before submission) | PENDING |
| Rebuilt bytes (fill in before submission) | PENDING |
| Rebuild date | PENDING |

### Privacy Policy URL

| Field | Value |
|-------|-------|
| Public HTTPS URL | DEFERRED — same URL used for Chrome; must be verified first |
| Fetch date | PENDING |
| HTTP status | PENDING |
| Matches PRIVACY.md | PENDING |

### Submission Status

| Field | Value |
|-------|-------|
| Submission date | PENDING |
| Partner Center certification id | PENDING |
| Initial certification status | PENDING |
| Reviewer / certifier feedback (sanitized) | PENDING |
| Outcome | PENDING |

Status values: `PENDING` / `SUBMITTED` / `IN CERTIFICATION` / `ACCEPTED/LIVE` / `REJECTED` / `DEFERRED`

### Edge Certification Outcome

| Field | Value |
|-------|-------|
| Certification outcome | PENDING |
| Outcome date | PENDING |
| Certifier notes (sanitized) | PENDING |
| Follow-up required | PENDING |
| Live URL (if accepted) | PENDING |

> EXTPUBLISH-02 is complete ONLY when Edge certification outcome shows ACCEPTED/LIVE.
> Any Edge rejection prevents Phase 17 final verification from passing.

---

## Final Release Evidence Summary

| Requirement | Source | Status |
|-------------|--------|--------|
| EXTPUBLISH-01 (Chrome Web Store) | Chrome section above | PENDING |
| EXTPUBLISH-02 (Microsoft Edge Add-ons) | Edge section above | PENDING |
| E2E smoke tests pass | `RELEASE-HARDENING.md` | PASS (8/8) |
| Manual Windows Chrome verification | `MANUAL-VERIFICATION-RESULTS.md` | DEFERRED |
| Manual Windows Edge verification | `MANUAL-VERIFICATION-RESULTS.md` | DEFERRED |
| Manual macOS Chrome verification | `MANUAL-VERIFICATION-RESULTS.md` | DEFERRED |
| Privacy-policy URL verified | `RELEASE-HARDENING.md` / `PRIVACY.md` | DEFERRED |
| Package inventory clean | `RELEASE-HARDENING.md` | PASS |
| No private content in submission | Privacy gate above | Enforced — no exceptions |

Phase 17 final verification (17-VERIFICATION.md) cannot mark v0.4 complete until both
`EXTPUBLISH-01` and `EXTPUBLISH-02` outcomes above show `ACCEPTED/LIVE`.
