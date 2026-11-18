// Web Image Tool Pro - 共享工具库
// 同时被扩展页面（popup.html / panel.html）与 Service Worker（background.js）加载。
// 注意：不可使用 window / document / FileReader，SW 环境不存在。

(function (root) {
  'use strict';

  if (root.WIT) return;

  // ---------- 基础 ----------

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatSize(bytes) {
    const b = Number(bytes);
    if (!b || b < 0) return '';
    if (b < 1024) return b + ' B';
    if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
    if (b < 1073741824) return (b / 1048576).toFixed(1) + ' MB';
    return (b / 1073741824).toFixed(2) + ' GB';
  }

  const MIME_EXT = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/avif': 'avif',
    'image/svg+xml': 'svg',
    'image/bmp': 'bmp',
    'image/x-icon': 'ico',
    'image/vnd.microsoft.icon': 'ico',
    'image/tiff': 'tiff',
    'image/heic': 'heic',
    'image/heif': 'heif',
    'image/apng': 'apng'
  };

  const URL_EXT_RE = /\.(jpe?g|png|gif|webp|avif|svg|bmp|ico|tiff?|heic|heif|apng)$/i;

  function guessExt(url, mime) {
    const m = (mime || '').split(';')[0].trim().toLowerCase();
    if (MIME_EXT[m]) return MIME_EXT[m];
    try {
      const path = new URL(url, 'https://x/').pathname;
      const match = path.match(URL_EXT_RE);
      if (match) return match[1].toLowerCase().replace('jpeg', 'jpg');
    } catch (e) { /* ignore */ }
    return 'jpg';
  }

  function basename(url) {
    try {
      if (/^(data|blob):/i.test(url)) return '';
      const u = new URL(url, 'https://x/');
      const seg = u.pathname.split('/').filter(Boolean).pop() || '';
      return decodeURIComponent(seg);
    } catch (e) {
      return '';
    }
  }

  // 生成安全文件名：去掉非法字符、控制字符和路径穿越
  function sanitizeFilename(name, fallbackExt) {
    let s = String(name == null ? '' : name).trim();
    s = s.replace(/^[a-z]+:\/\/[^/]*/i, '');          // 误传整条 URL
    s = s.replace(/[\\/:*?"<>|\x00-\x1f\x7f]/g, '_'); // Windows/Chrome 非法字符
    s = s.replace(/\s+/g, ' ').replace(/^\.+/, '').trim();
    if (s.length > 100) {
      const dot = s.lastIndexOf('.');
      const ext = dot > 0 ? s.slice(dot) : '';
      s = s.slice(0, 100 - ext.length) + ext;
    }
    if (!s) s = 'image';
    // Windows 保留设备名会导致 FILE_NAME_INVALID
    if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.[^.]*)?$/i.test(s)) {
      s = '_' + s;
    }
    if (!/\.[a-z0-9]{2,5}$/i.test(s)) {
      const ext = (fallbackExt || 'jpg').replace(/^\./, '');
      s += '.' + ext;
    }
    return s;
  }

  function normUrl(url) {
    if (!url) return '';
    return String(url).split('#')[0];
  }

  function sleep(ms) {
    return new Promise(function (r) { setTimeout(r, ms); });
  }

  // ---------- 网络 ----------

  async function fetchBlob(url, timeout) {
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = ctrl ? setTimeout(function () { ctrl.abort(); }, timeout || 20000) : null;
    try {
      // 扩展已声明 <all_urls> 权限，带上 cookie 能拿到登录态图片（公众号、小红书等）
      const res = await fetch(url, ctrl
        ? { signal: ctrl.signal, credentials: 'include' }
        : { credentials: 'include' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.blob();
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  // SW 里没有 FileReader，统一走 ArrayBuffer + btoa 分块
  function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    const CHUNK = 0x8000;
    let binary = '';
    for (let i = 0; i < bytes.length; i += CHUNK) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    }
    return btoa(binary);
  }

  async function blobToBase64(blob) {
    const buf = await blob.arrayBuffer();
    return arrayBufferToBase64(buf);
  }

  async function blobToDataUrl(blob) {
    const mime = blob.type || 'application/octet-stream';
    return 'data:' + mime + ';base64,' + (await blobToBase64(blob));
  }

  // ---------- 并发池 ----------

  async function pool(items, limit, worker) {
    const list = Array.from(items || []);
    const results = new Array(list.length);
    let cursor = 0;
    const size = Math.max(1, Math.min(limit || 4, list.length || 1));

    async function runner() {
      while (true) {
        const index = cursor++;
        if (index >= list.length) return;
        try {
          results[index] = await worker(list[index], index);
        } catch (err) {
          results[index] = { __error: err };
        }
      }
    }

    await Promise.all(Array.from({ length: size }, runner));
    return results;
  }

  // ---------- 图片尺寸探测（仅页面环境） ----------

  const probeCache = new Map();

  function probeImage(url, timeout) {
    if (!/^https?:|^data:/i.test(url)) return Promise.resolve(null);
    if (probeCache.has(url)) return probeCache.get(url);

    const task = new Promise(function (resolve) {
      const img = new Image();
      let done = false;
      const finish = function (val) {
        if (done) return;
        done = true;
        img.onload = img.onerror = null;
        resolve(val);
      };
      const timer = setTimeout(function () { finish(null); }, timeout || 10000);
      img.onload = function () {
        clearTimeout(timer);
        finish(img.naturalWidth ? { width: img.naturalWidth, height: img.naturalHeight } : null);
      };
      img.onerror = function () {
        clearTimeout(timer);
        finish(null);
      };
      img.decoding = 'async';
      img.src = url;
    });

    probeCache.set(url, task);
    return task;
  }

  // ---------- ZIP（store 模式，无需第三方库） ----------

  let CRC_TABLE = null;
  function crcTable() {
    if (CRC_TABLE) return CRC_TABLE;
    const table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      table[n] = c >>> 0;
    }
    CRC_TABLE = table;
    return table;
  }

  function crc32(bytes) {
    const table = crcTable();
    let crc = 0xFFFFFFFF;
    for (let i = 0; i < bytes.length; i++) {
      crc = (crc >>> 8) ^ table[(crc ^ bytes[i]) & 0xFF];
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  function dosDateTime(date) {
    const d = date instanceof Date ? date : new Date();
    const year = Math.max(1980, d.getFullYear());
    return {
      time: ((d.getHours() & 0x1F) << 11) | ((d.getMinutes() & 0x3F) << 5) | ((d.getSeconds() / 2) & 0x1F),
      date: (((year - 1980) & 0x7F) << 9) | (((d.getMonth() + 1) & 0x0F) << 5) | (d.getDate() & 0x1F)
    };
  }

  /**
   * @param {Array<{name:string, data:Uint8Array|ArrayBuffer}>} entries
   * @returns {Blob}
   */
  function buildZip(entries) {
    const encoder = new TextEncoder();
    const chunks = [];
    const central = [];
    let offset = 0;
    const stamp = dosDateTime(new Date());

    entries.forEach(function (entry) {
      const nameBytes = encoder.encode(entry.name);
      const raw = entry.data instanceof Uint8Array ? entry.data : new Uint8Array(entry.data);
      const crc = crc32(raw);

      const local = new Uint8Array(30 + nameBytes.length);
      const lv = new DataView(local.buffer);
      lv.setUint32(0, 0x04034b50, true);
      lv.setUint16(4, 20, true);        // version needed
      lv.setUint16(6, 0x0800, true);    // UTF-8 flag
      lv.setUint16(8, 0, true);         // method: store
      lv.setUint16(10, stamp.time, true);
      lv.setUint16(12, stamp.date, true);
      lv.setUint32(14, crc, true);
      lv.setUint32(18, raw.length, true);
      lv.setUint32(22, raw.length, true);
      lv.setUint16(26, nameBytes.length, true);
      lv.setUint16(28, 0, true);
      local.set(nameBytes, 30);

      chunks.push(local, raw);

      const cd = new Uint8Array(46 + nameBytes.length);
      const cv = new DataView(cd.buffer);
      cv.setUint32(0, 0x02014b50, true);
      cv.setUint16(4, 20, true);        // version made by
      cv.setUint16(6, 20, true);        // version needed
      cv.setUint16(8, 0x0800, true);
      cv.setUint16(10, 0, true);
      cv.setUint16(12, stamp.time, true);
      cv.setUint16(14, stamp.date, true);
      cv.setUint32(16, crc, true);
      cv.setUint32(20, raw.length, true);
      cv.setUint32(24, raw.length, true);
      cv.setUint16(28, nameBytes.length, true);
      cv.setUint16(30, 0, true);
      cv.setUint16(32, 0, true);
      cv.setUint16(34, 0, true);
      cv.setUint16(36, 0, true);
      cv.setUint32(38, 0, true);
      cv.setUint32(42, offset, true);
      cd.set(nameBytes, 46);
      central.push(cd);

      offset += local.length + raw.length;
    });

    let centralSize = 0;
    central.forEach(function (cd) { centralSize += cd.length; });

    const end = new Uint8Array(22);
    const ev = new DataView(end.buffer);
    ev.setUint32(0, 0x06054b50, true);
    ev.setUint16(4, 0, true);
    ev.setUint16(6, 0, true);
    ev.setUint16(8, entries.length, true);
    ev.setUint16(10, entries.length, true);
    ev.setUint32(12, centralSize, true);
    ev.setUint32(16, offset, true);
    ev.setUint16(20, 0, true);

    return new Blob(chunks.concat(central, [end]), { type: 'application/zip' });
  }

  // 同名文件自动加序号
  function uniqueName(name, used) {
    if (!used.has(name)) {
      used.add(name);
      return name;
    }
    const dot = name.lastIndexOf('.');
    const base = dot > 0 ? name.slice(0, dot) : name;
    const ext = dot > 0 ? name.slice(dot) : '';
    let i = 2;
    let candidate = base + '_' + i + ext;
    while (used.has(candidate)) {
      i++;
      candidate = base + '_' + i + ext;
    }
    used.add(candidate);
    return candidate;
  }

  // ---------- 下载（仅扩展页面环境，SW 里无 chrome.downloads 文档上下文） ----------

  // 下载失败码 → 人话，避免只看到"下载失败"三个字
  const DOWNLOAD_ERRORS = {
    SERVER_FORBIDDEN: '服务器拒绝下载（多半是防盗链，403）',
    SERVER_UNAUTHORIZED: '需要登录才能下载（401）',
    SERVER_BAD_CONTENT: '服务器返回的内容不是有效图片',
    SERVER_FAILED: '服务器返回错误',
    SERVER_NO_RANGE: '服务器不支持断点传输',
    SERVER_UNREACHABLE: '无法连接服务器',
    SERVER_CONTENT_LENGTH_MISMATCH: '下载内容不完整',
    SERVER_CROSS_ORIGIN_REDIRECT: '跨域重定向被拦截',
    NETWORK_FAILED: '网络错误',
    NETWORK_TIMEOUT: '网络超时',
    NETWORK_DISCONNECTED: '网络已断开',
    NETWORK_SERVER_DOWN: '服务器无响应',
    NETWORK_INVALID_REQUEST: '无效的下载请求',
    FILE_NO_SPACE: '磁盘空间不足',
    FILE_NAME_TOO_LONG: '文件名过长',
    FILE_NAME_INVALID: '文件名包含非法字符',
    FILE_FAILED: '写入文件失败',
    FILE_TOO_LARGE: '文件过大',
    FILE_ACCESS_DENIED: '没有写入权限',
    USER_CANCELED: '下载已被取消',
    CRASH: '下载进程异常中断'
  };

  function describeDownloadError(code) {
    return DOWNLOAD_ERRORS[code] || ('下载失败（' + code + '）');
  }

  const pendingDownloads = new Map();
  let downloadWatcherBound = false;

  function bindDownloadWatcher() {
    if (downloadWatcherBound || !chrome.downloads || !chrome.downloads.onChanged) return;
    downloadWatcherBound = true;
    chrome.downloads.onChanged.addListener(function (delta) {
      const entry = pendingDownloads.get(delta.id);
      if (!entry) return;
      if (delta.error && delta.error.current && delta.error.current !== 'USER_CANCELED') {
        settleDownload(delta.id, new Error(describeDownloadError(delta.error.current)));
      } else if (delta.state && delta.state.current === 'complete') {
        settleDownload(delta.id, null);
      } else if (delta.state && delta.state.current === 'interrupted' && !entry.settled) {
        settleDownload(delta.id, new Error(describeDownloadError((delta.error && delta.error.current) || 'CRASH')));
      }
    });
  }

  function settleDownload(id, error) {
    const entry = pendingDownloads.get(id);
    if (!entry || entry.settled) return;
    entry.settled = true;
    clearTimeout(entry.timer);
    pendingDownloads.delete(id);
    if (error) entry.reject(error);
    else entry.resolve(id);
  }

  /**
   * @param {string} url blob: / data: / http(s)
   * @param {string} filename
   * @param {{saveAs?:boolean}} [opts]
   */
  function downloadBlobUrl(url, filename, opts) {
    const name = sanitizeFilename(filename);
    const options = opts || {};
    bindDownloadWatcher();

    return new Promise(function (resolve, reject) {
      chrome.downloads.download({
        url: url,
        filename: name,
        saveAs: !!options.saveAs,
        conflictAction: 'uniquify'
      }, function (id) {
        const err = chrome.runtime.lastError;
        if (err) {
          reject(new Error(err.message));
          return;
        }
        if (typeof id !== 'number') {
          reject(new Error('下载未能启动'));
          return;
        }
        // 创建成功不代表落盘成功，等 onChanged 给出 complete / interrupted
        const timer = setTimeout(function () {
          // 大图慢网兜底：超时不当作失败
          settleDownload(id, null);
        }, 30000);
        pendingDownloads.set(id, { resolve: resolve, reject: reject, timer: timer, settled: false });
      });
    });
  }

  /**
   * 统一下载入口：
   * - blob: 必须在页面上下文里直接交给 chrome.downloads（跨进程会失效）
   * - http(s) 先抓成 blob，避免 referer / 防盗链导致下载失败
   */
  async function download(url, filename, opts) {
    const name = sanitizeFilename(filename, guessExt(url));
    if (/^blob:/i.test(url)) {
      return downloadBlobUrl(url, name, opts);
    }

    let blob;
    try {
      blob = await fetchBlob(url, 30000);
      if (/^text\/html/i.test(blob.type || '')) throw new Error('HOTLINK_BLOCKED');
    } catch (fetchError) {
      if (fetchError.message === 'HOTLINK_BLOCKED') {
        throw new Error('服务器返回的是网页而不是图片（多半是防盗链）');
      }
      if (/^data:/i.test(url)) throw fetchError;
      // 抓不到就退回直链，让下载器自己带 cookie 去请求
      return downloadBlobUrl(url, name, opts);
    }

    const objectUrl = URL.createObjectURL(blob);
    try {
      return await downloadBlobUrl(objectUrl, name, opts);
    } finally {
      setTimeout(function () { URL.revokeObjectURL(objectUrl); }, 60000);
    }
  }

  function notify(message, type) {
    const n = document.createElement('div');
    n.textContent = message;
    n.style.cssText =
      'position:fixed;top:20px;right:20px;padding:10px 16px;max-width:320px;' +
      'background:' + (type === 'error' ? '#f44336' : '#4CAF50') + ';color:#fff;' +
      'border-radius:6px;box-shadow:0 4px 14px rgba(0,0,0,.18);z-index:2147483647;' +
      'font-size:13px;line-height:1.4;';
    document.body.appendChild(n);
    setTimeout(function () {
      n.style.transition = 'opacity .3s';
      n.style.opacity = '0';
      setTimeout(function () { n.remove(); }, 300);
    }, type === 'error' ? 3200 : 2000);
  }

  root.WIT = {
    escapeHtml: escapeHtml,
    formatSize: formatSize,
    guessExt: guessExt,
    basename: basename,
    sanitizeFilename: sanitizeFilename,
    normUrl: normUrl,
    sleep: sleep,
    fetchBlob: fetchBlob,
    blobToBase64: blobToBase64,
    blobToDataUrl: blobToDataUrl,
    arrayBufferToBase64: arrayBufferToBase64,
    pool: pool,
    probeImage: probeImage,
    crc32: crc32,
    buildZip: buildZip,
    uniqueName: uniqueName,
    download: download,
    downloadBlobUrl: downloadBlobUrl,
    describeDownloadError: describeDownloadError,
    notify: notify
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
