// Background Service Worker for Web Image Tool Pro
// 核心架构：持续监听所有网络请求，实时捕获图片

// 按 tab 存储捕获的图片 URL
const tabImages = new Map();

// 图片 URL 特征匹配
const IMAGE_EXTENSIONS = /\.(jpg|jpeg|png|gif|bmp|webp|svg|ico|tiff|tif|avif|heic|heif|jxl|j2c|j2k|jp2|jpx|jpm|mj2|apng|wbmp|xbm|pict|pct|pcx|tga|exr|dng|cr2|nef|orf|rw2|arw|sr2|3fr|dcr|erf|kdc|mdc|mef|mos|mrw|nrw|ptx|raf|raw|rwz|srf|x3f|eps|ai|psd|pdf)(\?.*)?$/i;

// 图片 MIME 类型
const IMAGE_MIME_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/bmp', 'image/webp',
  'image/svg+xml', 'image/x-icon', 'image/vnd.microsoft.icon',
  'image/tiff', 'image/avif', 'image/heic', 'image/heif',
  'image/apng', 'image/x-xbitmap', 'image/x-pcx', 'image/x-tga',
  'image/x-portable-pixmap', 'image/x-portable-bitmap',
  'application/pdf', 'application/postscript'
];

// 判断 URL 是否可能是图片
function isImageUrl(url) {
  if (!url || url.startsWith('data:') || url.startsWith('blob:')) return false;
  // 排除常见非图片资源
  if (url.match(/\.(css|js|html|htm|xml|json|woff2?|ttf|otf|eot|map)(\?.*)?$/i)) return false;
  return IMAGE_EXTENSIONS.test(url.split('?')[0].split('#')[0]);
}

// 监听所有网络请求（持续运行，从插件安装起就捕获）
chrome.webRequest.onHeadersReceived.addListener(
  (details) => {
    const tabId = details.tabId;
    if (tabId < 0) return;

    const url = details.url;
    
    // 过滤掉插件自身的请求（chrome-extension:// 协议）
    if (url.startsWith('chrome-extension://')) {
      return;
    }
    
    // 过滤掉来自插件页面的请求（iframe 中的请求）
    if (details.initiator && details.initiator.startsWith('chrome-extension://')) {
      return;
    }
    
    // 过滤掉文档 URL 是插件页面的请求
    if (details.documentUrl && details.documentUrl.startsWith('chrome-extension://')) {
      return;
    }

    const contentType = details.responseHeaders?.find(
      h => h.name.toLowerCase() === 'content-type'
    )?.value?.toLowerCase() || '';

    let isImage = false;

    if (IMAGE_MIME_TYPES.some(type => contentType.includes(type))) {
      isImage = true;
    } else if (isImageUrl(url)) {
      isImage = true;
    }

    if (isImage) {
      if (!tabImages.has(tabId)) {
        tabImages.set(tabId, new Map());
      }
      const tabMap = tabImages.get(tabId);
      if (!tabMap.has(url)) {
        tabMap.set(url, {
          url: url,
          type: contentType || 'unknown',
          timestamp: Date.now()
        });
      }
    }
  },
  { urls: ['<all_urls>'] },
  ['responseHeaders']
);

// 标签页关闭时清理
chrome.tabs.onRemoved.addListener((tabId) => {
  tabImages.delete(tabId);
});

// 初始化右键菜单
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: 'copy-base64', title: '复制图片 Base64 编码', contexts: ['image'] });
  chrome.contextMenus.create({ id: 'copy-data-url', title: '复制图片 Data URL', contexts: ['image'] });
  chrome.contextMenus.create({ id: 'download-image', title: '下载图片', contexts: ['image'] });
  chrome.contextMenus.create({ id: 'download-as', title: '图片另存为...', contexts: ['image'] });
});

// 点击图标在当前页面打开全屏覆盖面板
chrome.action.onClicked.addListener((tab) => {
  // 向当前页面发送消息，让 content script 创建全屏面板
  chrome.tabs.sendMessage(tab.id, { action: 'toggleOverlayPanel' }).catch(() => {
    // 如果 content script 未加载，先注入再发送
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    }).then(() => {
      chrome.tabs.sendMessage(tab.id, { action: 'toggleOverlayPanel' });
    });
  });
});

