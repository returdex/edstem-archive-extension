# Edstem Archive 商店文案 - 中文

## 单一用途说明

Edstem Archive 帮助已登录 Edstem 的用户，将自己可访问的讨论下载为本地 Markdown 文件。

## 简短描述

使用当前浏览器登录状态，将可访问的 Edstem 课程讨论下载为本地 Markdown。

## 详细描述

Edstem Archive 是一个本地优先的浏览器扩展，适合想为自己可访问的 Edstem 课程讨论保存个人复习归档的学生。你先在浏览器里登录 Edstem，然后可以下载当前课程或全部可见课程，扩展会把 Markdown 文件保存到浏览器下载文件夹。

扩展不会要求输入 Edstem 凭据，不会收集 cookies，不使用宽泛站点权限，也不会把课程内容发送给第三方服务。同步状态和不含正文的进度/结果保存在本地浏览器存储中。

## 权限说明摘要

- `activeTab`：当你选择“下载当前课程”时识别当前 Edstem 课程标签页。
- `downloads`：通过浏览器 Downloads API 保存生成的 Markdown。
- `notifications`：仅在下载完成、部分完成或失败时显示一条终态通知。
- `alarms`：支持 Manifest V3 后台任务的可恢复执行。
- `storage`：保存本地扩展状态、恢复数据和 popup 状态。
- `https://edstem.org/*` 和 `https://*.edstem.org/*`：将网络访问和侧边栏课程发现限制在 Edstem 来源。

## 截图说明

1. 在 popup 中下载当前课程或全部可见课程。
2. 查看简洁进度和不含正文的下载结果。
3. 阅读简短 onboarding，了解本地保存和现有登录状态的使用方式。

## 隐私政策说明

商店提交前使用与 `extension/PRIVACY.md` 内容一致的公开隐私政策 URL。

## 支持和审核说明

截图和示例数据均为合成内容。Phase 16 只准备审核前材料；Phase 17 负责真实商店提交和最终人工验证。
