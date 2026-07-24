// Content Script for Web Image Tool Pro
// Handles image detection, processing, and UI interactions

// 防止重复初始化
if (!window.__webImgToolInjected) {
  window.__webImgToolInjected = true;
  
  (function() {
    'use strict';
  
  let detectedImages = [];
  let hoveredImage = null;
  let isSelectionMode = false;

  // Lazy-load attribute names used by various frameworks
  const LAZY_ATTRS = ['data-src', 'data-lazy-src', 'data-original', 'data-lazy', 'data-actualsrc', 'data-url', 'data-bg', 'data-image'];

  // Detect all images on the page
  function detectImages() {
    detectedImages = [];
    const seenUrls = new Set();

    function addImage(url, width, height, alt, title, element, isBackground, type) {
      if (!url || seenUrls.has(url)) return;
      // Skip tiny tracking pixels
      if (width > 0 && width < 3 && height > 0 && height < 3) return;
      seenUrls.add(url);
      detectedImages.push({
        id: detectedImages.length,
        url: url,
        width: width || 0,
        height: height || 0,
        alt: alt || '',
        title: title || '',
        element: element,
        isBackground: !!isBackground,
        type: type || 'img'
      });
    }

    // 1. <img> tags - including lazy-loaded ones
    document.querySelectorAll('img').forEach((img) => {
      // Try real src first
      let src = img.src;
      // If naturalWidth is 0, try lazy-load attributes
      if (!src || img.naturalWidth === 0) {
        for (const attr of LAZY_ATTRS) {
          const lazySrc = img.getAttribute(attr);
          if (lazySrc && lazySrc !== src) {
            src = lazySrc;
            break;
          }
        }
      }
      if (src) {
        addImage(src, img.naturalWidth, img.naturalHeight, img.alt, img.title, img, false, 'img');
      }
    });

    // 2. <picture> <source> elements
    document.querySelectorAll('picture source').forEach((source) => {
      const srcset = source.getAttribute('srcset');
      if (srcset) {
        // Extract first URL from srcset
        const match = srcset.match(/(\S+?)(?:\s+\d+[wx])/);
        if (match) {
          addImage(match[1], 0, 0, '', '', source, false, 'source');
        }
      }
      const src = source.getAttribute('src');
      if (src) {
        addImage(src, 0, 0, '', '', source, false, 'source');
      }
    });

    // 3. <svg> elements
    document.querySelectorAll('svg').forEach((svg) => {
      const outerHTML = svg.outerHTML;
      if (outerHTML && outerHTML.length < 50000) { // Skip huge SVGs
        const dataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(outerHTML);
        const w = svg.getAttribute('width') || svg.clientWidth || 0;
        const h = svg.getAttribute('height') || svg.clientHeight || 0;
        addImage(dataUrl, parseInt(w) || 0, parseInt(h) || 0, svg.getAttribute('aria-label') || '', '', svg, false, 'svg');
      }
    });

    // 4. Favicon and link icons
    document.querySelectorAll('link[rel*="icon"]').forEach((link) => {
      const href = link.getAttribute('href');
      if (href) {
        let fullUrl = href;
        if (href.startsWith('/')) {
          fullUrl = location.origin + href;
        } else if (!href.startsWith('http') && !href.startsWith('data:')) {
          fullUrl = location.origin + '/' + href;
        }
        addImage(fullUrl, 0, 0, 'Favicon: ' + (link.getAttribute('sizes') || 'default'), '', link, false, 'favicon');
      }
    });

    // 5. Background images and other CSS images
    document.querySelectorAll('*').forEach((el) => {
      // Skip if already detected as img/svg
      if (el.tagName === 'IMG' || el.tagName === 'SVG') return;

      const style = window.getComputedStyle(el);

      // background-image
      const bgImage = style.backgroundImage;
      if (bgImage && bgImage !== 'none') {
        const urls = bgImage.match(/url\(['"]?(.*?)['"]?\)/g);
        if (urls) {
          urls.forEach(u => {
            const url = u.replace(/url\(['"]?/, '').replace(/['"]?\)$/, '');
            if (url && !url.startsWith('data:') && !url.startsWith('blob:')) {
              addImage(url, 0, 0, 'Background', '', el, true, 'background');
            }
          });
        }
      }

      // content (pseudo-element images)
      const content = style.content;
      if (content && content.startsWith('url(')) {
        const url = content.replace(/url\(['"]?/, '').replace(/['"]?\)$/, '');
        if (url && !url.startsWith('data:')) {
          addImage(url, 0, 0, 'Content image', '', el, true, 'content');
        }
      }

      // list-style-image
      const listStyle = style.listStyleImage;
      if (listStyle && listStyle !== 'none') {
        const url = listStyle.replace(/url\(['"]?/, '').replace(/['"]?\)$/, '');
        if (url && !url.startsWith('data:')) {
          addImage(url, 0, 0, 'List icon', '', el, true, 'list');
        }
      }

      // border-image
      const borderImage = style.borderImageSource;
      if (borderImage && borderImage !== 'none') {
        const url = borderImage.replace(/url\(['"]?/, '').replace(/['"]?\)$/, '');
        if (url && !url.startsWith('data:')) {
          addImage(url, 0, 0, 'Border image', '', el, true, 'border');
        }
      }

      // cursor image
      const cursor = style.cursor;
      if (cursor && cursor.includes('url(')) {
        const urlMatch = cursor.match(/url\(['"]?(.*?)['"]?\)/);
        if (urlMatch) {
          const url = urlMatch[1];
          if (url && !url.startsWith('data:')) {
            addImage(url, 0, 0, 'Cursor image', '', el, true, 'cursor');
          }
        }
      }

      // mask-image
      const maskImage = style.maskImage || style.webkitMaskImage;
      if (maskImage && maskImage !== 'none') {
        const urls = maskImage.match(/url\(['"]?(.*?)['"]?\)/g);
        if (urls) {
          urls.forEach(u => {
            const url = u.replace(/url\(['"]?/, '').replace(/['"]?\)$/, '');
            if (url && !url.startsWith('data:')) {
              addImage(url, 0, 0, 'Mask image', '', el, true, 'mask');
            }
          });
        }
      }
    });

    // 6. Inline style background images (not caught by getComputedStyle on hidden elements)
    document.querySelectorAll('[style]').forEach((el) => {
      if (el.tagName === 'IMG' || el.tagName === 'SVG') return;
      const styleAttr = el.getAttribute('style') || '';
      const matches = styleAttr.match(/background(?:-image)?\s*:\s*[^;]*url\(['"]?(.*?)['"]?\)/gi);
      if (matches) {
        matches.forEach(m => {
          const urlMatch = m.match(/url\(['"]?(.*?)['"]?\)/);
          if (urlMatch) {
            const url = urlMatch[1];
            if (url && !url.startsWith('data:') && !seenUrls.has(url)) {
              addImage(url, 0, 0, 'Inline background', '', el, true, 'inline-bg');
            }
          }
        });
      }
    });

    // 7. <video> poster
    document.querySelectorAll('video[poster]').forEach((video) => {
      addImage(video.getAttribute('poster'), 0, 0, 'Video poster', '', video, false, 'poster');
    });

    // 8. <object> and <embed> images
    document.querySelectorAll('object[type*="image"], embed[type*="image"]').forEach((el) => {
      const data = el.getAttribute('data') || el.getAttribute('src');
      if (data) {
        addImage(data, 0, 0, '', '', el, false, 'object');
      }
    });

    return detectedImages;
  }
  
  // Process image (resize, crop, compress, etc.)
  async function processImage(imageUrl, options) {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const img = await createImageBitmap(blob);
      
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      let width = img.width;
      let height = img.height;
      
      // Apply resize if specified
      if (options.resize) {
        width = options.resize.width || width;
        height = options.resize.height || height;
      }
      
      // Apply crop if specified
      let cropX = 0, cropY = 0, cropWidth = width, cropHeight = height;
      if (options.crop) {
        cropX = options.crop.x || 0;
        cropY = options.crop.y || 0;
        cropWidth = options.crop.width || width;
        cropHeight = options.crop.height || height;
      }
      
      canvas.width = cropWidth;
      canvas.height = cropHeight;
      
      // For JPEG, fill with white background
      if (options.format === 'jpeg') {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      
      // Draw image with crop
      ctx.drawImage(
        img,
        cropX, cropY, cropWidth, cropHeight,
        0, 0, cropWidth, cropHeight
      );
      
      // Convert to specified format
      const mimeType = options.format === 'jpeg' ? 'image/jpeg' :
                       options.format === 'png' ? 'image/png' :
                       options.format === 'webp' ? 'image/webp' : 'image/jpeg';
      
      const quality = options.quality || 0.92;
      
      return new Promise((resolve, reject) => {
        canvas.toBlob((resultBlob) => {
          if (resultBlob) {
            resolve({
              blob: resultBlob,
              url: URL.createObjectURL(resultBlob),
              width: canvas.width,
              height: canvas.height
            });
          } else {
            reject(new Error('Failed to process image'));
          }
        }, mimeType, quality);
      });
    } catch (error) {
      console.error('Image processing error:', error);
      throw error;
    }
  }
  
  // Convert image to Base64
  async function imageToBase64(imageUrl) {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Failed to read image'));
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error('Base64 conversion error:', error);
      throw error;
    }
  }
  
  // Copy text to clipboard
  function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
      showNotification('已复制到剪贴板');
    }).catch(err => {
      console.error('Failed to copy:', err);
      showNotification('复制失败', 'error');
    });
  }
  
  // Show notification
  function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = 'web-img-tool-notification';
    notification.textContent = message;
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 20px;
      background: ${type === 'error' ? '#f44336' : '#4CAF50'};
      color: white;
      border-radius: 4px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      z-index: 999999;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      font-size: 14px;
      animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease';
      setTimeout(() => notification.remove(), 300);
    }, 2000);
  }
  
  // Handle messages from background script / popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getImages') {
      // 立即返回已检测到的图片，不等待
      const images = detectImages();
      sendResponse({ images: images.map(img => ({
        id: img.id,
        url: img.url,
        width: img.width,
        height: img.height,
        alt: img.alt,
        title: img.title,
        isBackground: img.isBackground,
        type: img.type
      }))});
    } else if (request.action === 'batchDownload') {
      detectImages();
      chrome.runtime.sendMessage({
        action: 'batchDownload',
        images: detectedImages.map(img => ({
          url: img.url,
          filename: img.alt || `image_${img.id}`,
          format: 'original',
          quality: 0.92
        }))
      });
      sendResponse({ success: true });
    } else if (request.action === 'processImage') {
      processImage(request.imageUrl, request.options).then(result => {
        sendResponse({ success: true, ...result });
      }).catch(error => {
        sendResponse({ success: false, error: error.message });
      });
      return true;
    } else if (request.action === 'copyToClipboard') {
      copyToClipboard(request.text);
      sendResponse({ success: true });
    } else if (request.action === 'copyHoveredImageBase64') {
      if (hoveredImage) {
        imageToBase64(hoveredImage.src).then(base64 => {
          copyToClipboard(base64);
          sendResponse({ success: true });
        }).catch(error => {
          sendResponse({ success: false, error: error.message });
        });
        return true;
      } else {
        sendResponse({ success: false, error: 'No image hovered' });
      }
    } else if (request.action === 'openDownloadDialog') {
      openDownloadDialog(request.imageUrl, request.altText);
      sendResponse({ success: true });
    } else if (request.action === 'toggleOverlayPanel') {
      toggleOverlayPanel();
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false, error: 'Unknown action: ' + request.action });
    }
    return false;
  });
  
  // Track hovered image
  document.addEventListener('mouseover', (e) => {
    if (e.target.tagName === 'IMG') {
      hoveredImage = e.target;
    }
  });
  
  // Open download dialog
  function openDownloadDialog(imageUrl, altText) {
    // This will be implemented in the popup UI
    // For now, just trigger a download
    chrome.runtime.sendMessage({
      action: 'downloadImage',
      url: imageUrl,
      filename: altText || 'image',
      format: 'original',
      quality: 0.92
    });
  }
  
  // Add CSS for animations
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from {
        transform: translateX(400px);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
    
    @keyframes slideOut {
      from {
        transform: translateX(0);
        opacity: 1;
      }
      to {
        transform: translateX(400px);
        opacity: 0;
      }
    }
  `;
  document.head.appendChild(style);
  
  // 全屏覆盖面板
  let overlayPanel = null;
  
  function toggleOverlayPanel() {
    if (overlayPanel) {
      // 关闭面板
      overlayPanel.remove();
      overlayPanel = null;
      return;
    }
    
    // 创建全屏覆盖面板
    overlayPanel = document.createElement('div');
    overlayPanel.id = 'web-img-tool-overlay';
    overlayPanel.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0, 0, 0, 0.8);
      z-index: 999999;
      display: flex;
      align-items: center;
      justify-content: center;
      animation: fadeIn 0.3s ease;
    `;
    
    // 创建面板容器
    const panelContainer = document.createElement('div');
    panelContainer.style.cssText = `
      width: 95%;
      height: 90%;
      background: white;
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
      overflow: hidden;
      display: flex;
      flex-direction: column;
    `;
    
    // 创建 iframe 加载 panel.html
    const iframe = document.createElement('iframe');
    iframe.src = chrome.runtime.getURL('panel.html');
    iframe.style.cssText = `
      width: 100%;
      height: 100%;
      border: none;
    `;
    
    panelContainer.appendChild(iframe);
    overlayPanel.appendChild(panelContainer);
    
    // 点击背景关闭
    overlayPanel.addEventListener('click', (e) => {
      if (e.target === overlayPanel) {
        overlayPanel.remove();
        overlayPanel = null;
      }
    });
    
    // ESC 键关闭
    const escHandler = (e) => {
      if (e.key === 'Escape' && overlayPanel) {
        overlayPanel.remove();
        overlayPanel = null;
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);
    
    document.body.appendChild(overlayPanel);
    
    // 添加动画样式
    if (!document.getElementById('web-img-tool-overlay-styles')) {
      const style = document.createElement('style');
      style.id = 'web-img-tool-overlay-styles';
      style.textContent = `
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `;
      document.head.appendChild(style);
    }
  }
  
  // Initialize
  console.log('Web Image Tool Pro loaded');
  })();
}
