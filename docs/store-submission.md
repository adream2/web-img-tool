# 商店提交记录

> 记录每次提交的版本、状态与官方分配的标识。发版或排查「商店里搜不到」「链接打不开」时以此为准。

## 0.1.0 — 首次提交

| 项 | 值 |
|---|---|
| 扩展名称 | Web Image Tool Pro |
| 版本 | 0.1.0 |
| 提交时间 | 2026-11-18 |
| 通过时间 | **2026-11-19**（1 个工作日，无补件） |
| 状态 | **已上架** |
| 类别 | 生产力 |
| 可见度 | 公众 |
| 商店语言 | 英语（美国）`en-US` |
| 提交包 | `dist/web-image-tool-pro-0.1.0.zip`，17 个文件 / 77.1 KB |
| 包 SHA256 | `494b7063f4dcf7ad41dfcc7deddf23a1757e6aab7dae94cd63b399688a50e081` |

### 官方标识

| 标识 | 值 | 用途 |
|---|---|---|
| 门店 ID | `0RDCKC9HZ22R` | 合作伙伴中心内部编号 |
| CRX ID | `Bajnpnkinbghodmhdgnjkeoanghfejhp` | **商店详情页 URL 用这个**，也是浏览器里的扩展 ID |
| 产品 ID | `a61cd6b5-AAA4-4A4B-93C8-9E8C315C7B33` | 合作伙伴中心记录编号 |
| 公钥 | `MIIBIjANBgkqhkiG9w0BAQEFA…`（完整值见合作伙伴中心，可复制） | 校验包签名，一般不手工使用 |

### 商店字段填写（0.1.0 实填值）

| 字段 | 0.1.0 实填 | 计划值（下次更新） |
|---|---|---|
| 隐私政策 URL | `https://github.com/adream2/web-img-tool`（仓库根目录） | `https://www.ztsite.com/privacy/web-image-tool-pro` |
| 支持 URL | GitHub 仓库 | `https://www.ztsite.com/web-image-tool`（落地页） |
| 网站 | GitHub 仓库 | `https://www.ztsite.com/` |

**为什么当时指向仓库**：落地页与隐私政策还没部署到 ztsite.com，用仓库保证「链接可访问」，
这是审核的最低要求。代价是**引流失效**——从商店进来的流量停在 GitHub，没有落到官网。

**为降低审核风险做的补救**（不改商店字段，只改仓库）：

- 仓库根 README 顶部第一屏放了中英双语隐私政策直达链接，审核员从根目录一眼能看到
- `docs/privacy-policy.md` 补了完整英文版（listing 语言是 `en-US`，原来只有中文）
- README 顶部放了 ztsite.com 入口，仓库访客仍能被引导到官网

**切换到 ztsite 的时间点**：下一次提交（版本 ≥ 0.1.1）时一并改，同时补 `zh-CN` listing。
Edge 每次提交都要走审核，把这些改动合并到一次提交里最省时间。

### 商店详情页 URL（已生效）

```
https://microsoftedge.microsoft.com/addons/detail/web-image-tool-pro/bajnpnkinbghodmhdgnjkeoanghfejhp
```

带 slug 的完整形式，`/addons/detail/web-image-tool-pro/<CRX ID>`。纯 CRX 形式的
`/addons/detail/bajnpnkinbghodmhdgnjkeoanghfejhp` 同样可访问，但对外统一用上面这条。

### 本地加载同一份代码

`chrome://extensions` / `edge://extensions` 开发者模式「加载解压缩的扩展」时，浏览器会基于本地
`manifest.json` 生成**另一个** ID。若要与商店版本共用存储与调试，需在 `manifest.json` 中加
`"key"` 字段（值为上面的公钥），否则两个 ID 的 `chrome.storage` 互不相通。

## 待办

- [x] 通过后：商店页面可正常访问，README 已去掉「审核中」标注并放开安装徽标
- [ ] **部署 ztsite 页面并改商店 URL**（引流关键一步，见下方「商店字段填写」）
- [ ] 部署后在「更新提交」里把 3 个 URL 换成 ztsite 地址
- [ ] 下一次更新时补 **中文（简体）`zh-CN`** 语言条目——文案已在 `docs/store-listing.md` 第一节备好
- [ ] 下一次更新版本号必须 **≥ 0.1.1**（Edge 拒绝同号或降级）
- [ ] 观察首周安装量 / 卸载率与评价关键词（Edge 开发者后台有数据）

## 版本历史

| 版本 | 提交日期 | 状态 | 说明 |
|---|---|---|---|
| 0.1.0 | 2026-11-18 提交 / 2026-11-19 上架 | **已上架** | 首个公开版本：扫描筛选、ZIP 批量下载、本地处理、相似图合并、图床直传 |

## 上架后的实际表现（待补）

商店页面显示的实际标题、简短描述、评分与安装量随时间变化，首次有数据后补到本表：

| 日期 | 安装量 | 评分 / 评价数 | 备注 |
|---|---|---|---|
| 2026-11-19 | 刚上线 | — | 描述页按中文展示（listing 语言为 en-US，Edge 对中文用户做了本地化） |
