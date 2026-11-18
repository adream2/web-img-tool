# Web Image Tool Pro 隐私政策

最后更新：2026-11-18
适用版本：0.1.0 及以上

## 一句话说明

本扩展**不收集、不上传、不转售**任何个人信息或浏览数据。图片的扫描、处理、压缩与格式转换全部在你的浏览器本地完成。

---

## 1. 我们不收集什么

- 不收集浏览历史、访问的网址、页面内容
- 不收集图片内容本身，也不回传任何图片
- 不收集账号、设备标识、位置
- 无统计埋点、无广告 SDK、无第三方分析服务
- 没有服务器，扩展不向开发者回传任何数据

## 2. 数据在哪里处理

| 动作 | 处理位置 | 是否联网 |
|---|---|---|
| 扫描页面图片 | 你的浏览器内（页面脚本 + Service Worker） | 否 |
| 尺寸探测、相似图比对 | 你的浏览器内（Canvas） | 否 |
| 裁剪 / 缩放 / 压缩 / 转格式 / 放大 | 你的浏览器内（Canvas） | 否 |
| 下载图片 | 你的浏览器下载管理器 | 仅请求图片原始地址 |
| 图片上传到 GitHub 图床 | 你的浏览器 → `api.github.com` | 是（仅当你主动点击上传且已配置） |
| AI 放大 | 你的浏览器 → 你填写的接口地址 | 是（仅当你主动点击放大且已配置） |

## 3. 本地存储的内容

扩展使用浏览器提供的 `chrome.storage` 保存配置，这些数据留在你的设备上，随浏览器账号同步（若你开启同步）：

| 键 | 内容 | 位置 |
|---|---|---|
| `defaultFormat` / `defaultQuality` | 默认输出格式与质量 | `storage.sync` |
| `picxToken` / `picxOwner` / `picxRepo` / `picxBranch` / `picxCdnType` / `picxCustomCdn` | GitHub 图床配置（你自行填写） | `storage.sync` |
| `aiUpscaleApiKey` / `aiUpscaleEndpoint` / `aiUpscaleProvider` | 第三方 AI 放大接口配置（你自行填写） | `storage.sync` |
| `wit-scan-cache` | 最近一次扫描到的图片地址清单，30 分钟自动过期 | `storage.session`（关闭浏览器即清除） |

GitHub Token 与 API Key **只**用于向对应服务发起请求，不经过任何中间服务器，开发者无法获取。

## 4. 权限用途

| 权限 | 用途 |
|---|---|
| `activeTab` / `tabs` | 读取当前标签页标识，用于把扫描结果与标签页对应 |
| 全站访问（`<all_urls>`） | 图片可能位于任意网站，需要读取页面中的图片地址与样式信息 |
| `scripting` | 在用户点击扫描时向当前页注入扫描脚本 |
| `storage` | 保存你的设置与临时扫描缓存 |
| `downloads` | 保存你选择下载的图片 |
| `contextMenus` | 提供图片右键菜单项 |
| `webRequest` | 被动监听图片响应，补齐页面脚本看不到的图片（不修改、不拦截请求） |
| `webNavigation` | 页面跳转时清空上一页缓存，避免混入上一页图片 |

所有权限仅服务于上述功能，不用于任何形式的数据采集。

## 5. 第三方服务

只有在**你主动配置并触发**时，扩展才会与你指定的第三方服务通信：

- **GitHub**（`api.github.com`）：上传图片、读取仓库目录。适用 GitHub 隐私声明。
- **AI 放大接口**（地址由你填写）：上送你选择放大的那张图片，返回处理结果。该服务的数据处理行为由其提供方决定，请自行确认其隐私条款。

除上述情况外，扩展不会与任何第三方通信。

## 6. 数据共享与出售

我们不出售、不出租、不共享任何用户数据。没有数据可供共享——扩展不收集数据。

## 7. 数据删除

- 卸载扩展：浏览器会删除该扩展的全部本地存储
- 只清配置：在扩展「设置」中清空 GitHub / AI 配置，或在浏览器的扩展存储管理中清除
- 扫描缓存：30 分钟自动过期，关闭浏览器立即清除

## 8. 儿童隐私

