// Background Service Worker for Web Image Tool Pro
// 职责：网络层图片采集（跨 iframe / 无 DOM 依赖的图片）+ 下载代理 + 右键菜单。
// 关键点：MV3 的 SW 会在空闲后休眠，内存状态必须落盘（chrome.storage.session），
// 否则用户打开面板时之前捕获的图片全部丢失 —— 这是"扫描不全"的主因之一。

importScripts('common.js');

const WIT = globalThis.WIT;

// tabId -> Map(url -> {url, type, size, ts})
const buckets = new Map();
const flushTimers = new Map();

const STORAGE_PREFIX = 'tabimgs:';
const MAX_PER_TAB = 800;

// 只保留浏览器真正会渲染的图片格式，PDF/PSD/AI 之类不再计入（原代码把它们当图片，属于噪音）
const IMAGE_EXT_RE = /\.(jpe?g|png|gif|bmp|webp|avif|apng|svg|ico|cur|tiff?|heic|heif|jxl)$/i;
const NON_IMAGE_EXT_RE = /\.(css|js|mjs|html?|xml|json|txt|woff2?|ttf|otf|eot|map|mp4|webm|mp3|wav|pdf)$/i;
const HTML_MIME_RE = /^(text\/html|application\/xhtml|text\/plain|application\/json|text\/xml)/i;

function isImageMime(contentType) {
  if (!contentType) return false;
  if (HTML_MIME_RE.test(contentType)) return false;
  return /^image\//i.test(contentType);
}

function looksLikeImageUrl(url) {
  if (!url) return false;
  const clean = url.split('#')[0].split('?')[0];
  if (NON_IMAGE_EXT_RE.test(clean)) return false;
  return IMAGE_EXT_RE.test(clean);
}

// ---------- 存储层 ----------

function storageKey(tabId) {
  return STORAGE_PREFIX + tabId;
}

function getBucket(tabId) {
  const cached = buckets.get(tabId);
  if (cached) return Promise.resolve(cached);

  // 先同步占位、再异步回填：图片响应是并发到达的，若等 await 之后才写入 buckets，
  // 同一 tab 的多条并发请求会各自 new 一个 Map，前面的采集结果会被覆盖丢失。
  const map = new Map();
  buckets.set(tabId, map);

  const key = storageKey(tabId);
  const loading = (chrome.storage.session && chrome.storage.session.get)
    ? chrome.storage.session.get(key).then(function (stored) {
        const list = stored && stored[key];
        if (Array.isArray(list)) {
          list.forEach(function (rec) {
            if (rec && rec.url && !map.has(rec.url)) map.set(rec.url, rec);
          });
        }
      })
    : Promise.resolve();

  // 会话存储不可用（旧版本浏览器）时退化为纯内存
  return loading.catch(function () {}).then(function () { return map; });
}

function scheduleFlush(tabId) {
  if (flushTimers.has(tabId)) return;
  const timer = setTimeout(function () {
    flushTimers.delete(tabId);
    const map = buckets.get(tabId);
    if (!map) return;
    const key = storageKey(tabId);
    const payload = {};
    payload[key] = Array.from(map.values());
    chrome.storage.session.set(payload).catch(function () {});
  }, 150);
  flushTimers.set(tabId, timer);
}

async function clearBucket(tabId) {
  buckets.delete(tabId);
  const timer = flushTimers.get(tabId);
  if (timer) {
    clearTimeout(timer);
    flushTimers.delete(tabId);
  }
  try {
    await chrome.storage.session.remove(storageKey(tabId));
  } catch (e) { /* ignore */ }
}

// ---------- 采集 ----------

chrome.webRequest.onHeadersReceived.addListener(
  function (details) {
    const tabId = details.tabId;
    if (tabId < 0) return;

    const url = details.url;
    if (!/^https?:/i.test(url)) return;                        // 排除 data:/blob:/chrome-extension:
    if (details.initiator && details.initiator.startsWith('chrome-extension://')) return;
    if (details.documentUrl && details.documentUrl.startsWith('chrome-extension://')) return;

    const headers = details.responseHeaders || [];
    let contentType = '';
    let contentLength = 0;
    for (let i = 0; i < headers.length; i++) {
      const name = headers[i].name.toLowerCase();
      if (name === 'content-type') contentType = String(headers[i].value || '').toLowerCase();
      else if (name === 'content-length') contentLength = parseInt(headers[i].value, 10) || 0;
    }

    if (details.statusCode && details.statusCode >= 400) return;

    // 部分 CDN 用 application/octet-stream 返回图片，此时退回扩展名判断
    let isImage = isImageMime(contentType);
    if (!isImage && (!contentType || /application\/(octet-stream|binary|unknown)/i.test(contentType))) {
      isImage = looksLikeImageUrl(url);
    }
    if (!isImage) return;

    getBucket(tabId).then(function (map) {
      if (map.has(url)) {
        // 同一 URL 可能被重复请求，补全缺失的元数据即可
        const rec = map.get(url);
        if (!rec.size && contentLength) rec.size = contentLength;
        if (!rec.type && contentType) rec.type = contentType;
        return;
      }
      if (map.size >= MAX_PER_TAB) return;
      map.set(url, {
        url: url,
        type: contentType || '',
        size: contentLength || 0,
        ts: Date.now()
      });
      scheduleFlush(tabId);
    });
  },
  { urls: ['http://*/*', 'https://*/*'] },
  ['responseHeaders']
);

