// Content Script for Web Image Tool Pro
// 职责：DOM 层图片扫描（比网络层更全：懒加载、srcset、shadow DOM、同源 iframe、CSSOM、og:image）

if (!window.__webImgToolInjected) {
  window.__webImgToolInjected = true;

  (function () {
    'use strict';

    const MAX_DATA_URL_LENGTH = 300000;   // 超大内联图跳过，避免面板卡死
    const MAX_IFRAME_DEPTH = 3;
    const MAX_SVG_LENGTH = 50000;

    const LAZY_ATTRS = [
      'data-src', 'data-lazy-src', 'data-original', 'data-lazy', 'data-actualsrc',
      'data-original-src', 'data-srcset', 'data-echo', 'data-url', 'data-image',
      'data-bg', 'data-background', 'data-thumb', 'data-cover'
    ];

    const SKIP_STYLE_TAGS = new Set([
      'SCRIPT', 'STYLE', 'LINK', 'META', 'TITLE', 'HEAD', 'NOSCRIPT', 'TEMPLATE', 'BR', 'HR'
    ]);

    // ---------- 工具 ----------

    function absolute(url, base) {
      if (!url) return '';
      const trimmed = String(url).trim();
      if (!trimmed) return '';
      if (/^(data|blob|javascript):/i.test(trimmed)) return trimmed;
      try {
        return new URL(trimmed, base || document.baseURI).href;
      } catch (e) {
        return trimmed;
      }
    }

    function isUsable(url) {
      if (!url) return false;
      if (/^data:/i.test(url)) return url.length <= MAX_DATA_URL_LENGTH;
      return /^(https?|blob):/i.test(url);
    }

    function fileNameFromUrl(url) {
      try {
        const seg = new URL(url, location.href).pathname.split('/').filter(Boolean).pop() || '';
        return decodeURIComponent(seg) || 'image';
      } catch (e) {
        return 'image';
      }
    }

    // 从 srcset 中取出所有候选地址（含 2x/3x 高清版本）
    function parseSrcset(srcset) {
      if (!srcset) return [];
      const out = [];
      String(srcset).split(',').forEach(function (part) {
        const candidate = part.trim().split(/\s+/)[0];
        if (candidate && !/^\d/.test(candidate)) out.push(candidate);
      });
      return out;
    }

    function extractUrls(value) {
      if (!value || value === 'none') return [];
      const out = [];
      const re = /url\((['"]?)(.*?)\1\)/g;
      let m;
      while ((m = re.exec(value)) !== null) {
        if (m[2] && !/^data:/i.test(m[2])) out.push(m[2]);
      }
      return out;
    }

    // ---------- 收集器 ----------

    function createCollector() {
      const map = new Map();
      const elements = new Map();   // url -> 真实 DOM 元素，供"在页面中定位"使用

      function add(rawUrl, meta) {
        const url = absolute(rawUrl);
        if (!isUsable(url)) return;

        const width = Math.max(0, Math.round(meta.width || 0));
        const height = Math.max(0, Math.round(meta.height || 0));

        if (meta.element && !elements.has(url)) elements.set(url, meta.element);

        const existing = map.get(url);
        if (existing) {
          // 同 URL 被多种方式引用时，补全信息
          if (!existing.width && width) existing.width = width;
          if (!existing.height && height) existing.height = height;
          if (!existing.alt && meta.alt) existing.alt = meta.alt;
          return;
        }

        map.set(url, {
          url: url,
          width: width,
          height: height,
          alt: meta.alt || '',
          title: meta.title || '',
          isBackground: !!meta.isBackground,
          type: meta.type || 'img'
        });
      }

      return {
        add: add,
        map: map,
        elements: elements,
        toArray: function () { return Array.from(map.values()); }
      };
    }

    // ---------- 元素扫描 ----------

    function scanImageElement(img, collector) {
      const rect = img.getBoundingClientRect();
      const width = img.naturalWidth || Math.round(rect.width) || 0;
      const height = img.naturalHeight || Math.round(rect.height) || 0;

      const candidates = [];
      if (img.currentSrc) candidates.push(img.currentSrc);
      if (img.src) candidates.push(img.src);

      // 懒加载：src 可能只是占位图（data: 或空白 base64），此时必须用真实属性
      const looksPlaceholder = !img.src || /^data:image\/(gif|png);base64,R0lGOD/i.test(img.src) ||
        img.src === location.href;

      LAZY_ATTRS.forEach(function (attr) {
        const val = img.getAttribute(attr);
        if (!val) return;
        if (attr === 'data-srcset' || /srcset$/.test(attr)) {
          parseSrcset(val).forEach(function (u) { candidates.push(u); });
        } else {
          candidates.push(val);
        }
      });

      if (img.getAttribute('srcset')) {
        parseSrcset(img.getAttribute('srcset')).forEach(function (u) { candidates.push(u); });
      }

      candidates.forEach(function (url, index) {
        // 占位图仍保留，但排在真实地址之后
        const isFirst = index === 0 && !looksPlaceholder;
        collector.add(url, {
          width: width,
          height: height,
          alt: img.alt || img.getAttribute('aria-label') || '',
          title: img.title || '',
          type: isFirst ? 'img' : 'img-srcset',
          element: img
        });
      });
    }

    function scanComputedStyle(el, collector) {
      let style;
      try {
        style = getComputedStyle(el);
      } catch (e) {
        return;
      }
      if (!style) return;

      const rect = el.getBoundingClientRect();
      const width = Math.round(rect.width) || el.clientWidth || 0;
      const height = Math.round(rect.height) || el.clientHeight || 0;

      const push = function (value, type) {
        extractUrls(value).forEach(function (url) {
          collector.add(url, { width: width, height: height, isBackground: true, type: type, alt: type, element: el });
        });
      };

      push(style.backgroundImage, 'background');
      push(style.webkitMaskImage || style.maskImage, 'mask');
      push(style.borderImageSource, 'border');
      push(style.listStyleImage, 'list');
      push(style.content, 'content');

      if (style.cursor && style.cursor.indexOf('url(') !== -1) {
        extractUrls(style.cursor).forEach(function (url) {
          collector.add(url, { isBackground: true, type: 'cursor', alt: 'cursor', element: el });
        });
      }
    }

    function scanDocument(root, collector, base, depth) {
      if (!root || depth > MAX_IFRAME_DEPTH) return;

      // 1. <img>
      root.querySelectorAll('img').forEach(function (img) {
        scanImageElement(img, collector);
      });

      // 2. <picture><source srcset>
      root.querySelectorAll('picture source, source[srcset]').forEach(function (source) {
        parseSrcset(source.getAttribute('srcset')).forEach(function (url) {
          collector.add(url, { type: 'source', element: source });
        });
        const src = source.getAttribute('src');
        if (src) collector.add(src, { type: 'source', element: source });
      });

      // 3. 内联 SVG → data URL（可直接下载/复制）
      root.querySelectorAll('svg').forEach(function (svg) {
        let html = '';
        try {
          html = new XMLSerializer().serializeToString(svg);
        } catch (e) {
          html = svg.outerHTML || '';
        }
        if (!html || html.length > MAX_SVG_LENGTH) return;
        const rect = svg.getBoundingClientRect();
        collector.add('data:image/svg+xml;charset=utf-8,' + encodeURIComponent(html), {
          width: rect.width || svg.clientWidth,
          height: rect.height || svg.clientHeight,
          alt: svg.getAttribute('aria-label') || 'svg',
          type: 'svg',
          element: svg
        });
      });

      // 4. favicon / apple-touch-icon
      root.querySelectorAll('link[rel*="icon" i]').forEach(function (link) {
        const href = link.getAttribute('href');
        if (!href) return;
        collector.add(href, {
          alt: 'favicon ' + (link.getAttribute('sizes') || ''),
          type: 'favicon',
          element: link
        });
      });

      // 5. 视频封面
      root.querySelectorAll('video[poster]').forEach(function (video) {
        collector.add(video.getAttribute('poster'), { type: 'poster', alt: 'video poster', element: video });
      });

      // 6. object / embed
      root.querySelectorAll('object[type*="image"], embed[type*="image"]').forEach(function (el) {
        const data = el.getAttribute('data') || el.getAttribute('src');
        if (data) collector.add(data, { type: 'object', element: el });
      });

      // 7. og:image / twitter:image（常见于分享卡片、懒加载首图）
      root.querySelectorAll('meta[property="og:image"], meta[property="og:image:secure_url"], meta[name="twitter:image"]').forEach(function (meta) {
        const content = meta.getAttribute('content');
        if (content) collector.add(content, { type: 'meta', alt: 'og:image', element: meta });
      });

      // 8. 全元素遍历：计算样式 + shadow DOM + 同源 iframe
      const all = root.querySelectorAll('*');
      for (let i = 0; i < all.length; i++) {
        const el = all[i];
        if (collector.map.size > 3000) break; // 极端页面保护

        if (!SKIP_STYLE_TAGS.has(el.tagName) && el.tagName !== 'IMG' && el.tagName !== 'SVG') {
          scanComputedStyle(el, collector);
        }

        if (el.shadowRoot) {
          scanDocument(el.shadowRoot, collector, base, depth + 1);
        }

        if (el.tagName === 'IFRAME' || el.tagName === 'FRAME') {
          let doc = null;
          try {
            doc = el.contentDocument; // 跨域为 null，交给网络层兜底
          } catch (e) {
            doc = null;
          }
          if (doc && doc.documentElement) {
            scanDocument(doc, collector, doc.baseURI, depth + 1);
          }
        }
      }
    }

    // 9. CSSOM：样式表里定义了但当前未渲染的图片（原代码完全覆盖不到）
    function scanStyleSheets(collector) {
      const sheets = document.styleSheets;
      for (let i = 0; i < sheets.length; i++) {
        let rules = null;
        try {
          rules = sheets[i].cssRules;
        } catch (e) {
          continue; // 跨域样式表
        }
        if (!rules) continue;
        walkRules(rules, collector);
      }
    }

    function walkRules(rules, collector) {
      for (let i = 0; i < rules.length; i++) {
        const rule = rules[i];
        if (rule.cssRules) {
          walkRules(rule.cssRules, collector);
          continue;
        }
        const style = rule.style;
        if (!style) continue;

        const values = [
          [style.backgroundImage, 'css'],
          [style.background, 'css'],
          [style.content, 'css'],
          [style.borderImageSource, 'css'],
          [style.listStyleImage, 'css'],
          [style.maskImage || style.webkitMaskImage, 'css']
        ];
        values.forEach(function (pair) {
          extractUrls(pair[0]).forEach(function (url) {
            collector.add(url, { isBackground: true, type: pair[1], alt: 'css' });
          });
        });
      }
    }

    // ---------- 对外入口 ----------

    let elementIndex = new Map();   // 最近一次扫描的 url -> 元素

    function detectImages() {
      const collector = createCollector();
      scanDocument(document, collector, document.baseURI, 0);
      scanStyleSheets(collector);
      elementIndex = collector.elements;
      return collector.toArray();
    }

    // 深度扫描：滚动页面触发懒加载，再重新采集
    async function deepScan() {
      const scrolling = document.scrollingElement || document.documentElement;
      const startY = window.scrollY;
      const viewport = Math.max(400, window.innerHeight * 0.85);
      const maxScroll = Math.max(
        scrolling ? scrolling.scrollHeight : 0,
        document.body ? document.body.scrollHeight : 0
      );
      const steps = Math.min(80, Math.ceil(maxScroll / viewport));

      // 把 loading=lazy 全部提升为 eager，让浏览器立刻请求
      document.querySelectorAll('img[loading="lazy"], iframe[loading="lazy"]').forEach(function (el) {
        try { el.loading = 'eager'; } catch (e) { /* ignore */ }
      });

      for (let i = 1; i <= steps; i++) {
        window.scrollTo(0, i * viewport);
        await new Promise(function (r) { setTimeout(r, 120); });
        if (i * viewport > (scrolling ? scrolling.scrollHeight : maxScroll)) break;
      }

      window.scrollTo(0, startY);
      await new Promise(function (r) { setTimeout(r, 250); });

      return detectImages();
    }

    // ---------- 在页面中定位 ----------

    // 把元素所在的外层 iframe 先滚进视野（同源才拿得到 frameElement）
    function revealFrame(el) {
      try {
        const win = el.ownerDocument && el.ownerDocument.defaultView;
        if (win && win !== window) {
          const frame = win.frameElement;
          if (frame) frame.scrollIntoView({ block: 'center' });
        }
      } catch (e) { /* 跨域，忽略 */ }
    }

    // 聚光灯高亮：四周压暗，一眼看到目标元素
    function flashSpotlight(el) {
      const doc = el.ownerDocument || document;
      let rect = null;
      try { rect = el.getBoundingClientRect(); } catch (e) { rect = null; }
      if (!rect || (!rect.width && !rect.height)) return false;

      const box = doc.createElement('div');
      box.style.cssText =
        'position:fixed;left:' + rect.left + 'px;top:' + rect.top + 'px;' +
        'width:' + rect.width + 'px;height:' + rect.height + 'px;' +
        'border:3px solid #667eea;border-radius:6px;' +
        'box-shadow:0 0 0 9999px rgba(0,0,0,.35),0 0 0 4px rgba(102,126,234,.3);' +
        'z-index:2147483647;pointer-events:none;transition:opacity .35s;';
      (doc.body || doc.documentElement).appendChild(box);
      setTimeout(function () {
        box.style.opacity = '0';
        setTimeout(function () { box.remove(); }, 400);
      }, 1800);
      return true;
    }

    function locateImage(url) {
      let el = elementIndex.get(url);
      if (!el || !el.isConnected) {
        detectImages();            // 页面可能已变化，重建索引
        el = elementIndex.get(url);
      }
      if (!el) return { found: false };

      revealFrame(el);
      try {
        el.scrollIntoView({ block: 'center', inline: 'center' });
      } catch (e) {
        try { el.scrollIntoView(); } catch (e2) { /* ignore */ }
      }

      // scrollIntoView 是同步布局，这里量到的矩形已经是滚动后的位置
      const visible = flashSpotlight(el);
      return { found: true, visible: visible };
    }

    // 定位时把全屏面板临时淡出，否则挡住页面什么都看不到
    function hideOverlayBriefly(ms) {
      if (!overlayPanel) return;
      overlayPanel.style.transition = 'opacity .25s';
      overlayPanel.style.opacity = '0';
      overlayPanel.style.pointerEvents = 'none';
      setTimeout(function () {
        if (!overlayPanel) return;
        overlayPanel.style.opacity = '1';
        overlayPanel.style.pointerEvents = '';
      }, ms || 2400);
    }

    // ---------- 复制 / 提示 ----------

    function copyToClipboard(text) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(text).then(function () {
          showToast('已复制到剪贴板');
        }).catch(function () {
          return fallbackCopy(text);
        });
      }
      return fallbackCopy(text);
    }

    function fallbackCopy(text) {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.cssText = 'position:fixed;top:-9999px;opacity:0;';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        showToast('已复制到剪贴板');
      } catch (err) {
        showToast('复制失败，请手动复制', 'error');
      } finally {
        document.body.removeChild(textarea);
      }
    }

    function showToast(message, type) {
      const el = document.createElement('div');
      el.className = 'wit-toast';
      el.textContent = message;
      el.style.cssText =
        'position:fixed;top:20px;right:20px;padding:10px 16px;max-width:320px;' +
        'background:' + (type === 'error' ? '#f44336' : '#4CAF50') + ';color:#fff;' +
        'border-radius:6px;box-shadow:0 4px 14px rgba(0,0,0,.2);z-index:2147483647;' +
        'font:13px/1.4 -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;';
      document.body.appendChild(el);
      setTimeout(function () {
        el.style.transition = 'opacity .3s';
        el.style.opacity = '0';
        setTimeout(function () { el.remove(); }, 300);
      }, 2000);
    }

    // ---------- 全屏面板 ----------

    let overlayPanel = null;
    let escHandler = null;

    function closeOverlay() {
      if (!overlayPanel) return;
      overlayPanel.remove();
      overlayPanel = null;
      if (escHandler) {
        document.removeEventListener('keydown', escHandler);
        escHandler = null;
      }
    }

    function toggleOverlayPanel() {
      if (overlayPanel) {
        closeOverlay();
        return;
      }

      overlayPanel = document.createElement('div');
      overlayPanel.id = 'web-img-tool-overlay';
      overlayPanel.style.cssText =
        'position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:2147483646;' +
        'display:flex;align-items:center;justify-content:center;';

      const frame = document.createElement('iframe');
      frame.src = chrome.runtime.getURL('panel.html');
      frame.style.cssText = 'width:96%;height:94%;border:none;border-radius:12px;background:#fff;box-shadow:0 20px 60px rgba(0,0,0,.35);';

      overlayPanel.appendChild(frame);
      overlayPanel.addEventListener('click', function (e) {
        if (e.target === overlayPanel) closeOverlay();
      });

      escHandler = function (e) {
        if (e.key === 'Escape') closeOverlay();
      };
      document.addEventListener('keydown', escHandler);

      document.body.appendChild(overlayPanel);
    }

    // ---------- 消息 ----------

    let hoveredImage = null;
    document.addEventListener('mouseover', function (e) {
      if (e.target && e.target.tagName === 'IMG') hoveredImage = e.target;
    }, true);

    function getHoveredSrc() {
      if (!hoveredImage) return '';
      return hoveredImage.currentSrc || hoveredImage.src || '';
    }

    chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
      const action = request && request.action;

      if (action === 'getImages') {
        if (request.deep) {
          deepScan().then(function (images) {
            sendResponse({ images: images });
          }).catch(function (err) {
            sendResponse({ images: [], error: err.message });
          });
          return true;
        }
        sendResponse({ images: detectImages() });
        return false;
      }

      if (action === 'batchDownload') {
        // 快捷键批量下载：只处理网络图，内联 data:/blob: 交给面板处理
        const used = new Set();
        const images = [];

        detectImages().forEach(function (img) {
          if (!/^https?:/i.test(img.url)) return;
          const base = fileNameFromUrl(img.url);
          const dot = base.lastIndexOf('.');
          const stem = dot > 0 ? base.slice(0, dot) : base;
          const ext = dot > 0 ? base.slice(dot) : '';
          let name = base;
          let n = 2;
          while (used.has(name)) {
            name = stem + '_' + n + ext;
            n++;
          }
          used.add(name);
          images.push({ url: img.url, filename: name, format: 'original' });
        });

        if (!images.length) {
          showToast('当前页面没有可下载的网络图片', 'error');
          sendResponse({ success: false, count: 0 });
          return false;
        }

        const capped = images.slice(0, 100);
        chrome.runtime.sendMessage({ action: 'batchDownload', images: capped });
        showToast('开始下载 ' + capped.length + ' 张图片' + (images.length > capped.length ? '（已截断至 100 张）' : ''));
        sendResponse({ success: true, count: capped.length });
        return false;
      }

      if (action === 'locateImage') {
        hideOverlayBriefly();
        let result;
        try {
          result = locateImage(request.url);
        } catch (err) {
          result = { found: false, error: err.message };
        }
        sendResponse(result);
        return false;
      }

      if (action === 'copyToClipboard') {
        copyToClipboard(request.text);
        sendResponse({ success: true });
        return false;
      }

      if (action === 'showToast') {
        showToast(request.text, request.type);
        sendResponse({ success: true });
        return false;
      }

      if (action === 'copyHoveredImageBase64') {
        const src = getHoveredSrc();
        if (!src) {
          showToast('请先把鼠标悬停在图片上', 'error');
          sendResponse({ success: false, error: 'no hovered image' });
          return false;
        }
        chrome.runtime.sendMessage({
          action: 'copyImageAs',
          url: src,
          tabId: sender && sender.tab ? sender.tab.id : undefined,
          asDataUrl: false
        });
        sendResponse({ success: true });
        return false;
      }

      if (action === 'openDownloadDialog') {
        chrome.runtime.sendMessage({
          action: 'downloadImage',
          url: request.imageUrl,
          filename: request.altText || '',
          saveAs: true
        });
        sendResponse({ success: true });
        return false;
      }

      if (action === 'toggleOverlayPanel') {
        toggleOverlayPanel();
        sendResponse({ success: true });
        return false;
      }

      sendResponse({ success: false, error: 'Unknown action: ' + action });
      return false;
    });

    console.log('[Web Image Tool Pro] content script ready');
  })();
}