本扩展不面向 13 岁以下儿童设计，也不收集任何年龄相关信息。

## 9. 政策变更

若未来版本引入需要联网的新功能，我们会在本页面更新说明，并在扩展的版本更新说明中注明。继续使用即表示接受更新后的政策。

## 10. 联系方式

- 网站：https://www.ztsite.com
- 反馈：https://www.ztsite.com （站内留言）

---

*本政策以中文版本为准。*

---

# English

**Web Image Tool Pro — Privacy Policy**

Last updated: 2026-11-18 · Applies to version 0.1.0 and later

## In one sentence

This extension **does not collect, upload or sell** any personal information or browsing data.
Scanning, processing, compression and format conversion all happen locally in your browser.

## 1. What we do not collect

- No browsing history, visited URLs or page content
- No image content, and no image is ever sent back to us
- No account, device identifier or location
- No analytics, no advertising SDK, no third-party analytics service
- There is no backend server; the extension sends no data to the developer

## 2. Where data is processed

| Action | Where | Network |
|---|---|---|
| Scanning page images | In your browser (page script + service worker) | No |
| Size probing, duplicate comparison | In your browser (Canvas) | No |
| Crop / resize / compress / convert / upscale | In your browser (Canvas) | No |
| Downloading an image | Your browser's download manager | Only requests the image's own URL |
| Uploading to a GitHub image host | Your browser → `api.github.com` | Yes (only when you click upload and have configured it) |
| AI upscale | Your browser → the endpoint you entered | Yes (only when you click upscale and have configured it) |

## 3. What is stored locally

The extension uses the browser's `chrome.storage` API. Data stays on your device and syncs with
your browser profile if you have sync enabled.

| Key | Content | Area |
|---|---|---|
| `defaultFormat` / `defaultQuality` | Default output format and quality | `storage.sync` |
| `picxToken` / `picxOwner` / `picxRepo` / `picxBranch` / `picxCdnType` / `picxCustomCdn` | GitHub image host settings you entered | `storage.sync` |
| `aiUpscaleApiKey` / `aiUpscaleEndpoint` / `aiUpscaleProvider` | Third-party AI upscale settings you entered | `storage.sync` |
| `wit-scan-cache` | Image URLs from the most recent scan, expires after 30 minutes | `storage.session` (cleared when the browser closes) |

Your GitHub token and API key are used **only** to call the corresponding service directly.
They never pass through an intermediary, and the developer cannot read them.

## 4. Why each permission is needed

| Permission | Purpose |
|---|---|
| `activeTab` / `tabs` | Read the current tab id so a scan result can be tied to that tab |
| Host access (`<all_urls>`) | Images can live on any website; the extension needs to read image URLs and page styles |
| `scripting` | Inject the scanner into the current page when the user clicks scan |
| `storage` | Save your settings and the short-lived scan cache |
| `downloads` | Save images you chose to download |
| `contextMenus` | Provide image right-click menu items |
| `webRequest` | Passively observe image responses the page script cannot see (never modifies or blocks requests) |
| `webNavigation` | Clear the previous page's cache on navigation so images are not mixed up |

Permissions serve the features above and nothing else.

## 5. Third-party services

The extension contacts a third party **only when you configure it and explicitly trigger it**:

- **GitHub** (`api.github.com`) — upload images, read repository directories. GitHub's own privacy
  statement applies.
- **AI upscale endpoint** (address entered by you) — sends the single image you chose to upscale and
  returns the result. That provider's data handling is governed by its own terms.

Outside those cases the extension communicates with no third party.

## 6. Sharing and selling

We do not sell, rent or share user data. There is no data to share — the extension collects none.

## 7. Deleting your data

- Uninstalling the extension removes all of its local storage
- To clear settings only, empty the GitHub / AI fields in the extension's Settings
- The scan cache expires after 30 minutes and is cleared when the browser closes

## 8. Children's privacy

The extension is not directed to children under 13 and collects no age-related information.

## 9. Changes

If a future version adds a feature that requires network access, this page and the release notes
will be updated. Continued use means you accept the updated policy.

## 10. Contact

- Website: https://www.ztsite.com
- Feedback: https://www.ztsite.com (site contact form)

---

*The Chinese version is the authoritative one.*
