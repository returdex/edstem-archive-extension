# EDstem Archive 扩展安装指南

**[English](INSTALL.md)** | **[中文](INSTALL.zh-CN.md)**

这是 v0.4 **开源自助安装**版本面向最终用户的安装指南。Chrome Web Store 和 Microsoft Edge Add-ons 上架计划放到后续 milestone。

扩展完全开源、完全在你的浏览器本地运行。不收集账号密码、不收集 cookies、无埋点、不会把你的课程内容上传到任何地方。完整的数据契约见 [PRIVACY.md](PRIVACY.md) 与 [PERMISSIONS.md](PERMISSIONS.md)。

---

## 准备工作

- Google Chrome **或** Microsoft Edge（基于 Chromium，建议当前稳定版）。
- 在同一个浏览器 profile 下已经登录 EDstem —— 扩展复用你已有的登录态，**绝不会**让你重新输入密码。
- 几 MB 的磁盘空间，用于下载的 `.zip` 和扩展的本地 IndexedDB 缓存。

当前只支持 Chromium MV3 浏览器（Chrome / Edge）。Firefox 和 Safari 是后续 milestone 的计划。

---

## 第 1 步 — 下载 Release

1. 打开本仓库 GitHub 的 **Releases** 页面。
2. 找到 `v0.4.0` 这个 release。
3. 在 **Assets** 下根据你的浏览器下载对应的 zip：
   - Chrome → `extension-chrome-v0.4.0.zip`
   - Edge → `extension-edge-v0.4.0.zip`
4. 解压。解压出来的文件夹根目录里应该能看到 `manifest.json`。

> **安全自查** —— 如果不放心可以自己检查解压后的文件夹。完整源码就在本仓库的 `extension/` 目录下。Release zip 由 `npm run package:chrome` / `npm run package:edge` 构建，且包内容由 [scripts/package-check.ts](scripts/package-check.ts) 把关（拒绝 source map、`.env`、tests、node_modules、过宽权限、和已知的私密数据标记）。

---

## 第 2 步 — 加载扩展

### Chrome

1. 在地址栏打开 `chrome://extensions`。
2. 打开右上角的 **开发者模式**。
3. 点击 **加载已解压的扩展程序 (Load unpacked)**。
4. 选择第 1 步解压出来的文件夹（含 `manifest.json` 的那个）。
5. 列表里应该会出现 "EDstem Archive" 这个扩展，带一个生成的图标。

### Edge

1. 在地址栏打开 `edge://extensions`。
2. 打开左侧栏的 **开发人员模式**。
3. 点击 **加载解压缩的扩展**。
4. 选择第 1 步解压出来的文件夹。
5. 如果 Edge 弹出关于加载第三方扩展的提示，允许即可。

> **说明** —— 开发者模式下每次启动浏览器都会显示一条黄色提示条。那只表示 Chrome/Edge 还不认识这个扩展（因为还没上架）。**不代表扩展本身不安全。**

---

## 第 3 步 — 开始使用

1. 点击浏览器工具栏里的 EDstem Archive 图标。
2. 确保你已经在同一浏览器 profile 下登录了 EDstem。
3. 弹窗会列出你能看到的课程。选一门课程，或者用 **下载全部课程**。
4. Markdown 文件会写到浏览器默认下载文件夹下的 `EdstemArchive/<课程>/<帖子>.md`。

如果出错：

- 看弹窗里显示的脱敏错误信息。
- 确认你还在 EDstem 登录态（可以新开 `edstem.org` 试一下）。
- 想看 service worker 日志：`chrome://extensions` → EDstem Archive → **Service worker** → **检查**（这些日志已经脱敏 —— 不含 cookies / auth header / 帖子正文）。

---

## 升级到新版本

1. 下载新版 release zip。
2. 解压（可以直接覆盖之前的文件夹）。
3. 打开 `chrome://extensions` / `edge://extensions`。
4. 点击 EDstem Archive 卡片上的 **重新加载 / Reload** 图标。

本地 IndexedDB 中已有的同步状态会保留。

---

## 卸载

1. 打开 `chrome://extensions` / `edge://extensions`。
2. 点击 EDstem Archive 卡片上的 **移除 / Remove**。
3. 浏览器会随卸载一起清掉扩展的本地 IndexedDB 数据。你之前下载到 `EdstemArchive/` 的 Markdown 文件不会被动到。

---

## 自己从源码构建（可选）

如果你不想用预编译的 release zip，可以从本仓库自己构建：

```powershell
git clone <本仓库>
cd <仓库>/extension
npm ci
npm run build           # 构建 Chrome 版
npm run build:edge      # 构建 Edge 版
```

然后第 2 步里加载 `extension/.output/chrome-mv3` 或 `extension/.output/edge-mv3` 文件夹即可，不需要再解压 release zip。

`npm run verify` 会把构建、单元测试和 policy check 串成一条链跑完，加载前推荐先跑一遍。

---

## 反馈问题

这是开源自助安装的 release。请到本仓库的 GitHub Issues 提问题。

反馈时请带上：

- 浏览器名称 + 版本（例如 Chrome 121、Edge 120）。
- 操作系统（例如 Windows 11、macOS 14）。
- 脱敏后的现象描述。**不要贴 cookies、auth header、真实课程 ID、真实学生名、私密讨论内容** —— 扩展自身永远不会记录这些，我们也不能接受含这些内容的 bug 报告。
