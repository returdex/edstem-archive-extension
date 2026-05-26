# Edstem Archive Extension Privacy Policy

## What the extension reads

The extension reads your Edstem login state, visible course metadata, and discussion content from Edstem pages and Edstem API responses that you can already access in your browser session. It uses this access to sync selected visible courses into a local browser archive and export those discussions as Markdown files through the browser Downloads API.

No credentials or cookies are collected by the extension. It relies on the browser's existing Edstem session instead of asking you to enter or store login details.

## What the extension writes

Synced discussion data, thread metadata, sync checkpoints, run status, export status, and progress are written to local browser IndexedDB. This data stays on the same browser profile unless you remove the extension data through browser settings or a future extension feature.

When you choose a download action, generated Markdown files are saved to your browser Downloads folder under the extension's archive folder. Download status stores only body-free counts, course names or ids, filenames, browser download ids, statuses, timestamps, and sanitized messages.

## What the extension never does

The extension does not include telemetry, analytics, crash-reporting SDKs, remote font CDNs, or third-party trackers. It does not sell, share, or transmit your course content to third-party services. It does not collect credentials, cookies, auth headers, tokenized URLs, or raw API responses.

## Network access

Network access is limited to declared Edstem origins: `https://edstem.org/*` and `https://*.edstem.org/*`. The extension uses the browser's existing Edstem session and does not request the `cookies` permission. Future changes that widen host scope must be explicit, documented, and justified before release.

## Local storage

The extension uses local browser IndexedDB for resumable sync state, locally cached discussion data, and body-free export results. It must not use `chrome.storage.sync` for archive data.
Diagnostic events are limited to sanitized operational metadata such as status categories, timestamps, local course/thread IDs, counts, and filenames; they must not duplicate discussion bodies, cookies, auth headers, stack traces, or full URLs containing tokens.

## Relationship to the Python CLI

The browser extension and the Python CLI are independent tools in this repository. The extension does not read or write Python CLI `exports/`, `.edstem/`, `local.json`, `data/`, or `*.sqlite` paths.
