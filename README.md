# Web Image Tool Pro

一个面板收齐整页图片：**按尺寸筛选、批量下载打包 ZIP、压缩转格式、相似图合并、直传图床**。
所有处理都在浏览器本地完成，不上传任何数据。

> Edge / Chrome / 其他 Chromium 内核浏览器通用 · 免费 · 无需注册

📄 **隐私政策 / Privacy Policy**：[中文](docs/privacy-policy.md) · [English](docs/privacy-policy.md#english)
　　— 扩展商店填写的隐私政策链接指向本仓库，请以以上页面为准。

🏠 **官网 / 更多工具**：[ztsite.com](https://www.ztsite.com)
　　— 想找作者的其他作品、看更多工具，请访问官网。

[![Edge Add-ons](https://img.shields.io/badge/Edge%20Add--ons-Install-667eea)](https://microsoftedge.microsoft.com/addons/detail/web-image-tool-pro/bajnpnkinbghodmhdgnjkeoanghfejhp)
[![Version](https://img.shields.io/badge/version-0.1.0-brightgreen)](https://microsoftedge.microsoft.com/addons/detail/web-image-tool-pro/bajnpnkinbghodmhdgnjkeoanghfejhp)

**[→ 从 Microsoft Edge 加载项商店安装](https://microsoftedge.microsoft.com/addons/detail/web-image-tool-pro/bajnpnkinbghodmhdgnjkeoanghfejhp)**

> 已上线：2026-11-19 审核通过。Edge 商店搜索「Web Image Tool Pro」同样可以找到。
> 商店标识（门店 ID `0RDCKC9HZ22R`、CRX `Bajnpnkinbghodmhdgnjkeoanghfejhp`）记录在
> [提交记录](docs/store-submission.md)。

## 文档

| 文档 | 内容 |
|---|---|
| [竞品与差距分析](docs/feature-gap.md) | 同类开源项目的功能梳理、我们的差距与路线图 |
| [商店文案](docs/store-listing.md) | Edge 商店的中英双语标题/描述/关键词/权限说明 |
| [上架清单](docs/release-checklist.md) | 打包命令、素材规格、提交流程、拒审预案 |
| [提交记录](docs/store-submission.md) | 各版本提交状态、商店 ID / CRX ID、审核期间待办 |
| [隐私政策](docs/privacy-policy.md) | 可直接部署的隐私政策（[HTML 版](docs/privacy-policy.html)） |
| [宣传文案](docs/promo-copy.md) | 商店短描述、公众号推文、社媒短文案 |
| [落地页](promo/landing.html) | 引流页（可直接部署到 ztsite.com） |
| [商店素材](promo/) | 徽标与宣传图 SVG 源文件 |

## 功能特性

### 图片提取
- **智能扫描**：自动检测页面所有图片，包括懒加载、背景图、SVG 等
- **网络监控**：实时捕获页面加载过程中的所有图片请求
- **完整性**：DOM 扫描 + CSSOM 扫描 + 网络层采集三路合并，覆盖懒加载、`srcset`、Shadow DOM、同源 iframe、`og:image`、CSS 背景/遮罩/边框图
- **记忆结果**：扫描结果按标签页缓存 30 分钟，关掉面板再打开直接复用，换页或点"重新扫描"才重置
- **筛选排序**：按尺寸（≥100/300/600/1000/1920 或自定义宽高）、按类型过滤，关键词包含与排除，支持按宽/高/面积/体积排序
- **按元素定位**：点缩略图上的 🎯 直接在页面上高亮并滚动到对应元素，面板会临时淡出
- **相似图合并**：dHash 感知哈希聚类，同一张图的缩略图/不同尺寸/webp 版本自动归并，只留最清晰那张
- **一键复制**：单张复制图片链接、批量复制所选链接（换行分隔）、预览里直接复制图片本身；也可复制 Data URL / Base64
- **排除规则**：关键词排除（如 `avatar,icon,logo`），一眼清掉头像与图标
- **批量下载**：逐张下载或打包 ZIP 一次搞定（内置 ZIP 写入，无第三方依赖）
- **去重处理**：自动过滤重复图片

### 图片处理
- **调整尺寸**：56 种预设尺寸（屏幕、社交媒体、电商、证件照、Web 图标/PWA、分享卡片/广告、设备屏幕 7 组）
- **裁剪图片**：支持矩形和圆形裁剪
- **压缩优化**：调整质量和大小，支持 JPG/PNG/WebP 格式转换，自动遵循 EXIF 方向（手机竖拍不再躺倒）
- **算法放大**：使用 Canvas API 进行 2x/3x/4x 放大
- **AI 放大**：可选接入自定义 AI 超分接口（推荐自建 Real-ESRGAN 网关），未配置时自动降级为本地逐级高质量放大
- **Base64 转换**：一键转换为 Data URL 或纯 Base64 编码

### GitHub 图床（PicX）
- **图片上传**：支持拖拽上传、批量上传
- **目录管理**：多级目录树浏览，支持创建、删除目录
- **图片管理**：查看、删除已上传图片
- **CDN 加速**：内置 5 种加速方式 + 自定义加速链接
  - GitHub 原始链接
  - jsDelivr CDN
  - Staticaly CDN
  - ghproxy 加速
  - i0.wp.com 加速
  - 自定义加速链接（支持变量替换）
- **链接生成**：自动生成 Markdown、HTML、各种 CDN 链接格式

### 其他功能
- **全屏界面**：100% 宽度全屏面板，6 列网格布局
- **右键菜单**：快速复制 Base64、下载图片
- **快捷键**：Alt+Shift+I 打开面板，Alt+Shift+D 批量下载
- **隐私保护**：所有图片处理均在本地完成，不上传用户数据
- **复制图片**：预览里一键把图片本身放进剪贴板，直接粘到文档/聊天窗口

## 安装方法

### 从商店安装（推荐）

- **Edge**：[Microsoft Edge 加载项商店](https://microsoftedge.microsoft.com/addons/detail/web-image-tool-pro/bajnpnkinbghodmhdgnjkeoanghfejhp) → 点「获取」
- **Chrome 及其他 Chromium 浏览器**：Chrome 应用商店暂未上架，请按下方本地加载

### 本地加载（开发版）

1. 下载或克隆本项目到本地
2. 打开浏览器扩展管理页面：
   - Chrome: `chrome://extensions/`
   - Edge: `edge://extensions/`
3. 开启右上角"开发者模式"
4. 点击"加载已解压的扩展程序"
5. 选择本项目文件夹
6. 固定插件到工具栏（推荐）

### 其他 Chromium 浏览器

Brave / Vivaldi / 百分 / QQ 浏览器等同样使用 `chrome://extensions` 开发者模式加载。

> Firefox 暂不支持：本项目使用 MV3 的 `background.service_worker` 与 `chrome.*` 命名空间，
> Firefox 需要 `browser.*` 与事件页适配，未做兼容层。

## 使用说明

### 1. 图片提取

1. 点击工具栏插件图标打开全屏面板
2. 在"图片检测"标签页点击"扫描页面"（懒加载站点用"深度扫描"，会滚动页面触发加载）
3. 用工具栏按尺寸/类型筛选、搜索、排序，勾选需要的图片
4. 点击"批量下载"（默认打包 ZIP，也可取消勾选后逐张下载）

### 2. 图片处理

1. 切换到"图片处理"标签页
2. 上传或拖拽图片
3. 选择工具（调整尺寸、裁剪、压缩、格式转换、放大、Base64）
4. 编辑后可预览，满意后下载

### 3. GitHub 图床

#### 配置图床
1. 切换到"设置"标签页
2. 在"GitHub 图床配置"区域填写：
   - GitHub Token（需要 repo 权限）
   - 用户名
   - 仓库名（默认：picx-images-hosting）
   - 分支（默认：master）
   - 图片加速方式
3. 点击"测试连接"验证配置

#### 使用图床
1. 切换到"图床"标签页
2. 上传图片或浏览已有图片
3. 点击查看详情，复制各种格式的链接

## 技术架构

- **Manifest V3**：最新 Chrome 扩展标准
- **Canvas API**：图片处理核心
- **Service Worker**：后台网络请求监控
- **Content Scripts**：页面图片检测
- **GitHub API**：图床功能实现
- **Chrome Storage API**：配置持久化

## 项目结构

```
web-img-tool/
├── manifest.json          # 扩展配置
├── common.js              # 共享工具（下载/ZIP/命名/尺寸探测）
├── background.js          # 后台服务（网络采集、下载、右键菜单）
├── content.js             # 内容脚本（DOM/CSSOM 扫描）
├── popup.js               # 弹窗逻辑
├── panel.html             # 全屏面板界面
├── panel.css              # 面板样式
├── picx.html              # 图床界面
├── picx.js                # 图床核心逻辑
├── picx-panel.js          # 图床面板逻辑
├── picx.css               # 图床样式
├── icons/
│   ├── icon.svg           # 图标唯一源文件，改动只改这里
│   └── icon{16,32,48,128}.png  # 由 scripts/build-assets.sh 生成
├── scripts/
│   ├── build-assets.sh    # 从 SVG 生成全部 PNG（扩展图标 + 商店素材）
│   └── package.sh         # 打包商店用的 zip（自带 manifest/完整性自检）
├── docs/                  # 竞品分析、商店文案、隐私政策、上架清单
└── promo/                 # 落地页与商店素材（store-logo.svg / store-tile.svg）
```

> 图标统一以 `icons/icon.svg` 为准：改完 SVG 执行 `bash scripts/build-assets.sh`，
> 会自动重出 4 个尺寸的图标以及商店徽标、宣传图，**不要手工改 PNG**。

## 隐私说明

- 所有图片处理均在本地浏览器中完成
- 不会上传任何图片数据到服务器
- 不收集浏览记录、页面内容或任何个人数据；无统计埋点、无广告
- 只有你主动配置并触发的功能才会联网：GitHub 图床（`api.github.com`）、第三方 AI 放大接口（你填写的地址）
- 完全开源，代码可审查

完整条款见 [隐私政策](docs/privacy-policy.md)。

## 兼容性

- Chrome 88+
- Edge 88+
- Firefox 78+（需临时加载）

## 快捷键

- `Alt+Shift+I`：打开插件面板
- `Alt+Shift+D`：批量下载当前页面图片
- `Alt+Shift+B`：复制悬停图片的 Base64 编码

## 开发说明

本项目使用原生 JavaScript 开发，无需构建工具。

修改代码后，在浏览器扩展管理页面点击刷新按钮即可生效。

## English

**Web Image Tool Pro** is a free browser extension that collects every image on a page and gets
them out in the format you need — all locally.

- Complete scan: DOM + stylesheets + network traffic, including lazy-loaded images, every `srcset`
  candidate, Shadow DOM, same-origin iframes, CSS background/mask/border images and `og:image`
- Filters: min width/height presets or custom, type filter, include/exclude keywords,
  sort by width / height / area / file size
- Output: batch download as a single ZIP, or one by one; resize (56 presets), crop, compress,
  convert JPG/PNG/WebP, upscale, export Base64
- Perceptual duplicate merge (dHash), click-to-locate the element on the page,
  optional GitHub image host with Markdown/HTML/CDN links
- Privacy: no account, no analytics, no ads. Nothing leaves your browser except the requests you
  explicitly trigger (GitHub API or your own AI endpoint)

Works in Microsoft Edge, Chrome and other Chromium browsers.
Docs: [feature gap analysis](docs/feature-gap.md) · [store listing](docs/store-listing.md) · [privacy](docs/privacy-policy.md)

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！

## 支持作者

如果这个项目对你有帮助，欢迎给予支持！

### 访问作者网站

[**ztsite.com**](https://ztsite.com) - 了解更多项目和工具

### 关注公众号

扫码关注微信公众号，获取最新动态和技术分享：

<p align="center">
  <img src="./assets/gzh1.jpg" alt="微信公众号二维码" width="200" />
</p>

### 打赏支持

如果这个工具帮你提升了效率，请作者喝杯咖啡吧 ☕

| 微信赞赏 | 支付宝 |
|:---:|:---:|
| <img src="./assets/微信收款码.png" alt="微信赞赏" width="160" /> | <img src="./assets/支付宝收款码.png" alt="支付宝" width="160" /> |

## 致谢

感谢所有开源项目的启发，特别是：
- [PicX](https://github.com/XPoet/picx) 图床工具的设计理念
- [Image Downloader](https://github.com/jsxiao/image-downloader)（PactInteractive 原版）在筛选与命名上的思路
- [Picviewer CE+](https://github.com/hoothin/UserScripts) 的图库与规则系统
- [Image Max URL](https://github.com/qsniyg/maxurl) 对"原图解析"的实践
- 各种 CDN 加速服务的支持
