// Web Image Tool Pro - 页面控制器
// 被 popup.html / panel.html 共用。依赖 common.js（WIT）、picx.js（PicXManager）。

(function () {
  'use strict';

  const WIT = globalThis.WIT;
  const $ = function (id) { return document.getElementById(id); };

  document.addEventListener('DOMContentLoaded', function () {
    const isPanel = !!document.querySelector('.panel-container');

    // ==================== 基础 ====================
    function showNotification(message, type) {
      WIT.notify(message, type);
    }

    function copyText(text) {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        return navigator.clipboard.writeText(text).catch(function () {
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
        return Promise.resolve();
      } catch (err) {
        return Promise.reject(err);
      } finally {
        document.body.removeChild(textarea);
      }
    }

    function escapeHtml(str) {
      return WIT.escapeHtml(str);
    }

    // Tab 切换
    const tabs = document.querySelectorAll('.tab-btn');
    const contents = document.querySelectorAll('.tab-content');

    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        const target = this.getAttribute('data-tab');
        tabs.forEach(function (t) { t.classList.remove('active'); });
        contents.forEach(function (c) { c.classList.remove('active'); });
        this.classList.add('active');
        const el = $(target + '-tab');
        if (el) el.classList.add('active');
      });
    });

    function switchTab(name) {
      tabs.forEach(function (t) { t.classList.toggle('active', t.getAttribute('data-tab') === name); });
      contents.forEach(function (c) { c.classList.remove('active'); });
      const el = $(name + '-tab');
      if (el) el.classList.add('active');
    }

    // ==================== 图片检测 ====================

    const G = {
      raw: [],
      view: [],
      selected: new Set(),     // url
      dimsNodes: new Map(),    // encodeURIComponent(url) -> 尺寸文本节点
      tabId: null,
      tabUrl: '',
      scanning: false
    };

    const GROUP_BY_TYPE = {
      img: 'image', 'img-srcset': 'image', source: 'image', poster: 'image', object: 'image',
      meta: 'image', network: 'image',
      svg: 'svg',
      favicon: 'icon',
      background: 'background', 'inline-bg': 'background', css: 'background', content: 'background',
      mask: 'background', border: 'background', list: 'background', cursor: 'background'
    };

    function groupOf(img) {
      return GROUP_BY_TYPE[img.type] || 'other';
    }

    function fileNameFor(img, index) {
      if (/^data:/i.test(img.url)) {
        const match = img.url.match(/^data:([^;,]+)/i);
        let ext = match ? (match[1].split('/')[1] || 'png') : 'png';
        ext = ext === 'svg+xml' ? 'svg' : ext.replace(/\+.*$/, '');
        return 'inline_' + (index + 1) + '.' + ext;
      }
      const base = WIT.basename(img.url) || (img.alt || '') || ('image_' + (index + 1));
      return WIT.sanitizeFilename(base, WIT.guessExt(img.url, img.mime));
    }

    function readFilters() {
      const searchEl = $('img-search');
      const typeEl = $('filter-type');
      const sizeEl = $('filter-size');
      const sortEl = $('sort-by');

      let minW = 0;
      let minH = 0;
      const sizeVal = sizeEl ? sizeEl.value : '0';
      if (sizeVal === 'custom') {
        minW = parseInt(($('min-w') || {}).value, 10) || 0;
        minH = parseInt(($('min-h') || {}).value, 10) || 0;
      } else if (sizeVal !== '0') {
        const n = parseInt(sizeVal, 10) || 0;
        if (sizeVal === '1000' || sizeVal === '1920') {
          minW = n;
        } else {
          minW = n;
          minH = n;
        }
      }

      return {
        q: searchEl ? searchEl.value.trim().toLowerCase() : '',
        type: typeEl ? typeEl.value : 'all',
        minW: minW,
        minH: minH,
        sort: sortEl ? sortEl.value : 'default',
        merge: $('merge-similar') ? $('merge-similar').checked : false,
        includeFavicons: $('include-favicons') ? $('include-favicons').checked : true,
        includeBackgrounds: $('include-backgrounds') ? $('include-backgrounds').checked : true
      };
    }

    function matches(img, f) {
      if (f.merge && img.__dupOf) return false;
      if (!f.includeFavicons && (img.type === 'favicon' || groupOf(img) === 'icon')) return false;
      if (!f.includeBackgrounds && img.isBackground) return false;

      if (f.type !== 'all' && groupOf(img) !== f.type) return false;

      if (f.q) {
        const hay = (img.url + ' ' + (img.alt || '') + ' ' + (img.title || '')).toLowerCase();
        if (hay.indexOf(f.q) === -1) return false;
      }

      if (f.minW || f.minH) {
        const w = img.width || 0;
        const h = img.height || 0;
        // 尺寸未知的先放行，探测完再决定（否则会漏掉网络层图片）
        if (w && h) {
          if (f.minW && w < f.minW) return false;
          if (f.minH && h < f.minH) return false;
        }
      }
      return true;
    }

    function applyFilters() {
      const f = readFilters();
      const list = G.raw.filter(function (img) { return matches(img, f); });

      // 首次打开"合并相似图"时按需计算指纹（用户不勾就不烧 CPU）
      if (f.merge && !G.merging && !G.hashTried && G.raw.length) {
        G.hashTried = true;
        mergeSimilar();
      }

      const area = function (img) { return (img.width || 0) * (img.height || 0); };
      const collator = new Intl.Collator('zh-Hans-CN', { numeric: true });

      switch (f.sort) {
        case 'width':
          list.sort(function (a, b) { return (b.width || 0) - (a.width || 0); });
          break;
        case 'height':
          list.sort(function (a, b) { return (b.height || 0) - (a.height || 0); });
          break;
        case 'area':
          list.sort(function (a, b) { return area(b) - area(a); });
          break;
        case 'size':
          list.sort(function (a, b) { return (b.size || 0) - (a.size || 0); });
          break;
        case 'type':
          list.sort(function (a, b) {
            return collator.compare(groupOf(a), groupOf(b)) || (b.width || 0) - (a.width || 0);
          });
          break;
        default:
          break;
      }

      G.view = list;
      renderGallery();
      updateStats();
    }

    function updateStats() {
      const countEl = $('image-count');
      const visibleEl = $('visible-count');
      if (countEl) countEl.textContent = G.raw.length;
      if (visibleEl) {
        const merged = G.raw.filter(function (img) { return img.__dupOf; }).length;
        visibleEl.textContent = G.raw.length
          ? '显示 ' + G.view.length + ' 张 · 已选 ' + G.selected.size + ' 张' +
            (merged ? ' · 合并 ' + merged : '')
          : '';
      }
      const rescan = $('rescan-btn');
      if (rescan) rescan.style.display = G.raw.length ? 'inline-block' : 'none';
    }

    function typeBadge(img) {
      const group = groupOf(img);
      const map = { image: '图', background: '背', svg: 'SVG', icon: '标', other: '?' };
      if (group === 'image' && (img.type === 'img' || img.type === 'network')) return '';
      return '<span class="type-badge">' + map[group] + '</span>';
    }

    function renderGallery() {
      const list = $('image-list');
      if (!list) return;
      list.classList.add('image-grid');

      if (!G.raw.length) {
        list.innerHTML = '<div class="empty-state">点击"扫描页面"检测当前页面的图片</div>';
        return;
      }
      if (!G.view.length) {
        list.innerHTML = '<div class="empty-state">没有符合筛选条件的图片</div>';
        return;
      }

      const html = G.view.map(function (img) {
        const enc = escapeHtml(encodeURIComponent(img.url));
        const dims = (img.width && img.height) ? (img.width + '×' + img.height) : '尺寸未知';
        const size = img.size ? WIT.formatSize(img.size) : '';
        const checked = G.selected.has(img.url) ? ' checked' : '';
        const selectedCls = G.selected.has(img.url) ? ' selected' : '';
        return '<div class="grid-item' + selectedCls + '" data-url="' + enc + '">' +
          '<div class="grid-thumb-wrap">' +
          '<input type="checkbox" class="grid-checkbox" data-url="' + enc + '"' + checked + '>' +
          '<img class="grid-thumb" loading="lazy" src="' + escapeHtml(img.url) + '" alt="' + escapeHtml(img.alt || '') + '">' +
          '<button class="grid-locate-btn" title="在页面中定位">🎯</button>' +
          '<button class="grid-view-btn" title="查看大图">🔍</button>' +
          (img.__dupCount ? '<span class="type-badge dup-badge">+' + img.__dupCount + '</span>' : '') +
          typeBadge(img) +
          '</div>' +
          '<div class="grid-info">' +
          '<span class="grid-dims">' + escapeHtml(dims) + '</span>' +
          '<span class="grid-size">' + escapeHtml(size) + '</span>' +
          '<button class="grid-copy-btn" title="复制图片链接">🔗</button>' +
          '<button class="grid-dl-btn" title="下载">⬇</button>' +
          '</div>' +
          '</div>';
      }).join('');

      list.innerHTML = html;

      // 建立"尺寸文本节点"索引：探测回填时直接改节点，避免用超长属性选择器找元素
      G.dimsNodes = new Map();
      list.querySelectorAll('.grid-item').forEach(function (item) {
        const dimsNode = item.querySelector('.grid-dims');
        if (dimsNode) G.dimsNodes.set(item.dataset.url, dimsNode);
      });
    }

    // 尺寸探测：网络层图片没有宽高，逐个回填，用于筛选与排序
    async function probeMissingDimensions() {
      for (let round = 0; round < 4; round++) {
        const pending = G.view.filter(function (img) {
          return !img.__probed && (!img.width || !img.height);
        }).slice(0, 400);

        if (!pending.length) return;

        await WIT.pool(pending, 6, async function (img) {
          img.__probed = true;
          const dims = await WIT.probeImage(img.url, 8000);
          if (!dims) return null;
          img.width = dims.width;
          img.height = dims.height;
          const node = G.dimsNodes.get(encodeURIComponent(img.url));
          if (node) node.textContent = dims.width + '×' + dims.height;
          return dims;
        });

        const f = readFilters();
        if (!f.minW && !f.minH) {
          // 没有尺寸筛选时不必重绘，省一次闪烁
          if ($('sort-by') && $('sort-by').value !== 'default') applyFilters();
          else updateStats();
          return;
        }
        // 有尺寸筛选：重算一次，把探明是小图的项剔除，再补探新出现的未知项
        applyFilters();
      }
    }

    // ---- 相似图合并（dHash 64 位） ----

    function hammingDistance(a, b) {
      let d = 0;
      for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++;
      return d;
    }

    function computeDHash(img) {
      if (img.__phash !== undefined) return Promise.resolve(img.__phash);
      img.__phash = null;
      if (typeof createImageBitmap !== 'function') return Promise.resolve(null);

      return WIT.fetchBlob(img.url, 15000).then(function (blob) {
        if (!/^image\//i.test(blob.type || '')) return null;
        return createImageBitmap(blob).then(function (bmp) {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = 9;
            canvas.height = 8;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            ctx.drawImage(bmp, 0, 0, 9, 8);
            const data = ctx.getImageData(0, 0, 9, 8).data;

            const gray = [];
            let min = 255;
            let max = 0;
            for (let i = 0; i < data.length; i += 4) {
              const g = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
              gray.push(g);
              if (g < min) min = g;
              if (g > max) max = g;
            }
            // 纯色 / 透明占位图不参与去重，否则会互相误判为相似
            if (max - min < 6) return null;

            let bits = '';
            for (let y = 0; y < 8; y++) {
              for (let x = 0; x < 8; x++) {
                bits += gray[y * 9 + x] > gray[y * 9 + x + 1] ? '1' : '0';
              }
            }
            img.__phash = bits;
            return bits;
          } finally {
            if (bmp && bmp.close) bmp.close();
          }
        });
      }).catch(function () {
        return null;
      });
    }

    async function mergeSimilar() {
      if (G.merging) return;
      G.merging = true;
      showNotification('正在分析相似图片…');

      try {
        await WIT.pool(G.raw.slice(0, 400), 4, function (img) {
          return computeDHash(img);
        });

        G.raw.forEach(function (img) {
          img.__dupOf = null;
          img.__dupCount = 0;
        });

        const hashed = G.raw.filter(function (img) { return img.__phash; });
        hashed.sort(function (a, b) {
          return (b.width * b.height) - (a.width * a.height) || (b.size || 0) - (a.size || 0);
        });

        const reps = [];
        hashed.forEach(function (img) {
          for (let i = 0; i < reps.length; i++) {
            if (hammingDistance(reps[i].__phash, img.__phash) <= 5) {
              img.__dupOf = reps[i].url;
              reps[i].__dupCount = (reps[i].__dupCount || 0) + 1;
              return;
            }
          }
          reps.push(img);
        });

        const merged = hashed.filter(function (img) { return img.__dupOf; }).length;
        showNotification(merged ? '已合并 ' + merged + ' 张相似图' : '未发现相似图片');
      } finally {
        G.merging = false;
        if ($('merge-similar') && $('merge-similar').checked) applyFilters();
      }
    }

    // ---- 在页面中定位 ----

    async function locateInPage(img) {
      if (!G.tabId) {
        showNotification('请先扫描页面', 'error');
        return;
      }
      try {
        const res = await chrome.tabs.sendMessage(G.tabId, { action: 'locateImage', url: img.url });
        if (!res || !res.found) {
          showNotification('页面上已找不到这张图（可能已被移除或未渲染）', 'error');
          return;
        }
        if (res.visible === false) {
          showNotification('已定位到元素，但它当前尺寸为 0（不可见）');
        }
      } catch (err) {
        showNotification('定位失败: ' + err.message, 'error');
      }
    }

    async function scan(deep) {
      if (G.scanning) return;
      const scanBtn = $('scan-btn');
      G.scanning = true;
      if (scanBtn) {
        scanBtn.disabled = true;
        scanBtn.textContent = deep ? '深度扫描中…' : '扫描中…';
      }

      try {
        const tabsArr = await chrome.tabs.query({ active: true, currentWindow: true });
        const tab = tabsArr && tabsArr[0];
        if (!tab) throw new Error('无法获取当前标签页');
        if (/^(chrome|edge|about|devtools|chrome-extension|moz-extension):/i.test(tab.url || '')) {
          throw new Error('浏览器内置页面不支持扫描，请切换到普通网页');
        }

        const resp = await chrome.runtime.sendMessage({
          action: 'getImages',
          tabId: tab.id,
          deep: !!deep
        });

        if (resp && resp.error && (!resp.images || !resp.images.length)) {
          throw new Error(resp.error);
        }

        const images = (resp && resp.images) || [];

        // 清理无效 URL，并按规范化 URL 去重
        const seen = new Set();
        G.raw = images.filter(function (img) {
          if (!img || !img.url) return false;
          const key = WIT.normUrl(img.url);
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        G.tabId = tab.id;
        G.tabUrl = tab.url || '';

        G.selected.clear();
        G.hashTried = false;
        if ($('select-all-btn')) $('select-all-btn').textContent = '全选';
        applyFilters();
        saveScanCache();

        if (!G.raw.length) {
          showNotification('未检测到图片', 'error');
        } else {
          showNotification('检测到 ' + G.raw.length + ' 张图片' + (deep ? '（深度扫描）' : ''));
          probeMissingDimensions();
        }
      } catch (err) {
        showNotification('扫描失败: ' + err.message, 'error');
      } finally {
        G.scanning = false;
        if (scanBtn) {
          scanBtn.disabled = false;
          scanBtn.textContent = '扫描页面';
        }
      }
    }

    // ---- 扫描结果缓存：关掉面板再打开不用重扫 ----

    const SCAN_CACHE_KEY = 'wit-scan-cache';
    const SCAN_CACHE_TTL = 30 * 60 * 1000;

    function slimImage(img) {
      return {
        url: img.url,
        width: img.width || 0,
        height: img.height || 0,
        size: img.size || 0,
        mime: img.mime || '',
        alt: img.alt || '',
        title: img.title || '',
        isBackground: !!img.isBackground,
        type: img.type || 'img',
        source: img.source || ''
      };
    }

    function saveScanCache() {
      if (!chrome.storage || !chrome.storage.session || !G.raw.length) return;
      const payload = {};
      payload[SCAN_CACHE_KEY] = {
        tabId: G.tabId,
        url: G.tabUrl,
        ts: Date.now(),
        images: G.raw.map(slimImage)
      };
      chrome.storage.session.set(payload).catch(function () {});
    }

    function restoreScanCache() {
      if (!chrome.storage || !chrome.storage.session) return;
      chrome.storage.session.get(SCAN_CACHE_KEY).then(function (stored) {
        const cache = stored && stored[SCAN_CACHE_KEY];
        if (!cache || !Array.isArray(cache.images) || !cache.images.length) return;
        if (Date.now() - cache.ts > SCAN_CACHE_TTL) return;

        chrome.tabs.query({ active: true, currentWindow: true }).then(function (tabsArr) {
          const tab = tabsArr && tabsArr[0];
          if (!tab || tab.id !== cache.tabId || (tab.url || '') !== cache.url) return;

          G.raw = cache.images;
          G.tabId = tab.id;
          G.tabUrl = tab.url || '';
          applyFilters();
          showNotification('已恢复上次扫描结果（' + G.raw.length + ' 张），可点"重新扫描"刷新');
        });
      }).catch(function () {});
    }

    // ---- 检测页事件 ----
    if ($('scan-btn')) {
      $('scan-btn').addEventListener('click', function () { scan(false); });
    }
    if ($('rescan-btn')) {
      $('rescan-btn').addEventListener('click', function () { scan(false); });
    }
    if ($('deep-scan-btn')) {
      $('deep-scan-btn').addEventListener('click', function () { scan(true); });
    }

    ['include-favicons', 'include-backgrounds', 'filter-type', 'filter-size', 'sort-by', 'merge-similar'].forEach(function (id) {
      const el = $(id);
      if (el) el.addEventListener('change', function () {
        if (id === 'filter-size') {
          const custom = $('size-custom');
          if (custom) custom.style.display = this.value === 'custom' ? 'inline-flex' : 'none';
        }
        applyFilters();
        probeMissingDimensions();
      });
    });

    ['min-w', 'min-h'].forEach(function (id) {
      const el = $(id);
      if (el) el.addEventListener('input', function () {
        clearTimeout(el.__t);
        el.__t = setTimeout(applyFilters, 250);
      });
    });

    if ($('img-search')) {
      const search = $('img-search');
      let timer = null;
      search.addEventListener('input', function () {
        clearTimeout(timer);
        timer = setTimeout(function () {
          applyFilters();
          probeMissingDimensions();
        }, 200);
      });
    }

    if ($('select-all-btn')) {
      $('select-all-btn').addEventListener('click', function () {
        const all = G.view.length > 0 && G.view.every(function (img) { return G.selected.has(img.url); });
        if (all) {
          G.view.forEach(function (img) { G.selected.delete(img.url); });
        } else {
          G.view.forEach(function (img) { G.selected.add(img.url); });
        }
        this.textContent = all ? '全选' : '取消全选';
        renderGallery();
        updateStats();
      });
    }

    // 批量复制链接（已勾选优先，否则复制当前筛选结果）
    if ($('copy-links-btn')) {
      $('copy-links-btn').addEventListener('click', function () {
        const list = G.selected.size
          ? G.raw.filter(function (img) { return G.selected.has(img.url); })
          : G.view;
        if (!list.length) {
          showNotification('没有可复制的图片', 'error');
          return;
        }
        copyText(list.map(function (img) { return img.url; }).join('\n')).then(function () {
          showNotification('已复制 ' + list.length + ' 条链接');
        }).catch(function () {
          showNotification('复制失败', 'error');
        });
      });
    }

    // 事件委托（列表每次重绘，避免重复绑定）
    if ($('image-list')) {
      const list = $('image-list');

      list.addEventListener('click', function (e) {
        const item = e.target.closest ? e.target.closest('.grid-item') : null;
        if (!item) return;
        const url = decodeURIComponent(item.dataset.url || '');

        if (e.target.classList.contains('grid-locate-btn')) {
          e.stopPropagation();
          const img = G.view.find(function (x) { return x.url === url; });
          if (img) locateInPage(img);
          return;
        }

        if (e.target.classList.contains('grid-copy-btn')) {
          e.stopPropagation();
          copyText(url).then(function () {
            showNotification(/^data:/i.test(url) ? 'Data URL 已复制' : '图片链接已复制');
          }).catch(function () {
            showNotification('复制失败', 'error');
          });
          return;
        }

        if (e.target.classList.contains('grid-dl-btn')) {
          e.stopPropagation();
          const img = G.view.find(function (x) { return x.url === url; });
          if (img) {
            WIT.download(img.url, fileNameFor(img, 0)).then(function () {
              showNotification('已开始下载');
            }).catch(function (err) {
              showNotification('下载失败: ' + err.message, 'error');
            });
          }
          return;
        }

        if (e.target.classList.contains('grid-view-btn')) {
          e.stopPropagation();
          const img = G.view.find(function (x) { return x.url === url; });
          if (img) openPreviewModal(img);
          return;
        }

        if (e.target.classList.contains('grid-checkbox')) return; // 交给 change

        const cb = item.querySelector('.grid-checkbox');
        if (!cb) return;
        cb.checked = !cb.checked;
        toggleSelected(item, url, cb.checked);
      });

      list.addEventListener('change', function (e) {
        if (!e.target.classList.contains('grid-checkbox')) return;
        const item = e.target.closest('.grid-item');
        toggleSelected(item, decodeURIComponent(e.target.dataset.url || ''), e.target.checked);
      });
    }

    function toggleSelected(item, url, checked) {
      if (checked) G.selected.add(url); else G.selected.delete(url);
      if (item) item.classList.toggle('selected', checked);
      updateStats();
    }

    // 打开面板先尝试恢复上次扫描结果，避免每次重扫
    restoreScanCache();

    // ---- 批量下载 ----
    if ($('batch-download-btn')) {
      $('batch-download-btn').addEventListener('click', async function () {
        const items = G.view.filter(function (img) { return G.selected.has(img.url); });
        if (!items.length) {
          showNotification('请先勾选要下载的图片', 'error');
          return;
        }

        const btn = this;
        const zipMode = $('zip-mode') ? $('zip-mode').checked : true;
        btn.disabled = true;

        try {
          if (zipMode && items.length > 1) {
            await downloadAsZip(items, btn);
          } else {
            await downloadIndividually(items, btn);
          }
        } finally {
          btn.disabled = false;
          btn.textContent = '批量下载';
        }
      });
    }

    async function downloadIndividually(items, btn) {
      let ok = 0;
      let failed = 0;
      const used = new Set();

      for (let i = 0; i < items.length; i++) {
        const img = items[i];
        if (btn) btn.textContent = '下载中 ' + (i + 1) + '/' + items.length;
        try {
          const name = WIT.uniqueName(fileNameFor(img, i), used);
          await WIT.download(img.url, name);
          ok++;
        } catch (err) {
          failed++;
        }
        await WIT.sleep(120);
      }
      showNotification('下载完成：成功 ' + ok + ' 张' + (failed ? '，失败 ' + failed + ' 张' : ''), failed ? 'error' : 'success');
    }

    async function downloadAsZip(items, btn) {
      const used = new Set();
      let index = 0;

      const t0 = Date.now();
      const entries = await WIT.pool(items, 4, async function (img) {
        index++;
        if (btn) btn.textContent = '打包中 ' + index + '/' + items.length;
        const blob = await WIT.fetchBlob(img.url, 30000);
        const data = new Uint8Array(await blob.arrayBuffer());
        return {
          name: WIT.uniqueName(fileNameFor(img, index), used),
          data: data
        };
      });

      const good = entries.filter(function (e) { return e && e.data; });
      const failed = entries.length - good.length;

      if (!good.length) {
        showNotification('全部图片获取失败，可能是防盗链限制', 'error');
        return;
      }

      const zip = WIT.buildZip(good);
      const objectUrl = URL.createObjectURL(zip);
      const stamp = new Date();
      const pad = function (n) { return String(n).padStart(2, '0'); };
      const zipName = 'images_' + stamp.getFullYear() + pad(stamp.getMonth() + 1) + pad(stamp.getDate()) +
        '_' + pad(stamp.getHours()) + pad(stamp.getMinutes()) + '.zip';

      try {
        await WIT.downloadBlobUrl(objectUrl, zipName);
        showNotification('已打包 ' + good.length + ' 张' + (failed ? '（' + failed + ' 张失败）' : '') +
          ' · ' + ((Date.now() - t0) / 1000).toFixed(1) + 's');
      } finally {
        setTimeout(function () { URL.revokeObjectURL(objectUrl); }, 60000);
      }
    }

    // ---- 批量上传图床 ----
    if ($('batch-upload-btn')) {
      $('batch-upload-btn').addEventListener('click', function () {
        const items = G.view.filter(function (img) { return G.selected.has(img.url); });
        if (!items.length) {
          showNotification('请先勾选要上传的图片', 'error');
          return;
        }
        if (typeof PicXManager === 'undefined') {
          showNotification('图床模块未加载', 'error');
          return;
        }

        chrome.storage.sync.get({
          picxToken: '', picxOwner: '', picxRepo: 'picx-images-hosting',
          picxBranch: 'master', picxCdnType: 'github', picxCustomCdn: '',
          picxUploadPath: '', picxAutoDateDir: false, picxConvertWebp: true
        }, function (config) {
          if (!config.picxToken || !config.picxOwner) {
            showNotification('请先在设置中配置图床信息', 'error');
            return;
          }
          const files = items.map(function (img, i) {
            return { url: img.url, filename: fileNameFor(img, i) };
          });
          chrome.tabs.query({ active: true, currentWindow: true }, function (tabsArr) {
            const tabUrl = tabsArr && tabsArr[0] ? tabsArr[0].url : '';
            showBatchUploadDialog(files, tabUrl, config);
          });
        });
      });
    }

    function getWebsiteDirName(url) {
      try {
        return new URL(url).hostname.replace(/^www\./, '').replace(/[.:]+/g, '-').toLowerCase();
      } catch (e) {
        return '';
      }
    }

    function showBatchUploadDialog(files, tabUrl, config) {
      const websiteDir = getWebsiteDirName(tabUrl);
      const modal = document.createElement('div');
      modal.className = 'modal';
      modal.innerHTML =
        '<div class="modal-content modal-large">' +
        '<div class="modal-header"><h2>批量上传 (' + files.length + ' 张)</h2>' +
        '<button class="modal-close">&times;</button></div>' +
        '<div class="modal-body"><div class="upload-config-section">' +
        '<div class="form-group"><label>根目录</label>' +
        '<input type="text" id="batch-root-path" list="batch-dir-list" placeholder="例如: images/blog" value="' +
        escapeHtml(config.picxUploadPath || '') + '">' +
        '<datalist id="batch-dir-list"></datalist></div>' +
        (websiteDir
          ? '<div class="form-group" style="padding:8px 10px;background:#f0f7ff;border-radius:5px;border:1px solid #d0e3ff;">' +
            '<label style="font-size:12px;color:#1976D2;">📁 网站子目录：<strong>' + escapeHtml(websiteDir) +
            '</strong></label></div>'
          : '') +
        '<div class="upload-options" style="margin-top:10px;">' +
        '<div class="option-item"><label class="checkbox-label">' +
        '<input type="checkbox" id="batch-upload-auto-date"' + (config.picxAutoDateDir ? ' checked' : '') + '>' +
        '<span>自动按日期创建子目录 (YYYY/MM/DD)</span></label></div>' +
        '<div class="option-item"><label class="checkbox-label">' +
        '<input type="checkbox" id="batch-upload-convert-webp"' + (config.picxConvertWebp ? ' checked' : '') + '>' +
        '<span>自动转换为 WebP 格式</span></label></div>' +
        '</div>' +
        '<div class="form-group"><label>文件列表 (' + files.length + ' 张)</label>' +
        '<div class="upload-file-list" style="max-height:180px;overflow-y:auto;">' +
        files.map(function (file, idx) {
          return '<div class="upload-file-item">' +
            '<div class="file-preview"><img src="' + escapeHtml(file.url) + '" alt="" ' +
            'style="width:40px;height:40px;object-fit:cover;border-radius:3px;"></div>' +
            '<div class="file-info"><div class="file-name" style="font-size:11px;">' +
            escapeHtml(file.filename || ('image_' + (idx + 1))) + '</div></div></div>';
        }).join('') +
        '</div></div></div></div>' +
        '<div class="modal-actions">' +
        '<button class="btn btn-secondary" id="batch-upload-cancel">取消</button>' +
        '<button class="btn btn-primary" id="batch-upload-confirm" style="background:#2196F3;">开始上传 ' +
        files.length + ' 张</button></div></div>';

      document.body.appendChild(modal);
      modal.classList.add('active');

      const picx = new PicXManager({
        token: config.picxToken, owner: config.picxOwner,
        repo: config.picxRepo, branch: config.picxBranch,
        cdnType: config.picxCdnType, customCdn: config.picxCustomCdn
      });

      // 目录候选
      (async function () {
        try {
          const allDirs = [];
          await collectDirs(picx, '', allDirs, 0);
          const datalist = modal.querySelector('#batch-dir-list');
          if (datalist && allDirs.length) {
            datalist.innerHTML = allDirs.map(function (d) {
              return '<option value="' + escapeHtml(d) + '">';
            }).join('');
          }
        } catch (e) { /* 目录加载失败不影响上传 */ }
      })();

      modal.querySelector('.modal-close').onclick = function () { modal.remove(); };
      modal.querySelector('#batch-upload-cancel').onclick = function () { modal.remove(); };

      modal.querySelector('#batch-upload-confirm').onclick = async function () {
        const rootPath = modal.querySelector('#batch-root-path').value.trim();
        const autoDateDir = modal.querySelector('#batch-upload-auto-date').checked;
        const convertToWebp = modal.querySelector('#batch-upload-convert-webp').checked;
        modal.remove();

        let uploadPath = rootPath;
        if (websiteDir) uploadPath = uploadPath ? uploadPath + '/' + websiteDir : websiteDir;

        showNotification('正在上传 ' + files.length + ' 张图片…');

        const used = new Set();
        const results = await WIT.pool(files, 2, async function (file, idx) {
          const filename = WIT.uniqueName(file.filename || ('image_' + (idx + 1)), used);
          try {
            const blob = await WIT.fetchBlob(file.url, 30000);
            const ext = WIT.guessExt(file.url, blob.type);
            const name = filename.indexOf('.') > -1 ? filename : filename + '.' + ext;
            const fileObj = new File([blob], name, { type: blob.type });
            const res = await picx.uploadImage(fileObj, {
              path: uploadPath,
              autoDateDir: autoDateDir,
              convertToWebp: convertToWebp,
              filename: name
            });
            return res.success
              ? { success: true, filename: name, url: res.url, path: res.path }
              : { success: false, filename: name, error: res.message };
          } catch (err) {
            return { success: false, filename: filename, error: err.message };
          }
        });

        showUploadResults(results.filter(function (r) { return r && !r.__error; }));
      };
    }

    async function collectDirs(picx, path, allDirs, depth) {
      if (depth > 3) return;
      const result = await picx.listDirectories(path);
      if (result.success && result.directories.length) {
        for (const dir of result.directories) {
          allDirs.push(dir.path);
          await collectDirs(picx, dir.path, allDirs, depth + 1);
        }
      }
    }

    function showUploadResults(results) {
      if (!results || !results.length) {
        showNotification('没有拿到上传结果，请检查 Token 权限与仓库名', 'error');
        return;
      }
      const modal = document.createElement('div');
      modal.className = 'modal';
      const okCount = results.filter(function (r) { return r.success; }).length;

      modal.innerHTML =
        '<div class="modal-content modal-large">' +
        '<div class="modal-header"><h2>上传结果（成功 ' + okCount + ' / 共 ' + results.length + '）</h2>' +
        '<button class="modal-close">&times;</button></div>' +
        '<div class="modal-body" style="max-height:420px;overflow-y:auto;">' +
        results.map(function (r) {
          if (!r.success) {
            return '<div class="upload-result-item failed" style="margin-bottom:8px;padding:10px;border:1px solid #f44336;border-radius:6px;">' +
              '<div style="font-weight:600;color:#f44336;">✗ ' + escapeHtml(r.filename) + '</div>' +
              '<div style="font-size:12px;color:#888;margin-top:4px;">失败: ' + escapeHtml(r.error || '未知错误') + '</div></div>';
          }
          const md = '![' + r.filename + '](' + r.url + ')';
          return '<div class="upload-result-item success" style="margin-bottom:12px;padding:10px;border:1px solid #e0e0e0;border-radius:6px;">' +
            '<div style="font-weight:600;color:#4CAF50;margin-bottom:6px;">✓ ' + escapeHtml(r.filename) + '</div>' +
            '<div style="margin-bottom:4px;"><label style="font-size:11px;color:#888;">URL:</label>' +
            '<input type="text" value="' + escapeHtml(r.url) + '" readonly ' +
            'style="width:100%;padding:5px 8px;border:1px solid #ddd;border-radius:4px;font-size:11px;margin-top:2px;">' +
            '<button class="popup-copy-btn" data-text="' + escapeHtml(r.url) + '" ' +
            'style="margin-top:3px;padding:3px 8px;background:#667eea;color:#fff;border:none;border-radius:3px;cursor:pointer;font-size:11px;">复制 URL</button></div>' +
            '<div><label style="font-size:11px;color:#888;">Markdown:</label>' +
            '<input type="text" value="' + escapeHtml(md) + '" readonly ' +
            'style="width:100%;padding:5px 8px;border:1px solid #ddd;border-radius:4px;font-size:11px;margin-top:2px;font-family:monospace;">' +
            '<button class="popup-copy-btn" data-text="' + escapeHtml(md) + '" ' +
            'style="margin-top:3px;padding:3px 8px;background:#667eea;color:#fff;border:none;border-radius:3px;cursor:pointer;font-size:11px;">复制 Markdown</button></div></div>';
        }).join('') +
        '</div><div class="modal-actions">' +
        '<button class="btn btn-primary" id="popup-result-close">关闭</button></div></div>';

      document.body.appendChild(modal);
      modal.classList.add('active');

      // MV3 的 CSP 会拦掉内联 onclick，只读框的"点击全选"在这里绑定
      modal.querySelectorAll('input[readonly]').forEach(function (input) {
        input.addEventListener('click', function () { this.select(); });
      });

      modal.querySelectorAll('.popup-copy-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          copyText(this.dataset.text).then(function () {
            showNotification('已复制');
          }).catch(function () {
            showNotification('复制失败', 'error');
          });
        });
      });
      modal.querySelector('.modal-close').onclick = function () { modal.remove(); };
      modal.querySelector('#popup-result-close').onclick = function () { modal.remove(); };
    }

    // ==================== 预览 / 编辑入口 ====================

    function openPreviewModal(img) {
      const modal = $('preview-modal');
      const previewImg = $('preview-full-image');
      if (!modal || !previewImg) return;

      previewImg.src = img.url;
      $('preview-url').textContent = img.url;
      $('preview-dims').textContent =
        (img.width ? img.width + ' × ' + img.height + ' px' : '尺寸未知') +
        (img.size ? ' · ' + WIT.formatSize(img.size) : '');

      $('preview-download').onclick = function () {
        WIT.download(img.url, fileNameFor(img, 0)).then(function () {
          showNotification('已开始下载');
        }).catch(function (err) {
          showNotification('下载失败: ' + err.message, 'error');
        });
      };

      const editBtn = $('preview-edit');
      if (editBtn) {
        editBtn.onclick = function () {
          modal.classList.remove('active');
          loadImageToEditor(img.url, fileNameFor(img, 0));
        };
      }

      const uploadBtn = $('preview-upload-picx');
      if (uploadBtn) {
        uploadBtn.onclick = function () {
          uploadImageToPicx(img.url, fileNameFor(img, 0));
        };
      }

      const copyUrlBtn = $('preview-copy-url');
      if (copyUrlBtn) {
        copyUrlBtn.onclick = function () {
          copyText(img.url).then(function () {
            showNotification(/^data:/i.test(img.url) ? 'Data URL 已复制' : '图片链接已复制');
          }).catch(function () {
            showNotification('复制失败', 'error');
          });
        };
      }

      $('preview-copy-data').onclick = function () {
        WIT.fetchBlob(img.url, 30000)
          .then(function (blob) { return WIT.blobToDataUrl(blob); })
          .then(function (dataUrl) { return copyText(dataUrl); })
          .then(function () { showNotification('Data URL 已复制'); })
          .catch(function () { showNotification('复制失败', 'error'); });
      };

      $('preview-copy-base64').onclick = function () {
        WIT.fetchBlob(img.url, 30000)
          .then(function (blob) { return WIT.blobToBase64(blob); })
          .then(function (b64) { return copyText(b64); })
          .then(function () { showNotification('Base64 已复制'); })
          .catch(function () { showNotification('复制失败', 'error'); });
      };

      $('preview-open-url').onclick = function () {
        if (/^data:/i.test(img.url)) {
          showNotification('内联图片无法直接打开', 'error');
          return;
        }
        window.open(img.url, '_blank');
      };

      $('preview-close').onclick = function () { modal.classList.remove('active'); };

      if (!modal.__bound) {
        modal.__bound = true;
        modal.addEventListener('click', function (e) {
          if (e.target === modal) modal.classList.remove('active');
        });
      }

      modal.classList.add('active');
    }

    // ==================== 图片处理 ====================

    const uploadArea = $('upload-area');
    const fileInput = $('file-input');
    const previewArea = $('preview-area');
    const previewImgEl = $('preview-image');
    const imageDimensions = $('image-dimensions');
    const imageSize = $('image-size');
    let currentImage = null;

    function setEditorImage(dataUrl, name, size) {
      currentImage = { url: dataUrl, name: name, size: size };
      previewImgEl.src = dataUrl;
      previewArea.style.display = 'block';
      uploadArea.style.display = 'none';
      const probe = new Image();
      probe.onload = function () {
        imageDimensions.textContent = probe.width + '×' + probe.height;
        imageSize.textContent = WIT.formatSize(size);
      };
      probe.src = dataUrl;
    }

    function loadImageToEditor(url, name) {
      switchTab('process');
      WIT.fetchBlob(url, 30000).then(function (blob) {
        return WIT.blobToDataUrl(blob).then(function (dataUrl) {
          setEditorImage(dataUrl, name, blob.size);
          showNotification('图片已载入编辑器');
        });
      }).catch(function (err) {
        showNotification('加载图片失败: ' + err.message, 'error');
      });
    }

    if (uploadArea) {
      uploadArea.addEventListener('click', function () { fileInput.click(); });
      uploadArea.addEventListener('dragover', function (e) {
        e.preventDefault();
        uploadArea.classList.add('dragover');
      });
      uploadArea.addEventListener('dragleave', function () {
        uploadArea.classList.remove('dragover');
      });
      uploadArea.addEventListener('drop', function (e) {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        const file = Array.from(e.dataTransfer.files).filter(function (f) {
          return f.type.startsWith('image/');
        })[0];
        if (file) handleFile(file);
      });
    }

    if (fileInput) {
      fileInput.addEventListener('change', function (e) {
        if (e.target.files.length) handleFile(e.target.files[0]);
      });
    }

    function handleFile(file) {
      const reader = new FileReader();
      reader.onload = function (e) {
        setEditorImage(e.target.result, file.name, file.size);
      };
      reader.readAsDataURL(file);
    }

    if ($('clear-preview')) {
      $('clear-preview').addEventListener('click', function () {
        currentImage = null;
        previewArea.style.display = 'none';
        uploadArea.style.display = 'block';
        fileInput.value = '';
        const actions = $('preview-actions');
        if (actions) actions.remove();
      });
    }

    // ---- 工具模态框 ----
    const toolModal = $('tool-modal');
    const modalTitle = $('modal-title');
    const modalBody = $('modal-body');

    document.querySelectorAll('.tool-card').forEach(function (card) {
      card.addEventListener('click', function () {
        if (!currentImage) {
          showNotification('请先上传或选择一张图片', 'error');
          return;
        }
        openTool(card.dataset.tool);
      });
    });

    if ($('modal-close')) {
      $('modal-close').addEventListener('click', function () {
        toolModal.classList.remove('active');
      });
    }
    if (toolModal) {
      toolModal.addEventListener('click', function (e) {
        if (e.target === toolModal) toolModal.classList.remove('active');
      });
    }

    function openTool(tool) {
      const map = {
        resize: { title: '调整尺寸', html: resizeForm },
        crop: { title: '裁剪图片', html: cropForm },
        compress: { title: '压缩图片', html: compressForm },
        convert: { title: '格式转换', html: convertForm },
        upscale: { title: '图片放大', html: upscaleForm },
        base64: { title: '转 Base64', html: base64Form }
      };
      const conf = map[tool];
      if (!conf) return;
      modalTitle.textContent = conf.title;
      modalBody.innerHTML = conf.html();
      toolModal.classList.add('active');
      initTool(tool);
    }

    function presetBtn(w, h, name) {
      return '<div class="size-preset" data-w="' + w + '" data-h="' + h + '">' +
        '<div class="preset-name">' + name + '</div>' +
        '<div class="preset-size">' + w + '×' + h + '</div></div>';
    }

    // 预设尺寸表：按使用场景分组，覆盖主流图标 / PWA / 分享卡片 / 设备屏
    const PRESET_GROUPS = [
      ['通用 / 屏幕', [
        [3840, 2160, '4K UHD'], [2560, 1440, '2K QHD'], [1920, 1080, 'Full HD'],
        [1600, 900, 'HD+'], [1440, 900, 'MacBook'], [1366, 768, '笔记本'],
        [1280, 720, 'HD 720p'], [1024, 768, 'XGA'], [800, 600, 'SVGA'], [640, 480, 'VGA']
      ]],
      ['社交媒体', [
        [200, 200, '微信头像'], [900, 383, '公众号首图'], [1080, 1080, '朋友圈'],
        [1080, 1920, '抖音竖版'], [1080, 1440, '小红书'], [1920, 1000, '微博头图'],
        [1500, 500, 'X 头图'], [1280, 720, 'YouTube 缩略图'], [1146, 717, 'B站封面'],
        [1080, 1350, 'Instagram']
      ]],
      ['电商', [
        [800, 800, '淘宝主图'], [750, 1000, '详情页'],
        [1242, 1660, '天猫详情'], [1200, 1200, '京东主图']
      ]],
      ['证件照', [
        [295, 413, '一寸'], [413, 579, '二寸'], [626, 413, '护照']
      ]],
      ['Web 图标 / PWA', [
        [16, 16, '16 图标'], [32, 32, '32 图标'], [48, 48, '48 图标'], [64, 64, '64 图标'],
        [96, 96, '96 图标'], [128, 128, '商店 128'], [144, 144, '144 图标'], [152, 152, 'iPad 152'],
        [180, 180, 'Apple 180'], [192, 192, 'Android 192'], [256, 256, '256 图标'],
        [384, 384, '384 图标'], [512, 512, 'PWA 512'], [1024, 1024, '商店 1024']
      ]],
      ['分享卡片 / 广告', [
        [1200, 630, 'OG 卡片'], [1920, 600, 'Hero Banner'], [728, 90, '横幅 728×90'],
        [970, 250, '大横幅'], [300, 250, '中矩形'], [300, 600, '半页'],
        [160, 600, '摩天大楼'], [320, 50, '移动横幅']
      ]],
      ['设备屏幕', [
        [375, 812, 'iPhone X'], [390, 844, 'iPhone 14'], [414, 896, 'iPhone XR'],
        [360, 640, 'Android'], [768, 1024, 'iPad 竖'], [1024, 1366, 'iPad Pro'], [1440, 900, '桌面']
      ]]
    ];

    function presetGroup(label, items) {
      return '<div class="form-group"><label>' + label + '</label><div class="size-presets">' +
        items.map(function (it) { return presetBtn(it[0], it[1], it[2]); }).join('') +
        '</div></div>';
    }

    function resizeForm() {
      return '<div class="tool-form">' +
        '<div class="form-row"><div class="form-group"><label>宽度 (px)</label><input type="number" id="rw" min="1"></div>' +
        '<div class="form-group"><label>高度 (px)</label><input type="number" id="rh" min="1"></div></div>' +
        PRESET_GROUPS.map(function (g) { return presetGroup(g[0], g[1]); }).join('') +
        '<div class="modal-actions"><button class="btn btn-secondary" id="tool-cancel">取消</button>' +
        '<button class="btn btn-primary" id="tool-apply">应用</button></div></div>';
    }

    function cropForm() {
      return '<div class="tool-form">' +
        '<div class="form-row"><div class="form-group"><label>X</label><input type="number" id="cx" value="0" min="0"></div>' +
        '<div class="form-group"><label>Y</label><input type="number" id="cy" value="0" min="0"></div></div>' +
        '<div class="form-row"><div class="form-group"><label>裁剪宽度</label><input type="number" id="cw" min="1"></div>' +
        '<div class="form-group"><label>裁剪高度</label><input type="number" id="ch" min="1"></div></div>' +
        '<p class="form-hint" style="font-size:11px;color:#999;">留空宽度/高度表示取图片原始尺寸</p>' +
        '<div class="modal-actions"><button class="btn btn-secondary" id="tool-cancel">取消</button>' +
        '<button class="btn btn-primary" id="tool-apply">应用</button></div></div>';
    }

    function compressForm() {
      return '<div class="tool-form">' +
        '<div class="form-group"><label>压缩质量: <span id="cq-val">80</span>%</label>' +
        '<input type="range" id="cq" min="10" max="100" value="80"></div>' +
        '<div class="form-group"><label>输出格式</label><select id="cf">' +
        '<option value="jpeg">JPEG</option><option value="webp">WebP</option><option value="png">PNG</option>' +
        '</select></div>' +
        '<div class="modal-actions"><button class="btn btn-secondary" id="tool-cancel">取消</button>' +
        '<button class="btn btn-primary" id="tool-apply">压缩</button></div></div>';
    }

    function convertForm() {
      return '<div class="tool-form">' +
        '<div class="form-group"><label>目标格式</label><select id="vf">' +
        '<option value="jpeg">JPEG</option><option value="png">PNG</option><option value="webp">WebP</option>' +
        '</select></div>' +
        '<div class="form-group"><label>质量: <span id="vq-val">92</span>%</label>' +
        '<input type="range" id="vq" min="10" max="100" value="92"></div>' +
        '<div class="modal-actions"><button class="btn btn-secondary" id="tool-cancel">取消</button>' +
        '<button class="btn btn-primary" id="tool-apply">转换</button></div></div>';
    }

    function upscaleForm() {
      return '<div class="tool-form">' +
        '<div class="form-group"><label>放大倍数</label><div class="upscale-options">' +
        '<div class="upscale-option active" data-scale="2"><div class="scale-factor">2×</div><div class="scale-label">标准</div></div>' +
        '<div class="upscale-option" data-scale="3"><div class="scale-factor">3×</div><div class="scale-label">高质量</div></div>' +
        '<div class="upscale-option" data-scale="4"><div class="scale-factor">4×</div><div class="scale-label">超高清</div></div>' +
        '</div></div>' +
        '<div class="modal-actions"><button class="btn btn-secondary" id="tool-cancel">取消</button>' +
        '<button class="btn btn-primary" id="tool-apply">放大</button></div></div>';
    }

    function base64Form() {
      return '<div class="tool-form">' +
        '<div class="form-group"><label>Data URL / Base64</label>' +
        '<textarea class="base64-output" id="b64-out" readonly></textarea></div>' +
        '<div class="modal-actions">' +
        '<button class="btn btn-secondary" id="copy-b64">复制 Base64</button>' +
        '<button class="btn btn-secondary" id="copy-url">复制 Data URL</button>' +
        '<button class="btn btn-primary" id="tool-cancel">关闭</button></div></div>';
    }

    function initTool(tool) {
      const cancelBtn = $('tool-cancel');
      if (cancelBtn) cancelBtn.addEventListener('click', function () { toolModal.classList.remove('active'); });
      const applyBtn = $('tool-apply');

      if (tool === 'resize') {
        document.querySelectorAll('.size-preset').forEach(function (p) {
          p.addEventListener('click', function () {
            document.querySelectorAll('.size-preset').forEach(function (x) { x.classList.remove('active'); });
            p.classList.add('active');
            $('rw').value = p.dataset.w;
            $('rh').value = p.dataset.h;
          });
        });
        if (applyBtn) applyBtn.addEventListener('click', function () {
          const w = parseInt($('rw').value, 10);
          const h = parseInt($('rh').value, 10);
          if (!w || !h) { showNotification('请输入宽高', 'error'); return; }
          processAndPreview({ resize: { width: w, height: h }, format: 'png' }, 'resized_');
        });
      } else if (tool === 'crop') {
        if (applyBtn) applyBtn.addEventListener('click', function () {
          const x = parseInt($('cx').value, 10) || 0;
          const y = parseInt($('cy').value, 10) || 0;
          const w = parseInt($('cw').value, 10) || 0;
          const h = parseInt($('ch').value, 10) || 0;
          if (!w && !h) { showNotification('请输入裁剪宽高', 'error'); return; }
          processAndPreview({ crop: { x: x, y: y, width: w, height: h }, format: 'png' }, 'cropped_');
        });
      } else if (tool === 'compress') {
        const cq = $('cq');
        cq.addEventListener('input', function () { $('cq-val').textContent = cq.value; });
        if (applyBtn) applyBtn.addEventListener('click', function () {
          processAndPreview({ format: $('cf').value, quality: parseInt(cq.value, 10) / 100 }, 'compressed_');
        });
      } else if (tool === 'convert') {
        const vq = $('vq');
        vq.addEventListener('input', function () { $('vq-val').textContent = vq.value; });
        if (applyBtn) applyBtn.addEventListener('click', function () {
          processAndPreview({ format: $('vf').value, quality: parseInt(vq.value, 10) / 100 }, 'converted_');
        });
      } else if (tool === 'upscale') {
        let scale = 2;
        document.querySelectorAll('.upscale-option').forEach(function (o) {
          o.addEventListener('click', function () {
            document.querySelectorAll('.upscale-option').forEach(function (x) { x.classList.remove('active'); });
            o.classList.add('active');
            scale = parseInt(o.dataset.scale, 10);
          });
        });
        if (applyBtn) applyBtn.addEventListener('click', async function () {
          applyBtn.disabled = true;
          try {
            const cfg = await new Promise(function (resolve) {
              chrome.storage.sync.get({
                aiUpscaleEnabled: false,
                aiUpscaleProvider: '',
                aiUpscaleApiKey: '',
                aiUpscaleEndpoint: ''
              }, resolve);
            });

            if (cfg.aiUpscaleEnabled && cfg.aiUpscaleApiKey) {
              showNotification('正在调用 AI 放大…');
              try {
                await callAiUpscaleApi(scale, cfg);
                return;
              } catch (err) {
                showNotification('AI 放大失败，改用算法放大：' + err.message, 'error');
              }
            }
            upscaleLocally(scale);
          } finally {
            applyBtn.disabled = false;
          }
        });
      } else if (tool === 'base64') {
        const output = $('b64-out');
        WIT.fetchBlob(currentImage.url, 30000).then(function (blob) {
          return WIT.blobToDataUrl(blob);
        }).then(function (dataUrl) {
          output.value = dataUrl;
        }).catch(function () {
          output.value = '读取失败';
        });

        $('copy-b64').addEventListener('click', function () {
          copyText(output.value.split(',')[1] || '').then(function () {
            showNotification('Base64 已复制');
          }).catch(function () {
            showNotification('复制失败', 'error');
          });
        });
        $('copy-url').addEventListener('click', function () {
          copyText(output.value).then(function () {
            showNotification('Data URL 已复制');
          }).catch(function () {
            showNotification('复制失败', 'error');
          });
        });
      }
    }

    // ---- 图像处理核心 ----

    function loadImageEl(url) {
      return new Promise(function (resolve, reject) {
        const img = new Image();
        img.onload = function () { resolve(img); };
        img.onerror = function () { reject(new Error('图片解码失败')); };
        img.src = url;
      });
    }

    // 优先 createImageBitmap 并遵循 EXIF 方向，避免手机竖拍图被拉倒
    async function loadDrawable(url) {
      try {
        const blob = await WIT.fetchBlob(url, 30000);
        if (typeof createImageBitmap === 'function' && !/svg/i.test(blob.type || '')) {
          try {
            return await createImageBitmap(blob, { imageOrientation: 'from-image' });
          } catch (e) { /* 个别格式不支持，退回 <img> */ }
        }
      } catch (e) { /* 抓取失败同样退回 <img> */ }
      return loadImageEl(url);
    }

    function upscaleLocally(scale) {
      loadDrawable(currentImage.url).then(function (img) {
        processAndPreview({
          upscale: scale,
          width: img.naturalWidth * scale,
          height: img.naturalHeight * scale,
          format: 'png'
        }, 'upscaled_');
      }).catch(function (err) {
        showNotification(err.message, 'error');
      });
    }

    function mimeOf(format) {
      if (format === 'png') return 'image/png';
      if (format === 'webp') return 'image/webp';
      return 'image/jpeg';
    }

    function extOf(format) {
      if (format === 'png') return '.png';
      if (format === 'webp') return '.webp';
      return '.jpg';
    }

    /**
     * 统一渲染出口：支持 resize / crop / upscale / format / quality
     * 说明：crop 的宽高为 0 时取原图剩余区域，避免原实现"不填就报错"的别扭体验
     */
    function renderToBlob(img, options) {
      const fmt = options.format || 'jpeg';
      const srcW = img.naturalWidth || img.width;
      const srcH = img.naturalHeight || img.height;

      let cropX = 0;
      let cropY = 0;
      let cropW = srcW;
      let cropH = srcH;

      if (options.crop) {
        cropX = Math.max(0, Math.min(options.crop.x || 0, srcW - 1));
        cropY = Math.max(0, Math.min(options.crop.y || 0, srcH - 1));
        cropW = options.crop.width > 0 ? Math.min(options.crop.width, srcW - cropX) : srcW - cropX;
        cropH = options.crop.height > 0 ? Math.min(options.crop.height, srcH - cropY) : srcH - cropY;
      }

      let outW = Math.max(1, Math.round(options.width || cropW));
      let outH = Math.max(1, Math.round(options.height || cropH));

      if (options.resize) {
        outW = Math.max(1, Math.round(options.resize.width || outW));
        outH = Math.max(1, Math.round(options.resize.height || outH));
      }
      if (options.upscale) {
        outW = Math.round(srcW * options.upscale);
        outH = Math.round(srcH * options.upscale);
      }

      const canvas = document.createElement('canvas');
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext('2d');
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      if (fmt === 'jpeg') {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, outW, outH);
      }

      if (options.upscale && options.upscale >= 2) {
        // 逐级放大再缩到目标尺寸，比一次性拉伸清晰得多
        let current = document.createElement('canvas');
        current.width = cropW;
        current.height = cropH;
        current.getContext('2d').drawImage(img, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

        let w = cropW;
        while (w * 2 < outW) {
          const next = document.createElement('canvas');
          next.width = w * 2;
          next.height = Math.round(current.height * (next.width / current.width));
          const nctx = next.getContext('2d');
          nctx.imageSmoothingEnabled = true;
          nctx.imageSmoothingQuality = 'high';
          nctx.drawImage(current, 0, 0, next.width, next.height);
          current = next;
          w = next.width;
        }
        ctx.drawImage(current, 0, 0, outW, outH);
      } else {
        ctx.drawImage(img, cropX, cropY, cropW, cropH, 0, 0, outW, outH);
      }

      return new Promise(function (resolve, reject) {
        canvas.toBlob(function (blob) {
          if (blob) resolve({ blob: blob, width: outW, height: outH, format: fmt });
          else reject(new Error('导出失败'));
        }, mimeOf(fmt), options.quality);
      });
    }

    function processAndPreview(options, prefix) {
      loadDrawable(currentImage.url).then(function (img) {
        return renderToBlob(img, options).then(function (result) {
          toolModal.classList.remove('active');
          const objectUrl = URL.createObjectURL(result.blob);
          const base = (currentImage.name || 'image').replace(/\.[^/.]+$/, '');
          showProcessedPreview(objectUrl, (prefix || '') + base + extOf(result.format), result.width, result.height, result.blob.size);
        });
      }).catch(function (err) {
        showNotification('处理失败: ' + err.message, 'error');
      });
    }

    function showProcessedPreview(url, filename, width, height, size) {
      switchTab('process');

      previewImgEl.src = url;
      previewArea.style.display = 'block';
      uploadArea.style.display = 'none';
      imageDimensions.textContent = width + '×' + height;
      imageSize.textContent = WIT.formatSize(size);

      currentImage = { url: url, name: filename, size: size };

      let actions = $('preview-actions');
      if (!actions) {
        actions = document.createElement('div');
        actions.id = 'preview-actions';
        actions.style.cssText = 'display:flex;gap:10px;margin-top:12px;flex-wrap:wrap;';
        previewArea.appendChild(actions);
      }
      actions.innerHTML = '';

      const editBtn = document.createElement('button');
      editBtn.className = 'btn btn-secondary';
      editBtn.textContent = '继续编辑';
      editBtn.style.flex = '1';
      editBtn.onclick = function () {
        const grid = document.querySelector('.tools-grid');
        if (grid) grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
        showNotification('请选择下一个编辑工具');
      };
      actions.appendChild(editBtn);

      const downloadBtn = document.createElement('button');
      downloadBtn.className = 'btn btn-primary';
      downloadBtn.textContent = '下载图片';
      downloadBtn.style.flex = '1';
      downloadBtn.onclick = function () {
        WIT.download(url, filename).then(function () {
          showNotification('已开始下载');
        }).catch(function (err) {
          showNotification('下载失败: ' + err.message, 'error');
        });
      };
      actions.appendChild(downloadBtn);

      const uploadBtn = document.createElement('button');
      uploadBtn.className = 'btn btn-primary';
      uploadBtn.textContent = '上传到图床';
      uploadBtn.style.flex = '1';
      uploadBtn.style.background = '#2196F3';
      uploadBtn.onclick = function () {
        uploadImageToPicx(url, filename);
      };
      actions.appendChild(uploadBtn);

      showNotification('处理完成，可下载或继续编辑');
    }

    // ---- AI 放大 ----

    async function callAiUpscaleApi(scale, cfg) {
      const provider = cfg.aiUpscaleProvider || 'custom';
      let endpoint = cfg.aiUpscaleEndpoint;

      if (!endpoint) {
        if (provider === 'stability') {
          endpoint = 'https://api.stability.ai/v2beta/stable-image/upscale/fast';
        } else {
          throw new Error('未配置 API Endpoint');
        }
      }

      const blob = await WIT.fetchBlob(currentImage.url, 30000);
      const form = new FormData();
      form.append('image', blob, 'input.png');
      form.append('scale', String(scale));

      const headers = {};
      if (cfg.aiUpscaleApiKey) headers.Authorization = 'Bearer ' + cfg.aiUpscaleApiKey;
      if (provider === 'stability') {
        headers.Accept = 'image/*';
        form.append('output_format', 'png');
      }

      const res = await fetch(endpoint, { method: 'POST', headers: headers, body: form });
      if (!res.ok) throw new Error('HTTP ' + res.status);

      const contentType = res.headers.get('content-type') || '';
      let outBlob;

      if (contentType.startsWith('image/')) {
        outBlob = await res.blob();
      } else {
        const json = await res.json();
        const remote = json.url || json.output || json.data_url ||
          (json.data && (json.data.url || json.data[0] || (json.data[0] && json.data[0].url)));
        if (!remote || typeof remote !== 'string') throw new Error('响应中未找到图片地址');
        outBlob = await WIT.fetchBlob(remote, 60000);
      }

      const objectUrl = URL.createObjectURL(outBlob);
      const img = await loadImageEl(objectUrl);
      const base = (currentImage.name || 'image').replace(/\.[^/.]+$/, '');
      toolModal.classList.remove('active');
      showProcessedPreview(objectUrl, base + '_ai_' + scale + 'x.png', img.naturalWidth, img.naturalHeight, outBlob.size);
      showNotification('AI 放大完成');
    }

    // ==================== 批量操作 ====================

    const batchQuality = $('batch-quality');
    if (batchQuality) {
      batchQuality.addEventListener('input', function () {
        $('quality-value').textContent = batchQuality.value + '%';
      });
    }

    function parseBatchSize() {
      const value = $('batch-resize') ? $('batch-resize').value : 'none';
      if (value === 'none') return null;
      if (/^\d+x\d+$/.test(value)) {
        const parts = value.split('x');
        return { width: parseInt(parts[0], 10), height: parseInt(parts[1], 10) };
      }
      const presets = {
        wechat: { width: 900, height: 383 },
        douyin: { width: 1080, height: 1920 },
        weibo: { width: 900, height: 500 },
        xiaohongshu: { width: 1080, height: 1440 }
      };
      return presets[value] || null;
    }

    if ($('batch-convert-btn')) {
      $('batch-convert-btn').addEventListener('click', async function () {
        const btn = this;

        // 已勾选的优先；否则处理全部扫描结果
        let source = G.raw;
        if (G.selected.size) {
          source = G.raw.filter(function (img) { return G.selected.has(img.url); });
        }
        if (!source.length) {
          // 还没扫描过就先扫一次
          await scan(false);
          source = G.selected.size
            ? G.raw.filter(function (img) { return G.selected.has(img.url); })
            : G.raw;
        }
        if (!source.length) {
          showNotification('未检测到图片', 'error');
          return;
        }

        const format = $('batch-format').value;
        const quality = (parseInt(batchQuality.value, 10) || 92) / 100;
        const resize = parseBatchSize();
        const zipMode = $('batch-zip') ? $('batch-zip').checked : true;
        const needRender = format !== 'original' || !!resize;

        btn.disabled = true;
        let done = 0;
        const used = new Set();

        const results = await WIT.pool(source, 3, async function (img, idx) {
          done++;
          btn.textContent = '处理中 ' + done + '/' + source.length;
          try {
            const blob = await WIT.fetchBlob(img.url, 30000);
            let outBlob = blob;
            let ext = WIT.guessExt(img.url, blob.type);

            if (needRender) {
              const objectUrl = URL.createObjectURL(blob);
              try {
                const el = await loadDrawable(objectUrl);
                const rendered = await renderToBlob(el, {
                  format: format === 'original' ? 'png' : format,
                  quality: quality,
                  resize: resize
                });
                outBlob = rendered.blob;
                ext = extOf(rendered.format).slice(1);
              } finally {
                URL.revokeObjectURL(objectUrl);
              }
            }

            return {
              name: WIT.uniqueName(
                WIT.sanitizeFilename(WIT.basename(img.url) || ('image_' + (idx + 1)), ext),
                used
              ),
              blob: outBlob
            };
          } catch (err) {
            return { __error: err };
          }
        });

        const good = results.filter(function (r) { return r && r.blob; });
        const failed = results.length - good.length;

        try {
          if (!good.length) {
            showNotification('全部处理失败', 'error');
            return;
          }
          if (zipMode) {
            const entries = await WIT.pool(good, 4, async function (item) {
              return { name: item.name, data: new Uint8Array(await item.blob.arrayBuffer()) };
            });
            const zip = WIT.buildZip(entries.filter(function (e) { return e && e.data; }));
            const objectUrl = URL.createObjectURL(zip);
            await WIT.downloadBlobUrl(objectUrl, 'batch_' + Date.now() + '.zip');
            setTimeout(function () { URL.revokeObjectURL(objectUrl); }, 60000);
          } else {
            for (let i = 0; i < good.length; i++) {
              const objectUrl = URL.createObjectURL(good[i].blob);
              await WIT.downloadBlobUrl(objectUrl, good[i].name);
              setTimeout(URL.revokeObjectURL.bind(URL, objectUrl), 60000);
              await WIT.sleep(100);
            }
          }
          showNotification('完成：成功 ' + good.length + ' 张' + (failed ? '，失败 ' + failed + ' 张' : ''), failed ? 'error' : 'success');
        } catch (err) {
          showNotification('导出失败: ' + err.message, 'error');
        } finally {
          btn.disabled = false;
          btn.textContent = '批量转换并下载';
        }
      });
    }

    // ==================== 设置 ====================

    const SETTINGS = [
      ['default-format', 'defaultFormat', 'value'],
      ['default-quality', 'defaultQuality', 'number'],
      ['auto-detect', 'autoDetect', 'checked'],
      ['show-notifications', 'showNotifications', 'checked'],
      ['ai-upscale-enabled', 'aiUpscaleEnabled', 'checked'],
      ['ai-upscale-provider', 'aiUpscaleProvider', 'value'],
      ['ai-upscale-apikey', 'aiUpscaleApiKey', 'value'],
      ['ai-upscale-endpoint', 'aiUpscaleEndpoint', 'value'],
      ['picx-token', 'picxToken', 'value'],
      ['picx-owner', 'picxOwner', 'value'],
      ['picx-repo', 'picxRepo', 'value'],
      ['picx-branch', 'picxBranch', 'value'],
      ['picx-cdn-type', 'picxCdnType', 'value'],
      ['picx-custom-cdn', 'picxCustomCdn', 'value']
    ];

    const defaults = {
      defaultFormat: 'original',
      defaultQuality: 92,
      autoDetect: true,
      showNotifications: true,
      aiUpscaleEnabled: false,
      aiUpscaleProvider: '',
      aiUpscaleApiKey: '',
      aiUpscaleEndpoint: '',
      picxToken: '',
      picxOwner: '',
      picxRepo: 'picx-images-hosting',
      picxBranch: 'master',
      picxCdnType: 'github',
      picxCustomCdn: ''
    };

    const qualityLabel = $('default-quality-value');
    if ($('default-quality')) {
      $('default-quality').addEventListener('input', function () {
        if (qualityLabel) qualityLabel.textContent = this.value + '%';
      });
    }

    chrome.storage.sync.get(defaults, function (state) {
      SETTINGS.forEach(function (row) {
        const el = $(row[0]);
        if (!el) return;
        if (row[2] === 'checked') el.checked = !!state[row[1]];
        else if (row[2] === 'number') el.value = state[row[1]];
        else el.value = state[row[1]];
      });
      if (qualityLabel) qualityLabel.textContent = (state.defaultQuality || 92) + '%';

      const cdnGroup = $('picx-custom-cdn-group');
      if (cdnGroup) cdnGroup.style.display = state.picxCdnType === 'custom' ? 'block' : 'none';
      const aiGroup = $('ai-upscale-endpoint-group');
      const provider = $('ai-upscale-provider');
      if (aiGroup && provider) aiGroup.style.display = provider.value === 'custom' ? 'block' : 'none';
    });

    SETTINGS.forEach(function (row) {
      const el = $(row[0]);
      if (!el) return;
      el.addEventListener('change', function () {
        let value;
        if (row[2] === 'checked') value = this.checked;
        else if (row[2] === 'number') value = parseInt(this.value, 10) || 0;
        else value = this.value;

        const payload = {};
        payload[row[1]] = value;
        chrome.storage.sync.set(payload);

        if (row[0] === 'picx-cdn-type') {
          const group = $('picx-custom-cdn-group');
          if (group) group.style.display = value === 'custom' ? 'block' : 'none';
        }
        if (row[0] === 'ai-upscale-provider') {
          const group = $('ai-upscale-endpoint-group');
          if (group) group.style.display = value === 'custom' ? 'block' : 'none';
        }
      });
    });

    if ($('picx-test-connection')) {
      $('picx-test-connection').addEventListener('click', async function () {
        const token = ($('picx-token') || {}).value || '';
        const owner = ($('picx-owner') || {}).value || '';
        const repo = ($('picx-repo') || {}).value || 'picx-images-hosting';

        if (!token || !owner) {
          showNotification('请先填写 Token 和用户名', 'error');
          return;
        }

        const btn = this;
        btn.disabled = true;
        try {
          const res = await fetch('https://api.github.com/repos/' + owner + '/' + repo, {
            headers: {
              Authorization: 'token ' + token,
              Accept: 'application/vnd.github.v3+json'
            }
          });
          if (res.ok) {
            const data = await res.json();
            showNotification('连接成功：' + data.full_name);
          } else {
            showNotification('连接失败: ' + res.status + '（检查 Token 权限/仓库名）', 'error');
          }
        } catch (err) {
          showNotification('连接失败: ' + err.message, 'error');
        } finally {
          btn.disabled = false;
        }
      });
    }

    // ==================== 上传单张到图床 ====================

    async function uploadImageToPicx(imageUrl, filename) {
      if (typeof PicXManager === 'undefined') {
        showNotification('图床模块未加载', 'error');
        return;
      }
      const config = await new Promise(function (resolve) {
        chrome.storage.sync.get({
          picxToken: '', picxOwner: '', picxRepo: 'picx-images-hosting',
          picxBranch: 'master', picxCdnType: 'github', picxCustomCdn: '',
          picxUploadPath: '', picxAutoDateDir: false, picxConvertWebp: true
        }, resolve);
      });

      if (!config.picxToken || !config.picxOwner) {
        showNotification('请先在设置中配置图床信息', 'error');
        return;
      }
      showBatchUploadDialog([{ url: imageUrl, filename: filename }], '', config);
    }

    // 暴露给其他脚本（picx-panel.js 等）
    window.WITPage = {
      scan: scan,
      getImages: function () { return G.raw; },
      notify: showNotification,
      isPanel: isPanel
    };
  });
})();
