# Store Dashboard Copy

Paste-ready text blocks for Chrome Web Store and Microsoft Edge Add-ons submission dashboards.

All claims are drawn directly from `PRIVACY.md`, `PERMISSIONS.md`, `STORE-LISTING.en.md`, and `STORE-LISTING.zh-CN.md`. Do not use language from this document that contradicts those sources.

---

## Chrome Web Store

### Category

Education

### Language: English (US)

**Name**

Edstem Archive

**Short Description** (up to 132 characters)

Download accessible Edstem course discussions as local Markdown from your browser session.

**Detailed Description**

Edstem Archive is a local-first browser extension for students who want a personal, reviewable archive of their accessible Edstem course discussions. After you sign in to Edstem in the browser, the extension can download the current course or all visible courses and save Markdown files to your Downloads folder.

The extension does not ask for Edstem credentials, does not collect cookies, does not use broad host access, and does not send course content to third-party services. Sync state and body-free progress/results stay in local browser storage.

**Single-Purpose Statement** (for reviewer justification form)

Edstem Archive lets a signed-in Edstem user download discussions they can already access as local Markdown files.

**Permission Justifications** (for reviewer justification form or supplemental notes)

- `activeTab`: Recognizes the current Edstem course tab when the user chooses the current-course workflow. The extension reads the active tab URL only after the user clicks the toolbar icon.
- `downloads`: Saves generated Markdown through the browser's Downloads API. No file is written without user-initiated action.
- `notifications`: Shows one terminal notification only when a download completes, partially completes, or fails while the popup may be closed. No persistent or unsolicited notifications.
- `alarms`: Supports resumable Manifest V3 background work within the service-worker lifetime limits imposed by MV3.
- `storage`: Keeps local extension state, resumability data, and body-free popup status in local browser storage. `chrome.storage.sync` is not used for archive data.
- `https://edstem.org/*` and `https://*.edstem.org/*` host permissions: Restrict network and sidebar course discovery to Edstem origins that the user can already access in their browser session.

**Does your extension use remote code?**

No. The extension does not load, execute, or inject code from remote servers. All JavaScript is bundled at build time and included in the submitted zip artifact.

**Data Use Disclosure** (privacy practices form)

- Personal communications: Yes — the extension downloads course discussion text that the user can already access. This data stays in local browser storage and the local Downloads folder. It is not transmitted to third parties.
- User activity: No — the extension does not track, log, or transmit user browsing activity.
- Website content: Yes — the extension reads Edstem API responses for courses and threads accessible to the logged-in user. Content stays local.

**Privacy Policy URL**

[Phase 17 checkpoint required — user must supply the public HTTPS URL before submission]

**Single-purpose certifications**

The extension has a single purpose: downloading accessible Edstem course discussions as local Markdown. It does not include analytics, crash-reporting SDKs, remote font CDNs, or third-party trackers.

**Tester Notes** (for reviewer sandbox setup)

To test the extension, a reviewer needs an active Edstem account with at least one visible course. Sign in to https://edstem.org in the test browser profile, then click the extension icon. The popup should display the signed-in state and list available actions. All screenshots and fixture data in the submission are synthetic.

---

### Language: 中文 (Simplified Chinese)

**Name**

Edstem Archive

**Short Description**

使用当前浏览器登录状态，将可访问的 Edstem 课程讨论下载为本地 Markdown。

**Detailed Description**

Edstem Archive 是一个本地优先的浏览器扩展，适合想为自己可访问的 Edstem 课程讨论保存个人复习归档的学生。你先在浏览器里登录 Edstem，然后可以下载当前课程或全部可见课程，扩展会把 Markdown 文件保存到浏览器下载文件夹。

扩展不会要求输入 Edstem 凭据，不会收集 cookies，不使用宽泛站点权限，也不会把课程内容发送给第三方服务。同步状态和不含正文的进度/结果保存在本地浏览器存储中。

---

## Microsoft Edge Add-ons

### Category

Productivity

**Note:** Edge Add-ons submission should follow Chrome Web Store submission. Do not submit to Edge until Chrome review material (including the public privacy-policy URL) is finalized. See `PRE_SUBMIT_CHECKLIST.md` submission sequence.

### Language: English (US)

**Name**

Edstem Archive

**Short Description** (up to 200 characters)

Download accessible Edstem course discussions as local Markdown from your browser session.

**Long Description**

Edstem Archive is a local-first browser extension for students who want a personal, reviewable archive of their accessible Edstem course discussions. After you sign in to Edstem in the browser, the extension can download the current course or all visible courses and save Markdown files to your Downloads folder.

The extension does not ask for Edstem credentials, does not collect cookies, does not use broad host access, and does not send course content to third-party services. Sync state and body-free progress/results stay in local browser storage.

**Single-Purpose Statement** (for reviewer justification form)

Edstem Archive lets a signed-in Edstem user download discussions they can already access as local Markdown files.

**Permission Justifications**

- `activeTab`: Recognizes the current Edstem course tab when the user chooses the current-course workflow.
- `downloads`: Saves generated Markdown through the browser's Downloads API.
- `notifications`: Shows one terminal notification only on download completion, partial completion, or failure.
- `alarms`: Supports resumable Manifest V3 background work.
- `storage`: Keeps local extension state, resumability data, and body-free popup status. Not used for sync storage.
- `https://edstem.org/*` and `https://*.edstem.org/*` host permissions: Restrict network access to Edstem origins the user already has access to.

**Does your extension use remote code?**

No. All code is bundled at build time and included in the submitted zip artifact. No remote scripts, eval, or dynamic code execution.

**Privacy Policy URL**

[Phase 17 checkpoint required — user must supply the public HTTPS URL before submission]

---

### Language: 中文 (Simplified Chinese)

**Name**

Edstem Archive

**Short Description**

使用当前浏览器登录状态，将可访问的 Edstem 课程讨论下载为本地 Markdown。

**Long Description**

Edstem Archive 是一个本地优先的浏览器扩展，适合想为自己可访问的 Edstem 课程讨论保存个人复习归档的学生。你先在浏览器里登录 Edstem，然后可以下载当前课程或全部可见课程，扩展会把 Markdown 文件保存到浏览器下载文件夹。

扩展不会要求输入 Edstem 凭据，不会收集 cookies，不使用宽泛站点权限，也不会把课程内容发送给第三方服务。同步状态和不含正文的进度/结果保存在本地浏览器存储中。

---

## Dashboard Copy Alignment Check

This document must remain consistent with:

| Source | Key claim |
|--------|-----------|
| `PRIVACY.md` — "What the extension never does" | No telemetry, no third-party trackers, no credential collection |
| `PRIVACY.md` — "Network access" | Limited to `https://edstem.org/*` and `https://*.edstem.org/*` |
| `PRIVACY.md` — "Local storage" | IndexedDB only; no `chrome.storage.sync` for archive data |
| `PERMISSIONS.md` | All declared permissions with per-phase traceability |
| `STORE-LISTING.en.md` — "Single-Purpose Statement" | "Edstem Archive lets a signed-in Edstem user download discussions they can already access as local Markdown files." |

Do not paste dashboard text that contradicts any of these sources.