// 主文档提交（含 SPA 之外的真实跳转）时清空，避免拿到上一个页面的残影
chrome.webNavigation.onCommitted.addListener(function (details) {
  if (details.frameId === 0) clearBucket(details.tabId);
});

chrome.tabs.onRemoved.addListener(function (tabId) {
  clearBucket(tabId);
});

// 单页应用通过 history API 换页时也要清空，否则会混入上一页的图片
chrome.tabs.onUpdated.addListener(function (tabId, changeInfo) {
  if (changeInfo && changeInfo.url) clearBucket(tabId);
});

// ---------- 面板 / 右键菜单 ----------

chrome.runtime.onInstalled.addListener(function () {
  chrome.contextMenus.removeAll(function () {
    chrome.contextMenus.create({ id: 'copy-base64', title: '复制图片 Base64 编码', contexts: ['image'] });
    chrome.contextMenus.create({ id: 'copy-data-url', title: '复制图片 Data URL', contexts: ['image'] });
    chrome.contextMenus.create({ id: 'download-image', title: '下载图片', contexts: ['image'] });
    chrome.contextMenus.create({ id: 'download-as', title: '图片另存为...', contexts: ['image'] });
  });
});

// 点击图标：在当前页注入并切换全屏面板
chrome.action.onClicked.addListener(function (tab) {
  if (!tab || !tab.id) return;
  chrome.tabs.sendMessage(tab.id, { action: 'toggleOverlayPanel' }).catch(function () {
    chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] })
      .then(function () {
        return chrome.tabs.sendMessage(tab.id, { action: 'toggleOverlayPanel' });
      })
      .catch(function () { /* 受限页面（chrome:// 等）静默失败 */ });
  });
});

chrome.contextMenus.onClicked.addListener(function (info, tab) {
  if (!tab || !tab.id) return;
  const src = info.srcUrl;
  if (!src) return;

  if (info.menuItemId === 'copy-base64') {
    copyImageAs(src, tab.id, false);
  } else if (info.menuItemId === 'copy-data-url') {
    copyImageAs(src, tab.id, true);
  } else if (info.menuItemId === 'download-image') {
    downloadOne(src, info.altText);
  } else if (info.menuItemId === 'download-as') {
    // 交给页面做"另存为"更可靠（可拿到 blob/防盗链资源）
    chrome.tabs.sendMessage(tab.id, {
      action: 'openDownloadDialog',
      imageUrl: src,
      altText: info.altText
    }).catch(function () { downloadOne(src, info.altText); });
  }
});

chrome.commands.onCommand.addListener(function (command) {
  chrome.tabs.query({ active: true, currentWindow: true }).then(function (tabs) {
    const tab = tabs && tabs[0];
    if (!tab || !tab.id) return;
    if (command === 'batch-download') {
      chrome.tabs.sendMessage(tab.id, { action: 'batchDownload' }).catch(function () {});
    } else if (command === 'copy-base64') {
      chrome.tabs.sendMessage(tab.id, { action: 'copyHoveredImageBase64' }).catch(function () {});
    }
  });
});

// ---------- 消息 ----------

chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
  const action = request && request.action;

  if (action === 'getImages') {
    collectImages(request.tabId, !!request.deep)
      .then(function (images) { sendResponse({ images: images }); })
      .catch(function (err) { sendResponse({ images: [], error: err.message }); });
    return true;
  }

  if (action === 'clearImages') {
    clearBucket(request.tabId).then(function () { sendResponse({ success: true }); });
    return true;
  }

  if (action === 'downloadImage') {
    downloadOne(request.url, request.filename, !!request.saveAs).then(function (res) {
      sendResponse(res);
    });
    return true;
  }

  if (action === 'copyImageAs') {
    const tabId = (sender && sender.tab && sender.tab.id) || request.tabId;
    if (!tabId) {
      sendResponse({ success: false, error: 'no tab' });
      return false;
    }
    copyImageAs(request.url, tabId, !!request.asDataUrl).then(function () {
      sendResponse({ success: true });
    }, function (err) {
      sendResponse({ success: false, error: err.message });
    });
    return true;
  }

  if (action === 'batchDownload') {
    downloadMany(request.images || []).then(function (res) { sendResponse(res); });
    return true;
  }

  if (action === 'networkImages') {
    // 仅返回网络层采集结果（调试用）
    getBucket(request.tabId).then(function (map) {
      sendResponse({ images: Array.from(map.values()) });
    });
    return true;
  }

  // 未识别的消息也要回一句，否则调用方会收到 "message port closed"
  sendResponse({ success: false, error: 'Unknown action: ' + action });
  return false;
});

