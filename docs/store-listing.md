# Edge Add-ons 商店文案（可直接复制）

> 填写位置：合作伙伴中心 → Edge → 新建提交 → 商店一览表（Store listing）。
> Edge 按用户语言展示对应条目，建议同时维护 **中文（简体）** 与 **英语（美国）**。

> **0.1.0 实际提交情况**（2026-11-18）：仅提交了 `en-US`，类别「生产力」、可见度「公众」。
> 中文文案保留在下方第一节，在下次更新时新增 `zh-CN` 语言条目即可复用，
> 当前中文用户看到的仍是英文 listing。状态与 ID 见 [提交记录](store-submission.md)。

---

## 一、中文（简体）

### 名称（≤45 字符）

```
Web Image Tool Pro — 网页图片提取与处理
```

备选（更强调下载）：

```
Web Image Tool Pro — 网页图片批量下载与处理
```

### 简短描述（≤80 字符）

```
提取网页全部图片：按尺寸筛选、批量下载打包 ZIP、压缩转格式、直传图床。全本地处理，不上传任何数据。
```

（52 字符）

### 详细描述

```
一个面板，把网页上的图片全部收齐、筛干净、处理好。

━━━━━━━━━━━━━━━━━━━━
为什么是它
━━━━━━━━━━━━━━━━━━━━
· 扫得全：DOM + 样式表 + 网络层三路合并，懒加载、srcset 多倍图、Shadow DOM、同源 iframe、CSS 背景/遮罩/边框图、og:image 都能抓到
· 筛得准：按尺寸（≥100 / 300 / 600 / 1000 宽 / 1920 宽 / 自定义宽高）、按类型、按关键词包含与排除；支持按宽/高/面积/体积排序
· 下得快：勾选后一次打包成 ZIP，也可以逐张下载；文件名自动净化，同一张图不会重复保存
· 处理得了：调整尺寸（56 种预设：屏幕、社交、电商、证件照、Web 图标/PWA、广告位、设备屏）、裁剪、压缩、格式互转（JPG/PNG/WebP）、高质量放大、转 Base64
· 找得回：点缩略图上的 🎯 直接在页面上高亮并滚动到对应元素，面板会临时淡出方便你看清
· 去得重：感知哈希自动把同一张图的缩略图、不同尺寸、webp 版本归并成一张，只留最清晰的那张
· 存得走：可选配置 GitHub 图床，一键上传并生成 Markdown / HTML / CDN 链接

━━━━━━━━━━━━━━━━━━━━
适合谁
━━━━━━━━━━━━━━━━━━━━
· 公众号 / 小红书 / B 站作者：找素材、批量存图、转格式、上传图床一条龙
· 电商运营：按尺寸筛选详情图，按平台预设批量改尺寸
· 设计与前端：提取整站图标与背景图，按 PWA 图标尺寸表批量导出
· 开发者：抓取接口返回图、复制 Base64 / Data URL、定位元素

━━━━━━━━━━━━━━━━━━━━
怎么用
━━━━━━━━━━━━━━━━━━━━
1. 点工具栏图标（或 Alt+Shift+I）打开面板
2. 点「扫描页面」；图片多的长页面用「深度扫描」，会自动滚动触发懒加载
3. 用尺寸/类型/关键词筛一筛，勾选需要的图
4. 「批量下载」默认打包 ZIP；也可以在预览里单张下载、复制链接、复制图片、直接编辑

━━━━━━━━━━━━━━━━━━━━
隐私
━━━━━━━━━━━━━━━━━━━━
图片的扫描、处理、压缩、转格式全部在你的浏览器本地完成，不上传任何图片或浏览记录。没有账号体系、没有统计埋点、没有广告。
只有你主动配置的可选功能才会联网：GitHub 图床（只请求 api.github.com）与第三方 AI 放大接口（只请求你填写的地址）。配置随时可在扩展里清空，卸载扩展即删除全部本地数据。

━━━━━━━━━━━━━━━━━━━━
说明
━━━━━━━━━━━━━━━━━━━━
· 需要访问网页内容才能发现图片，因此申请了全站访问权限，该权限仅用于读取页面图片地址
· 部分站点用了防盗链或需要登录，个别图片可能无法下载，此时会明确提示原因
· 不支持付费墙后的图片、DRM 内容
```

### 搜索关键词

```
图片下载, 批量下载图片, 网页图片提取, 图片批量保存, 图片压缩, 图片格式转换, webp 转 png, 图片尺寸, 图床, 图片筛选, 抓图, 素材收集, image downloader, bulk image download
```

### 分类与属性

| 项 | 建议值 |
|---|---|
| 类别 | 生产力（Productivity） |
| 次类别 | 开发者工具 / 照片与视频（择一） |
| 年龄分级 | 3+ / 全年龄（不收集数据、无社交内容） |
| 支持 URL | `https://www.ztsite.com/`（或扩展落地页） |
| 隐私政策 URL | `https://www.ztsite.com/privacy/web-image-tool-pro`（部署 `docs/privacy-policy.html`） |
| 网站 | `https://www.ztsite.com/` |

> **0.1.0 实填值与此不同**：三个 URL 都填了 GitHub 仓库（落地页尚未部署时的临时方案）。
> 下次提交（≥ 0.1.1）换成上表的 ztsite 地址，细节见 [提交记录](store-submission.md)。
>
> 0.1.0 已于 2026-11-19 上架：
> `https://microsoftedge.microsoft.com/addons/detail/web-image-tool-pro/bajnpnkinbghodmhdgnjkeoanghfejhp`
| 定价 | 免费 |

