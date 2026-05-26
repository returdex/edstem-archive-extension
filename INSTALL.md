# Install the EDstem Archive Extension

**[English](INSTALL.md)** | **[中文](INSTALL.zh-CN.md)**

This is the end-user install guide for the v0.4 open-source self-install release. Chrome Web Store and Microsoft Edge Add-ons listings are planned for a later milestone.

The extension is open source and runs entirely in your browser. It does not collect credentials, cookies, telemetry, or upload your course content anywhere. See [PRIVACY.md](PRIVACY.md) and [PERMISSIONS.md](PERMISSIONS.md) for the full data contract.

---

## What you need

- Google Chrome **or** Microsoft Edge (Chromium-based, current stable).
- A logged-in EDstem session in the same browser profile (the extension piggybacks on your existing login — it never asks for your password).
- A few MB of disk for the downloaded `.zip` and the extension's local IndexedDB cache.

The extension currently targets Chromium MV3 browsers (Chrome and Edge). Firefox and Safari are planned for later.

---

## Step 1 — Download the release

1. Go to this repo's **Releases** page on GitHub.
2. Find the `v0.4.0` release.
3. Under **Assets**, download the zip that matches your browser:
   - Chrome → `extension-chrome-v0.4.0.zip`
   - Edge → `extension-edge-v0.4.0.zip`
4. Unzip it. You should get a folder with a `manifest.json` at its root.

> **Safety check** — Inspect the unzipped folder if you like. The whole source tree is in this repo under `extension/`. The release zip is built from `npm run package:chrome` / `npm run package:edge`, and the package contents are gated by [scripts/package-check.ts](scripts/package-check.ts) (rejects source maps, `.env`, tests, node_modules, broad permissions, and known private-data markers).

---

## Step 2 — Load the extension

### Chrome

1. Open `chrome://extensions` in the address bar.
2. Turn on **Developer mode** (top-right toggle).
3. Click **Load unpacked**.
4. Select the unzipped folder from Step 1 (the one containing `manifest.json`).
5. The "EDstem Archive" extension should now appear in your list with a generated icon.

### Edge

1. Open `edge://extensions` in the address bar.
2. Turn on **Developer mode** (left sidebar).
3. Click **Load unpacked**.
4. Select the unzipped folder from Step 1.
5. Allow Edge's prompt about loading a third-party extension if it appears.

> **Note** — Developer mode shows a banner each time you start the browser. That banner only means Chrome/Edge does not know about this extension yet (it has not been submitted to the stores). It does **not** mean the extension is unsafe.

---

## Step 3 — Use it

1. Click the EDstem Archive icon in your browser toolbar.
2. Make sure you are logged in to EDstem in the same browser profile.
3. The popup shows your visible courses. Pick a course or use **Download all courses**.
4. Markdown files are written to your browser's Downloads folder under `EdstemArchive/<course>/<thread>.md`.

If something fails:

- Check the popup for the sanitized error message.
- Confirm you are still logged in to EDstem (re-open `edstem.org` in a tab).
- Check `chrome://extensions` → EDstem Archive → **Service worker** → **Inspect** if you want service-worker logs (these logs are sanitized — no cookies / no auth headers / no post bodies).

---

## Update to a newer version

1. Download the new release zip.
2. Unzip it (you can replace the previous folder).
3. Open `chrome://extensions` (or `edge://extensions`).
4. Click the **Reload** icon on the EDstem Archive tile.

Your local IndexedDB sync state survives the reload.

---

## Uninstall

1. Open `chrome://extensions` / `edge://extensions`.
2. Click **Remove** on the EDstem Archive tile.
3. The extension data (IndexedDB) is removed by the browser as part of uninstall. Your downloaded Markdown files in `EdstemArchive/` are left untouched.

---

## Build it yourself (optional)

If you would rather not trust a released zip, you can build the extension locally from this repo:

```powershell
git clone <this-repo>
cd <repo>/extension
npm ci
npm run build           # for Chrome
npm run build:edge      # for Edge
```

Then in Step 2 above, load the resulting `extension/.output/chrome-mv3` or `extension/.output/edge-mv3` folder instead of unzipping a release.

`npm run verify` runs the full build + unit-test + policy-check chain before you load it.

---

## Reporting issues

This is an open-source self-install release. Please open issues on the repo's GitHub issue tracker.

When reporting, please include:

- Browser name + version (e.g., Chrome 121, Edge 120).
- Operating system (e.g., Windows 11, macOS 14).
- Sanitized description of what happened. **Do not paste cookies, auth headers, real course IDs, real student names, or private discussion text** — the extension itself never logs these, and we cannot accept bug reports that include them.
