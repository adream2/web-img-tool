# Edge 商店上架清单

## 0. 一次性准备（约 30 分钟）

- [ ] Microsoft 账户（Outlook/Hotmail）注册合作伙伴中心，免费
- [ ] 确定隐私政策 URL（见第 4 节，**必填**，Edge 审查比 Chrome 更严）
- [ ] 准备中英双语商店文案（`docs/store-listing.md` 已备好，直接粘）
- [ ] 确认版本号：`manifest.json` 的 `version` 必须与提交的更新说明一致

## 1. 打包

一条命令即可，版本号取自 `manifest.json`：

```bash
cd /e/WorkBuddy/web-img-tool
bash scripts/package.sh                 # 输出到 dist/
bash scripts/package.sh ~/Desktop      # 或直接输出到桌面
```

脚本会自动自检，任何一项不过就报错退出：

- `manifest.json` 在 zip 根目录
- manifest 引用的文件（background / content / icons）都在包内
- 不混入 `.git/ docs/ promo/ .workbuddy/ node_modules/`
- zip 完整性校验（CRC）
- 打印版本号、文件数、体积与 SHA256

包体积约 77 KB（上限 100 MB）。只打运行时文件，源码 SVG、文档、落地页都不进包。

## 2. 素材清单

> 图标与商店素材统一由 `bash scripts/build-assets.sh` 从 SVG 生成，改样式只改 SVG 后重跑，
> 不要手工替换 PNG（否则又会出现图标不一致）。

| 素材 | 规格 | 必需 | 文件 |
|---|---|---|---|
| 扩展图标 | 16/32/48/128 PNG | ✅ | `icons/icon{16,32,48,128}.png`（源：`icons/icon.svg`） |
| 商店徽标 | 300×300 PNG | 建议 | `promo/store-logo-300.png`（源：`promo/store-logo.svg`） |
| 宣传图块 | 440×280 PNG | 建议 | `promo/store-tile-440x280.png`（源：`promo/store-tile.svg`） |
| 截图 | **1280×800** 或 640×400，PNG/JPG，1–10 张 | ✅ 至少 1 张 | 建议 4 张，见下表 |
| 大宣传图 | 1400×560 | 可选 | 仅编辑推荐位使用 |
| 宣传视频 | YouTube 链接 | 可选 | 15–30 秒录屏转化最好 |

### 建议的 4 张截图（每张只讲一件事）

| # | 画面 | 建议角标文案 |
|---|---|---|
| 1 | 面板「图片检测」页，已扫描出大量缩略图，筛选栏可见 | 一个面板收齐整页图片 |
| 2 | 勾选若干图 + 点批量下载（或显示 ZIP 下载提示） | 批量下载打包 ZIP |
| 3 | 点 🎯 后页面上的聚光灯高亮 + 面板淡出 | 点图定位到页面元素 |
| 4 | 「图片处理」页调整尺寸弹窗（预设尺寸分组）或预览里的复制/下载 | 56 种预设尺寸，改完直接下 |

截图要点：1280×800 是 16:10，不要贴边留白太少；避免露出个人账号、私信、无关书签；用干净页面（如 Unsplash 图集页）做背景。

> 没有设计工具时可临时用浏览器 DevTools 的设备模拟设 1280×800 截图，再用系统截图工具裁切。

## 3. 提交步骤

1. 合作伙伴中心 → Edge → 新建提交 → 上传 zip（系统会自动校验 manifest）
2. 可用性：公共；市场：全选（或先上中文区观察）
3. 属性：类别「生产力」，填隐私政策 URL、支持 URL、网站
4. 商店一览表：为 `zh-CN` 与 `en-US` 各建一份，粘 `docs/store-listing.md` 对应段落
5. 上传徽标 / 图块 / 截图
6. 提交审核 → 通常 **3–7 天**（更新约 1–2 天）
7. 通过后拿到 `microsoftedge.microsoft.com/addons/detail/...` 链接，回填到落地页与 README

## 4. 隐私政策部署

`docs/privacy-policy.html` 是可直接部署的静态页，三种落法：

| 方式 | 步骤 | 适合 |
|---|---|---|
| ztsite.com 自定义页面 | WordPress 新建页面 → 用「自定义 HTML」区块粘贴内容，或用 Elementor HTML 组件 | 已备案、有域名，推荐 |
| 静态托管 | 放到站点子目录 `/privacy/web-image-tool-pro.html` | 最简单，URL 稳定 |
| GitHub Pages | 仓库 Settings → Pages → 从 `docs/` 发布，URL 为 `https://<user>.github.io/web-img-tool/privacy-policy.html` | 零成本备选 |

URL 建议固定，后续不要变（审核记录里会引用）。

## 5. 常见拒审原因（提前规避）

| 原因 | 规避做法 |
|---|---|
| 隐私政策缺失或与功能不符 | 明确写出「不收集数据」+ 每个联网功能都点名（GitHub、AI 接口） |
| 权限过度 | 在描述或隐私政策里逐条解释全站权限；不要为省事申请 `history`、`cookies` 等无关权限 |
| 描述含"最好""第一"等绝对化用语 | 文案里不写排名性表述 |
| 图标与商店素材分辨率不足 | 用 128/300/440 的原始尺寸，不要放大低清图 |
| 功能与描述不一致 | 描述里提到的 ZIP、格式转换必须真的能用（0.1.0 已修） |
| 首次安装强制跳转/引导页 | 本扩展无首次跳转，保持现状 |

## 6. 发布后

- [ ] 落地页与 README 回填商店链接
- [ ] 观察 7 天的安装/卸载比；卸载高优先查「权限提示吓退」与「扫描不全」
- [ ] 收集差评关键词（尺寸筛选、下载失败、ZIP）→ 进 v1.3 待办
- [ ] 每次发版同步更新 `docs/store-listing.md` 的「本版本更新说明」与 `manifest.json` 版本号

## 7. 落地页部署（引流 ztsite.com）

`promo/landing.html` 是自包含单页（无外部 CDN、无外链字体），直接扔到站点即可。

1. 上传到 `https://www.ztsite.com/web-image-tool`（WordPress 用「自定义 HTML」区块嵌入，或直接放静态目录）
2. **替换 3 处商店链接占位**：搜索 `microsoftedge.microsoft.com/addons/`，换成真实详情页 URL（导航按钮、首屏 CTA、底部 CTA）
3. **上传二维码**：`promo/assets/gzh1.jpg` 与页面一起上传（相对路径 `assets/gzh1.jpg` 才能正确加载），或改成站点里已有的图片绝对地址
4. **改隐私政策链接**：`./privacy-policy.html` 换成隐私政策的真实 URL
5. 标题/描述已经写好（`<title>` 与 `og:*`），若站点有 SEO 插件，注意不要被覆盖
6. 上线后在 README 和商店描述里回填这个落地页地址

### 埋点建议（可选）

若站点装了统计，给 CTA 加 UTM 便于分辨来源：

```
https://www.ztsite.com/web-image-tool?utm_source=edge&utm_medium=store&utm_campaign=listing
```