/**
 * 合并「网络层采集」与「DOM 扫描」结果。
 * DOM 提供尺寸/alt/元素类型，网络层提供 iframe、CSS 背景等 DOM 拿不到的资源。
 */
async function collectImages(tabId, deep) {
  const map = await getBucket(tabId);
  const network = Array.from(map.values());

  let domImages = [];
  try {
    domImages = await requestDomScan(tabId, deep);
  } catch (e) {
    domImages = [];
  }

  const seen = new Set();
  const merged = [];
  const byKey = new Map();   // 避免 O(n²) 的 find

  network.forEach(function (rec) {
    const key = WIT.normUrl(rec.url);
    if (seen.has(key)) return;
    seen.add(key);
    const entry = {
      url: rec.url,
      width: 0,
      height: 0,
      size: rec.size || 0,
      mime: rec.type || '',
      alt: '',
      title: '',
      isBackground: false,
      type: 'network',
      source: 'network'
    };
    merged.push(entry);
    byKey.set(key, entry);
  });

  domImages.forEach(function (img) {
    const key = WIT.normUrl(img.url);
    const existing = byKey.get(key);
    if (existing) {
      // 用 DOM 的精确信息补全网络记录
      existing.width = existing.width || img.width || 0;
      existing.height = existing.height || img.height || 0;
      existing.alt = img.alt || existing.alt;
      existing.title = img.title || existing.title;
      existing.isBackground = img.isBackground || existing.isBackground;
      existing.type = existing.type === 'network' ? img.type : existing.type;
      existing.source = 'both';
      return;
    }
    seen.add(key);
    const entry = {
      url: img.url,
      width: img.width || 0,
      height: img.height || 0,
      size: img.size || 0,
      mime: img.mime || '',
      alt: img.alt || '',
      title: img.title || '',
      isBackground: !!img.isBackground,
      type: img.type || 'img',
      source: 'dom'
    };
    merged.push(entry);
    byKey.set(key, entry);
  });

  return merged;
}

// 向 content script 请求 DOM 扫描；脚本缺失时补注入再试一次
function requestDomScan(tabId, deep) {
  const message = { action: 'getImages', deep: !!deep };
  return chrome.tabs.sendMessage(tabId, message).then(function (resp) {
    if (!resp || !Array.isArray(resp.images)) throw new Error('empty response');
    return resp.images;
  }).catch(function () {
    return chrome.scripting.executeScript({ target: { tabId: tabId }, files: ['content.js'] })
      .then(function () {
        return chrome.tabs.sendMessage(tabId, message);
      })
      .then(function (resp) {
        return (resp && Array.isArray(resp.images)) ? resp.images : [];
      });
  });
}

// ---------- 下载 ----------

async function downloadOne(url, filename, saveAs) {
  const name = WIT.sanitizeFilename(
    filename ? WIT.basename(filename) || filename : WIT.basename(url),
    WIT.guessExt(url)
  );

  if (!/^(https?|data):/i.test(url)) {
    // blob: 属于页面进程，SW 无法访问，必须由页面自己下载
    return { success: false, error: 'UNSUPPORTED_URL' };
  }

  try {
    const id = await chrome.downloads.download({
      url: url,
      filename: name,
      saveAs: !!saveAs,
      conflictAction: 'uniquify'
    });
    return { success: true, id: id, filename: name };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

async function downloadMany(images) {
  let ok = 0;
  let failed = 0;
  for (let i = 0; i < images.length; i++) {
    const item = images[i];
    const res = await downloadOne(item.url, item.filename);
    if (res.success) ok++; else failed++;
    await WIT.sleep(80);
  }
  return { success: failed === 0, ok: ok, failed: failed };
}

// ---------- 复制 ----------

async function copyImageAs(imageUrl, tabId, asDataUrl) {
  try {
    const blob = await WIT.fetchBlob(imageUrl, 20000);
    const text = asDataUrl
      ? await WIT.blobToDataUrl(blob)
      : await WIT.blobToBase64(blob);
    await chrome.tabs.sendMessage(tabId, { action: 'copyToClipboard', text: text });
  } catch (err) {
    console.error('[WIT] 复制失败:', err);
    chrome.tabs.sendMessage(tabId, {
      action: 'showToast',
      text: '复制失败：' + err.message,
      type: 'error'
    }).catch(function () {});
  }
}
