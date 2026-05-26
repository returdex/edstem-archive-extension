# Edstem Archive Store Listing - English

## Single-Purpose Statement

Edstem Archive lets a signed-in Edstem user download discussions they can already access as local Markdown files.

## Short Description

Download accessible Edstem course discussions as local Markdown from your browser session.

## Long Description

Edstem Archive is a local-first browser extension for students who want a personal, reviewable archive of their accessible Edstem course discussions. After you sign in to Edstem in the browser, the extension can download the current course or all visible courses and save Markdown files to your Downloads folder.

The extension does not ask for Edstem credentials, does not collect cookies, does not use broad host access, and does not send course content to third-party services. Sync state and body-free progress/results stay in local browser storage.

## Permission Rationale Summary

- `activeTab`: recognizes the current Edstem course tab when you choose the current-course workflow.
- `downloads`: saves generated Markdown through the browser Downloads API.
- `notifications`: shows one terminal notification when a download completes, partially completes, or fails.
- `alarms`: supports resumable Manifest V3 background work.
- `storage`: keeps local extension state, resumability data, and popup status.
- `https://edstem.org/*` and `https://*.edstem.org/*`: limit network and sidebar course discovery to Edstem origins.

## Screenshot Captions

1. Download the current course or all visible courses from the popup.
2. See compact progress and body-free download results.
3. Review the short onboarding page explaining local storage and existing-session use.

## Privacy Policy Note

Use the public privacy-policy URL that matches `extension/PRIVACY.md` before store submission.

## Support and Review Notes

Screenshots and fixtures are synthetic. Phase 16 prepares artifacts for review; Phase 17 owns live store submission and final manual verification.