// 处理右键菜单点击
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'copy-base64') {
    handleCopyBase64(info.srcUrl, tab.id);
  } else if (info.menuItemId === 'copy-data-url') {
    handleCopyDataUrl(info.srcUrl, tab.id);
  } else if (info.menuItemId === 'download-image') {
    handleDownloadImage(info.srcUrl, info.altText);
  } else if (info.menuItemId === 'download-as') {
    chrome.tabs.sendMessage(tab.id, { action: 'openDownloadDialog', imageUrl: info.srcUrl, altText: info.altText });
  }
});

// 处理消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'downloadImage') {
    handleDownloadImage(request.url, request.filename, request.format, request.quality);
    sendResponse({ success: true });
  } else if (request.action === 'batchDownload') {
    handleBatchDownload(request.images);
    sendResponse({ success: true });
  } else if (request.action === 'processImage') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, request, sendResponse);
      }
    });
    return true;
  } else if (request.action === 'getImages') {
    // 返回该 tab 已捕获的所有网络图片
    const tabId = request.tabId;
    const networkImages = [];
    if (tabImages.has(tabId)) {
      const tabMap = tabImages.get(tabId);
      tabMap.forEach((imgData, url) => {
        networkImages.push({
          url: url,
          type: imgData.type,
          source: 'network'
        });
      });
    }
    // 同时让 content script 扫描 DOM 补充（内联 SVG、data URL 等）
    chrome.tabs.sendMessage(tabId, { action: 'getImages' }, (domResponse) => {
      const domImages = (domResponse && domResponse.images) ? domResponse.images : [];
      const seenUrls = new Set();
      const merged = [];

      networkImages.forEach(img => {
        if (!seenUrls.has(img.url)) {
          seenUrls.add(img.url);
          merged.push(img);
        }
      });

      domImages.forEach(img => {
        if (!seenUrls.has(img.url)) {
          seenUrls.add(img.url);
          merged.push({ ...img, source: 'dom' });
        }
      });

      sendResponse({ images: merged });
    });
    return true;
  }

  return false;
});

// 快捷键处理
chrome.commands.onCommand.addListener((command) => {
  if (command === 'batch-download') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) chrome.tabs.sendMessage(tabs[0].id, { action: 'batchDownload' });
    });
  } else if (command === 'copy-base64') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) chrome.tabs.sendMessage(tabs[0].id, { action: 'copyHoveredImageBase64' });
    });
  }
});

// 下载图片
async function handleDownloadImage(url, filename, format = null, quality = 0.92) {
  try {
    let downloadUrl = url;
    let finalFilename = filename || 'image';

    if (format && format !== 'original') {
      const response = await fetch(url);
      const blob = await response.blob();
      const processedBlob = await convertImageFormat(blob, format, quality);
      downloadUrl = URL.createObjectURL(processedBlob);
      const ext = format === 'jpeg' ? 'jpg' : format;
      finalFilename = finalFilename.replace(/\.[^/.]+$/, '') + '.' + ext;
    }

    chrome.downloads.download({ url: downloadUrl, filename: finalFilename, saveAs: false }, () => {
      if (format && format !== 'original') URL.revokeObjectURL(downloadUrl);
    });
  } catch (error) {
    console.error('Download failed:', error);
    chrome.downloads.download({ url: url, filename: filename || 'image', saveAs: false });
  }
}

// 批量下载
async function handleBatchDownload(images) {
  for (const img of images) {
    await handleDownloadImage(img.url, img.filename, img.format, img.quality);
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

// 格式转换
async function convertImageFormat(blob, format, quality = 0.92) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (format === 'jpeg') {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.drawImage(img, 0, 0);
      const mimeType = format === 'jpeg' ? 'image/jpeg' : format === 'png' ? 'image/png' : format === 'webp' ? 'image/webp' : 'image/jpeg';
      canvas.toBlob((newBlob) => {
        if (newBlob) resolve(newBlob);
        else reject(new Error('Conversion failed'));
      }, mimeType, quality);
    };
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(blob);
  });
}

// 复制 Base64
async function handleCopyBase64(imageUrl, tabId) {
  try {
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result.split(',')[1];
      chrome.tabs.sendMessage(tabId, { action: 'copyToClipboard', text: base64 });
    };
    reader.readAsDataURL(blob);
  } catch (error) {
    console.error('Failed to copy Base64:', error);
  }
}

// 复制 Data URL
async function handleCopyDataUrl(imageUrl, tabId) {
  try {
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result;
      chrome.tabs.sendMessage(tabId, { action: 'copyToClipboard', text: dataUrl });
    };
    reader.readAsDataURL(blob);
  } catch (error) {
    console.error('Failed to copy Data URL:', error);
  }
}
