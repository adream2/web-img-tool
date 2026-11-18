# 商店提交记录

> 记录每次提交的版本、状态与官方分配的标识。发版或排查「商店里搜不到」「链接打不开」时以此为准。

## 0.1.0 — 首次提交

| 项 | 值 |
|---|---|
| 扩展名称 | Web Image Tool Pro |
| 版本 | 0.1.0 |
| 提交时间 | 2026-11-18 |
| 状态 | **审核中**（平台告知预计 7 个工作日内回复） |
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

### 商店详情页 URL

审核通过后生效，格式为 `/addons/detail/<CRX ID>`：

```
https://microsoftedge.microsoft.com/addons/detail/bajnpnkinbghodmhdgnjkeoanghfejhp
```

> 审核期间该地址会 404，属正常现象。README 与落地页已按此地址填好，**通过后不需要再改代码**。

### 本地加载同一份代码

`chrome://extensions` / `edge://extensions` 开发者模式「加载解压缩的扩展」时，浏览器会基于本地
`manifest.json` 生成**另一个** ID。若要与商店版本共用存储与调试，需在 `manifest.json` 中加
`"key"` 字段（值为上面的公钥），否则两个 ID 的 `chrome.storage` 互不相通。

## 待办（随本次审核推进）

- [ ] 通过后：确认商店页面截图/描述渲染正常，README 去掉「审核中」标注
- [ ] 通过后：在 `docs/store-listing.md` 记录实际展示的标题与简短描述（平台可能截断）
- [ ] 下一次更新时补 **中文（简体）`zh-CN`** 语言条目——文案已在 `docs/store-listing.md` 第一节备好，
      当前仅提交了 `en-US`，中文用户看到的仍是英文 listing
- [ ] 下一次更新版本号必须 **≥ 0.1.1**（Edge 拒绝同号或降级）

## 版本历史

| 版本 | 提交日期 | 状态 | 说明 |
|---|---|---|---|
| 0.1.0 | 2026-11-18 | 审核中 | 首个公开版本：扫描筛选、ZIP 批量下载、本地处理、相似图合并、图床直传 |
