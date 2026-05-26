# Phase 13 Manual Verification

Use this checklist only with a legitimate Edstem account that the tester can already access.

## Redaction Rules

Do not record:

- real course names or course IDs
- account identifiers
- browser profile paths
- screenshots containing private course data
- raw API payloads
- request or response headers
- cookies, session values, or credential material

Record only pass/fail and short sanitized notes such as "course count matched sidebar".

## Chrome

- [ ] Install the unpacked Chrome build from `extension/.output/chrome-mv3`.
- [ ] While logged in to Edstem in the normal browser, open the popup.
- [ ] Confirm the popup shows `Logged in to EDstem`.
- [ ] Confirm the visible course count matches the Edstem sidebar.
- [ ] Confirm course names are not derived from URL slugs.
- [ ] Sign out or use a fresh browser profile, then open the popup.
- [ ] Confirm the popup shows `Please log in to EDstem` and an `Open Edstem` action.
- [ ] Check the extension permissions panel and confirm no `cookies` permission is requested.

## Edge

- [ ] Install the unpacked Edge build from `extension/.output/chrome-mv3` or the Edge build output.
- [ ] Repeat the logged-in, logged-out, course-count, and no-cookie permission checks.

## Session Expiry Contract

- [ ] With mocked or developer-triggered state, confirm `Session expired` copy says sync is paused at the last saved checkpoint.
- [ ] Confirm this state does not claim Phase 13 can resume real sync yet.

## Sanitized Result Notes

Chrome:

- logged-in state: [pending]
- logged-out state: [pending]
- course count vs sidebar: [pending]
- no-cookie permission check: [pending]

Edge:

- logged-in state: [pending]
- logged-out state: [pending]
- course count vs sidebar: [pending]
- no-cookie permission check: [pending]