### 本版本更新说明（v0.1.0 首发）

```
· 修复：Service Worker 休眠后扫描结果丢失，导致图片列表不全
· 修复：处理后图片的下载按钮无效（blob 链接跨进程失效）
· 修复：右键复制 Base64、后台格式转换实际未生效
· 新增：按尺寸/类型筛选、关键词搜索与排除、6 种排序
· 新增：批量下载打包 ZIP、批量转换真正应用尺寸
· 新增：点图定位到页面元素（聚光灯高亮）
· 新增：相似图合并（按画面内容，不只是 URL 去重）
· 新增：预览里"复制图片"直接粘到文档或聊天窗口
· 新增：关键词排除（一次清掉头像/图标/广告位）
· 新增：扫描结果缓存 30 分钟，关掉面板再打开不用重扫
· 优化：手机竖拍图按 EXIF 方向正确显示；56 种预设尺寸分组
```

---

## 二、English (United States)

### Name (≤45 chars)

```
Web Image Tool Pro — Image Downloader
```

### Short description (≤80 chars)

```
Bulk-grab images, filter by size, download as ZIP, convert formats. 100% local.
```

### Detailed description

```
One panel to collect every image on a page, filter it down, and get it out in the format you need.

WHY THIS ONE
· Complete scan — DOM, stylesheets and network traffic merged. Catches lazy-loaded images, every srcset candidate, Shadow DOM, same-origin iframes, CSS background/mask/border images and og:image.
· Sharp filters — minimum width/height presets or custom values, filter by type, include/exclude keywords, sort by width, height, area or file size.
· Batch out — pack the selection into a single ZIP, or download one by one. File names are sanitized and duplicates never overwrite each other.
· Edit in place — resize (56 presets for screens, social, e-commerce, ID photos, web icons/PWA, ad slots, devices), crop, compress, convert between JPG/PNG/WebP, upscale, export Base64.
· Find it back — hit the target icon on a thumbnail and the page scrolls to that exact element with a spotlight highlight; the panel fades out so you can see it.
· Fewer duplicates — perceptual hashing groups thumbnails, resized copies and webp variants of the same picture into one, keeping the sharpest.
· Ship it — optional GitHub image host: upload and get Markdown / HTML / CDN links in one click.

WHO IT IS FOR
Writers and social media creators collecting assets, e-commerce operators batch-resizing product shots, designers and front-end devs pulling icons and backgrounds, developers inspecting image responses.

HOW TO USE
1. Click the toolbar icon (or Alt+Shift+I)
2. Press "Scan page"; use "Deep scan" on long pages — it scrolls to trigger lazy loading
3. Filter by size, type or keyword and tick what you need
4. Download as ZIP, or open a preview to download, copy the link, copy the image, or edit it

PRIVACY
Scanning, processing, compression and conversion all happen locally in your browser. No images or browsing history are uploaded. No account, no analytics, no ads.
Only features you explicitly configure make network requests: the GitHub image host (api.github.com only) and a third-party AI upscale endpoint you provide. Clear the configuration any time; uninstalling removes all local data.

NOTES
· Full site access is required to discover images on the page; it is used only to read image URLs
· Some sites use hotlink protection or require login — failures are reported with a clear reason
· Paid content and DRM-protected media are not supported
```

### Search terms

```
image downloader, bulk image download, save all images, image extractor, webp to png, image resizer, image compressor, screenshot assets, picture grabber
```

---

## 三、权限用途说明（审核会看，提前备好）

| 权限 | 用途说明（可直接复制） |
|---|---|
| `activeTab` | 用户主动点击图标时读取当前标签页，用于扫描该页图片 |
| `tabs` | 获取当前标签页的 id 与 URL，把扫描结果与标签页对应；不读取历史记录 |
| `<all_urls>`（主机权限） | 图片存在于任意网站，需要在页面中执行扫描脚本并读取图片地址；仅读取图片 URL 与页面结构，不上传页面内容 |
| `scripting` | 向当前页注入扫描脚本，用于统计 DOM/样式表中的图片 |
| `storage` | 保存用户设置（默认格式、质量、图床配置）与 30 分钟内的扫描缓存 |
| `downloads` | 保存用户选择下载的图片，支持子目录与批量下载 |
| `contextMenus` | 提供「复制图片 Base64 / 下载图片 / 图片另存为」右键菜单 |
| `webRequest` | 被动监听图片响应（含 iframe 内与 CSS 引用），补齐 DOM 扫不到的图；不修改、不拦截请求 |
| `webNavigation` | 页面跳转时清空上一页的扫描缓存，避免串页 |

要点：本扩展**不收集任何个人数据**，所有网络请求只发生在用户主动触发的下载/上传/放大动作中。

---

## 四、审核应对预案

| 可能的质疑 | 回答口径 |
|---|---|
| 为什么要全站权限？ | 图片可能出现在任何站点；权限仅用于读取图片地址与页面结构，代码开源可查 |
| 会不会窃取数据？ | 无远端服务器、无埋点；只有用户自填的 GitHub / AI 接口会连网，且地址由用户指定 |
| 是否修改网页？ | 仅在用户点击图标时插入一个覆盖层面板与高亮框，不修改页面内容与请求 |
| 图床功能是否代收 token？ | Token 只存在浏览器本地 `chrome.storage.sync`，直接请求 GitHub 官方 API，不经过任何中间服务器 |
