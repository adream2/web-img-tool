// Web Image Tool Pro - Popup

// 通用复制函数（带 fallback）
function copyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text).catch(() => {
      return fallbackCopy(text);
    });
  }
  return fallbackCopy(text);
}

function fallbackCopy(text) {
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
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

document.addEventListener('DOMContentLoaded', function() {
  // === Tab 切换 ===
  const tabs = document.querySelectorAll('.tab-btn');
  const contents = document.querySelectorAll('.tab-content');

  tabs.forEach(function(tab) {
    tab.addEventListener('click', function() {
      const target = this.getAttribute('data-tab');
      tabs.forEach(function(t) { t.classList.remove('active'); });
      contents.forEach(function(c) { c.classList.remove('active'); });
      this.classList.add('active');
      const el = document.getElementById(target + '-tab');
      if (el) el.classList.add('active');
    });
  });

  // === 核心工具函数：确保 content script 已注入，然后发送消息 ===
  function sendToContent(tabId, message) {
    return new Promise(function(resolve, reject) {
      // 先尝试注入 content script（如果已存在则不会重复注入）
      chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['content.js']
      }).then(function() {
        // 使用 Promise 版本的 sendMessage，支持异步响应
        chrome.tabs.sendMessage(tabId, message).then(function(response) {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(response);
          }
        }).catch(function(err) {
          reject(err);
        });
      }).catch(function(err) {
        reject(err);
      });
    });
  }

  // === 通知函数 ===
  function showNotification(message, type) {
    type = type || 'success';
    var n = document.createElement('div');
    n.style.cssText = 'position:fixed;top:20px;right:20px;padding:12px 20px;' +
      'background:' + (type === 'error' ? '#f44336' : '#4CAF50') +
      ';color:white;border-radius:4px;box-shadow:0 2px 8px rgba(0,0,0,0.2);' +
      'z-index:10000;font-size:13px;';
    n.textContent = message;
    document.body.appendChild(n);
    setTimeout(function() { n.remove(); }, 2000);
  }

  // === 上传到图床 ===
  async function uploadImageToPicx(imageUrl, filename) {
    try {
      // 获取图床配置
      const config = await new Promise(resolve => {
        chrome.storage.sync.get({
          picxToken: '',
          picxOwner: '',
          picxRepo: 'picx-images-hosting',
          picxBranch: 'master',
          picxCdnType: 'github',
          picxCustomCdn: '',
          picxUploadPath: '',
          picxAutoDateDir: false,
          picxConvertWebp: true
        }, resolve);
      });

      if (!config.picxToken || !config.picxOwner) {
        showNotification('请先配置图床信息', 'error');
        // 切换到图床标签页
        const picxTab = document.querySelector('[data-tab="picx"]');
        if (picxTab) picxTab.click();
        return;
      }

      // 显示上传配置对话框
      showUploadConfigDialog([{ url: imageUrl, filename: filename }], config);
    } catch (error) {
      console.error('上传失败:', error);
      showNotification('上传失败: ' + error.message, 'error');
    }
  }

  // === 显示上传配置对话框 ===
  async function showUploadConfigDialog(files, config) {
    // 创建对话框
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-content modal-large">
        <div class="modal-header">
          <h2>上传配置</h2>
          <button class="modal-close">&times;</button>
        </div>
        <div class="modal-body">
          <div class="upload-config-section">
            <div class="form-group">
              <label>上传目录</label>
              <input type="text" id="upload-dialog-path" placeholder="输入目录路径，例如: images/blog" value="${config.picxUploadPath || ''}">
              <small class="form-hint">目录不存在时会自动创建。留空则上传到根目录</small>
            </div>

            <div class="upload-options">
              <div class="option-item">
                <label class="checkbox-label">
                  <input type="checkbox" id="upload-dialog-auto-date" ${config.picxAutoDateDir ? 'checked' : ''}>
                  <span>自动按日期创建子目录 (YYYY/MM/DD)</span>
                </label>
              </div>
              <div class="option-item">
                <label class="checkbox-label">
                  <input type="checkbox" id="upload-dialog-convert-webp" ${config.picxConvertWebp ? 'checked' : ''}>
                  <span>自动转换为 WebP 格式</span>
                </label>
              </div>
            </div>

            <div class="form-group">
              <label>文件名 <span style="color:#999;font-size:11px;">(留空使用原文件名)</span></label>
              <div class="upload-file-list">
                ${files.map((file, index) => `
                  <div class="upload-file-item" data-index="${index}">
                    <div class="file-preview">
                      <img src="${file.url}" alt="${file.filename}">
                    </div>
                    <div class="file-info">
                      <div class="file-name">${file.filename}</div>
                      <div class="file-rename">
                        <input type="text" class="rename-input" placeholder="输入新文件名" data-index="${index}">
                        <button class="btn btn-small hash-name-btn" data-index="${index}">哈希</button>
                      </div>
                    </div>
                  </div>
                `).join('')}
              </div>
            </div>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn btn-secondary" id="upload-dialog-cancel">取消</button>
          <button class="btn btn-primary" id="upload-dialog-confirm">开始上传</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);
    modal.classList.add('active');

    // 绑定哈希按钮
    modal.querySelectorAll('.hash-name-btn').forEach(btn => {
      btn.addEventListener('click', async function() {
        const index = parseInt(this.dataset.index);
        const file = files[index];
        const hash = await generateFileHash(file.url);
        const ext = file.filename.split('.').pop();
        const renameInput = modal.querySelector(`.rename-input[data-index="${index}"]`);
        renameInput.value = `${hash}.${ext}`;
      });
    });

    // 关闭按钮
    modal.querySelector('.modal-close').onclick = () => modal.remove();
    modal.querySelector('#upload-dialog-cancel').onclick = () => modal.remove();

    // 确认上传
    modal.querySelector('#upload-dialog-confirm').onclick = async () => {
      modal.remove();
      
      const uploadPath = modal.querySelector('#upload-dialog-path').value;
      const autoDateDir = modal.querySelector('#upload-dialog-auto-date').checked;
      const convertToWebp = modal.querySelector('#upload-dialog-convert-webp').checked;

      // 收集重命名
      const renamedFiles = files.map((file, index) => {
        const renameInput = modal.querySelector(`.rename-input[data-index="${index}"]`);
        const newName = renameInput.value.trim();
        return {
          url: file.url,
          filename: newName || file.filename
        };
      });

      // 执行上传
      await executeUploadToPicx(renamedFiles, {
        ...config,
        uploadPath,
        autoDateDir,
        convertToWebp
      });
    };
  }

  // === 执行上传到图床 ===
  async function executeUploadToPicx(files, config) {
    showNotification('正在上传图片...');

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      try {
        // 获取图片 Blob
        const response = await fetch(file.url);
        const blob = await response.blob();
        const fileObj = new File([blob], file.filename, { type: blob.type });

        // 创建 PicX 管理器实例
        const picx = new PicXManager({
          token: config.picxToken,
          owner: config.picxOwner,
          repo: config.picxRepo,
          branch: config.picxBranch,
          cdnType: config.picxCdnType,
          customCdn: config.picxCustomCdn
        });

        // 上传选项
        const options = {
          path: config.uploadPath,
          autoDateDir: config.autoDateDir,
          convertToWebp: config.convertToWebp,
          filename: file.filename
        };

        // 执行上传
        const result = await picx.uploadImage(fileObj, options);

        if (result.success) {
          successCount++;
          // 复制链接到剪贴板
          navigator.clipboard.writeText(result.url).then(() => {
            showNotification(`图片链接已复制: ${file.filename}`, 'success');
          });
        } else {
          failCount++;
          showNotification('上传失败: ' + result.message, 'error');
        }
      } catch (error) {
        failCount++;
        console.error('上传失败:', error);
        showNotification('上传失败: ' + error.message, 'error');
      }
    }

    if (successCount > 0) {
      showNotification(`成功上传 ${successCount} 张图片`, 'success');
    }
  }

  // === 生成文件哈希 ===
  async function generateFileHash(imageUrl) {
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    const buffer = await blob.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex.substring(0, 12);
  }

  // === 图片预览模态框 ===
  function openPreviewModal(img) {
    var previewModal = document.getElementById('preview-modal');
    var previewImg = document.getElementById('preview-full-image');
    var previewUrl = document.getElementById('preview-url');
    var previewDims = document.getElementById('preview-dims');
    var downloadBtn = document.getElementById('preview-download');
    var editBtn = document.getElementById('preview-edit');
    var uploadBtn = document.getElementById('preview-upload-picx');
    var copyDataBtn = document.getElementById('preview-copy-data');
    var copyBase64Btn = document.getElementById('preview-copy-base64');
    var openUrlBtn = document.getElementById('preview-open-url');
    var closeBtn = document.getElementById('preview-close');

    previewImg.src = img.url;
    previewUrl.textContent = img.url;
    previewDims.textContent = img.width + ' × ' + img.height + ' px';

    downloadBtn.onclick = function() {
      chrome.runtime.sendMessage({ action: 'downloadImage', url: img.url, filename: img.alt || 'image' });
    };

    editBtn.onclick = function() {
      previewModal.classList.remove('active');
      loadImageToEditor(img.url, img.alt || 'image');
    };

    // 上传到图床
    if (uploadBtn) {
      uploadBtn.onclick = function() {
        uploadImageToPicx(img.url, img.alt || 'image');
      };
    }

    copyDataBtn.onclick = function() {
      fetch(img.url).then(function(r) { return r.blob(); }).then(function(blob) {
        var reader = new FileReader();
        reader.onloadend = function() {
          copyToClipboard(reader.result).then(() => {
            showNotification('Data URL已复制');
          }).catch(() => {
            showNotification('复制失败', 'error');
          });
        };
        reader.readAsDataURL(blob);
      });
    };

    copyBase64Btn.onclick = function() {
      fetch(img.url).then(function(r) { return r.blob(); }).then(function(blob) {
        var reader = new FileReader();
        reader.onloadend = function() {
          copyToClipboard(reader.result.split(',')[1]).then(() => {
            showNotification('Base64已复制');
          }).catch(() => {
            showNotification('复制失败', 'error');
          });
        };
        reader.readAsDataURL(blob);
      });
    };

    openUrlBtn.onclick = function() {
      window.open(img.url, '_blank');
    };

    closeBtn.onclick = function() {
      previewModal.classList.remove('active');
    };

    previewModal.addEventListener('click', function(e) {
      if (e.target === previewModal) {
        previewModal.classList.remove('active');
      }
    });

    previewModal.classList.add('active');
  }

  // === 加载图片到编辑器 ===
  function loadImageToEditor(url, name) {
    // 切换到图片处理 tab
    var tabs = document.querySelectorAll('.tab-btn');
    var contents = document.querySelectorAll('.tab-content');
    tabs.forEach(function(t) { t.classList.remove('active'); });
    contents.forEach(function(c) { c.classList.remove('active'); });
    
    var processTab = document.querySelector('[data-tab="process"]');
    if (processTab) {
      processTab.classList.add('active');
      var processContent = document.getElementById('process-tab');
      if (processContent) processContent.classList.add('active');
    }

    // 加载图片到编辑器
    fetch(url).then(function(r) { return r.blob(); }).then(function(blob) {
      var reader = new FileReader();
      reader.onload = function(e) {
        currentImage = { url: e.target.result, name: name, size: blob.size };
        previewImg.src = e.target.result;
        previewArea.style.display = 'block';
        uploadArea.style.display = 'none';
        
        var img = new Image();
        img.onload = function() {
          imageDimensions.textContent = img.width + '×' + img.height;
          imageSize.textContent = formatSize(blob.size);
        };
        img.src = e.target.result;
        showNotification('图片已加载到编辑器');
      };
      reader.readAsDataURL(blob);
    }).catch(function(err) {
      showNotification('加载图片失败: ' + err.message, 'error');
    });
  }

  // === 图片渲染 ===
  function renderImages(images) {
    var imageList = document.getElementById('image-list');
    var imageCount = document.getElementById('image-count');
    var rescanBtn = document.getElementById('rescan-btn');

    imageCount.textContent = images.length;
    rescanBtn.style.display = images.length > 0 ? 'inline-block' : 'none';

    if (images.length === 0) {
      imageList.innerHTML = '<div class="empty-state">未检测到图片</div>';
      return;
    }

    imageList.className = 'image-grid';
    imageList.innerHTML = images.map(function(img, idx) {
      var typeLabel = '';
      if (img.type && img.type !== 'img') {
        typeLabel = '<span class="type-badge">' + img.type + '</span>';
      }
      return '<div class="grid-item" data-idx="' + idx + '">' +
        '<div class="grid-thumb-wrap">' +
        '<input type="checkbox" class="grid-checkbox" data-url="' + encodeURIComponent(img.url) + '">' +
        '<img class="grid-thumb" src="' + img.url + '" onerror="this.parentElement.classList.add(\'img-error\')">' +
        '<button class="grid-view-btn" data-idx="' + idx + '" title="查看大图">🔍</button>' +
        typeLabel +
        '</div>' +
        '<div class="grid-info">' +
        '<span class="grid-dims">' + (img.width || '?') + '×' + (img.height || '?') + '</span>' +
        '<button class="grid-dl-btn" data-url="' + encodeURIComponent(img.url) + '" title="下载">⬇</button>' +
        '</div>' +
        '</div>';
    }).join('');

    // 绑定下载按钮
    document.querySelectorAll('.grid-dl-btn').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var url = decodeURIComponent(this.dataset.url);
        chrome.runtime.sendMessage({ action: 'downloadImage', url: url, filename: 'image' });
      });
    });

    // 绑定查看大图按钮
    document.querySelectorAll('.grid-view-btn').forEach(function(btn) {
      btn.addEventListener('click', function(e) {
        e.stopPropagation();
        var idx = parseInt(this.dataset.idx);
        openPreviewModal(images[idx]);
      });
    });

    // 点击缩略图区域切换选中状态
    document.querySelectorAll('.grid-item').forEach(function(item) {
      item.addEventListener('click', function(e) {
        if (e.target.classList.contains('grid-checkbox') || e.target.classList.contains('grid-dl-btn') || e.target.classList.contains('grid-view-btn')) return;
        var cb = this.querySelector('.grid-checkbox');
        cb.checked = !cb.checked;
        this.classList.toggle('selected', cb.checked);
      });
      var cb = item.querySelector('.grid-checkbox');
      cb.addEventListener('change', function() {
        item.classList.toggle('selected', this.checked);
      });
    });

    // 异步获取图片真实尺寸
    images.forEach(function(img, idx) {
      if (!img.width || !img.height) {
        var tempImg = new Image();
        tempImg.onload = function() {
          img.width = tempImg.naturalWidth;
          img.height = tempImg.naturalHeight;
          // 更新对应的 DOM 元素
          var dimsEl = document.querySelector('.grid-item[data-idx="' + idx + '"] .grid-dims');
          if (dimsEl) {
            dimsEl.textContent = img.width + '×' + img.height;
          }
        };
        tempImg.src = img.url;
      }
    });
  }

  // === 扫描核心逻辑 ===
  async function doScan(deep) {
    var scanBtn = document.getElementById('scan-btn');
    scanBtn.disabled = true;
    scanBtn.textContent = '扫描中...';

    try {
      var tabArr = await chrome.tabs.query({ active: true, currentWindow: true });
      var tab = tabArr[0];
      if (!tab) throw new Error('无法获取当前标签页');

      if (tab.url.startsWith('chrome://') ||
          tab.url.startsWith('chrome-extension://') ||
          tab.url.startsWith('edge://') ||
          tab.url.startsWith('about:')) {
        throw new Error('无法在此页面使用，请切换到普通网页');
      }

      // 从 background 获取已捕获的图片（网络监听 + DOM 扫描）
      var response = await new Promise(function(resolve, reject) {
        chrome.runtime.sendMessage({ action: 'getImages', tabId: tab.id }, function(resp) {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else {
            resolve(resp);
          }
        });
      });
      var allImages = (response && response.images) ? response.images : [];

      // 过滤
      var includeFavicons = document.getElementById('include-favicons').checked;
      var includeBackgrounds = document.getElementById('include-backgrounds').checked;

      var images = allImages.filter(function(img) {
        if (deep) return true;
        if (!includeFavicons && img.type === 'favicon') return false;
        if (!includeBackgrounds && img.isBackground) return false;
        return true;
      });

      renderImages(images);
      showNotification('检测到 ' + images.length + ' 张图片' + (deep ? '（深度扫描）' : ''));
    } catch (err) {
      showNotification('扫描失败: ' + err.message, 'error');
    } finally {
      scanBtn.disabled = false;
      scanBtn.textContent = '扫描页面';
    }
  }

  // === 扫描按钮 ===
  document.getElementById('scan-btn').addEventListener('click', function() {
    doScan(false);
  });

  // === 重新扫描按钮 ===
  document.getElementById('rescan-btn').addEventListener('click', function() {
    doScan(false);
  });

  // === 深度扫描按钮 ===
  document.getElementById('deep-scan-btn').addEventListener('click', function() {
    doScan(true);
  });

  // === 过滤选项变化时自动重新过滤 ===
  document.getElementById('include-favicons').addEventListener('change', function() {
    doScan(false);
  });
  document.getElementById('include-backgrounds').addEventListener('change', function() {
    doScan(false);
  });

  // === 全选按钮 ===
  document.getElementById('select-all-btn').addEventListener('click', function() {
    var cbs = document.querySelectorAll('.grid-checkbox');
    var allChecked = Array.from(cbs).every(function(cb) { return cb.checked; });
    cbs.forEach(function(cb) { cb.checked = !allChecked; });
  });

  // === 批量下载按钮 ===
  document.getElementById('batch-download-btn').addEventListener('click', function() {
    var cbs = document.querySelectorAll('.grid-checkbox:checked');
    if (cbs.length === 0) {
      showNotification('请先选择要下载的图片', 'error');
      return;
    }
    cbs.forEach(function(cb) {
      var url = decodeURIComponent(cb.dataset.url);
      chrome.runtime.sendMessage({ action: 'downloadImage', url: url, filename: 'image' });
    });
    showNotification('正在下载 ' + cbs.length + ' 张图片');
  });

  // === 图片处理 Tab ===
  var uploadArea = document.getElementById('upload-area');
  var fileInput = document.getElementById('file-input');
  var previewArea = document.getElementById('preview-area');
  var previewImg = document.getElementById('preview-image');
  var imageDimensions = document.getElementById('image-dimensions');
  var imageSize = document.getElementById('image-size');
  var currentImage = null;

  uploadArea.addEventListener('click', function() { fileInput.click(); });

  uploadArea.addEventListener('dragover', function(e) {
    e.preventDefault();
    uploadArea.classList.add('dragover');
  });
  uploadArea.addEventListener('dragleave', function() {
    uploadArea.classList.remove('dragover');
  });
  uploadArea.addEventListener('drop', function(e) {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    var files = Array.from(e.dataTransfer.files).filter(function(f) { return f.type.startsWith('image/'); });
    if (files.length > 0) handleFile(files[0]);
  });
  fileInput.addEventListener('change', function(e) {
    if (e.target.files.length > 0) handleFile(e.target.files[0]);
  });

  function handleFile(file) {
    var reader = new FileReader();
    reader.onload = function(e) {
      currentImage = { url: e.target.result, name: file.name, size: file.size };
      previewImg.src = e.target.result;
      previewArea.style.display = 'block';
      uploadArea.style.display = 'none';
      var img = new Image();
      img.onload = function() {
        imageDimensions.textContent = img.width + '×' + img.height;
        imageSize.textContent = formatSize(file.size);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  document.getElementById('clear-preview').addEventListener('click', function() {
    currentImage = null;
    previewArea.style.display = 'none';
    uploadArea.style.display = 'block';
    fileInput.value = '';
  });

  function formatSize(b) {
    if (b < 1024) return b + ' B';
    if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
    return (b / 1048576).toFixed(1) + ' MB';
  }

  // === 工具卡片 ===
  var modal = document.getElementById('tool-modal');
  var modalTitle = document.getElementById('modal-title');
  var modalBody = document.getElementById('modal-body');

  document.querySelectorAll('.tool-card').forEach(function(card) {
    card.addEventListener('click', function() {
      if (!currentImage) { showNotification('请先上传图片', 'error'); return; }
      openTool(card.dataset.tool);
    });
  });

  document.getElementById('modal-close').addEventListener('click', function() {
    modal.classList.remove('active');
  });
  modal.addEventListener('click', function(e) {
    if (e.target === modal) modal.classList.remove('active');
  });

  function openTool(tool) {
    var title = '', html = '';
    switch (tool) {
      case 'resize':
        title = '调整尺寸';
        html = resizeForm();
        break;
      case 'crop':
        title = '裁剪图片';
        html = cropForm();
        break;
      case 'compress':
        title = '压缩图片';
        html = compressForm();
        break;
      case 'convert':
        title = '格式转换';
        html = convertForm();
        break;
      case 'upscale':
        title = '图片放大';
        html = upscaleForm();
        break;
      case 'base64':
        title = '转Base64';
        html = base64Form();
        break;
    }
    modalTitle.textContent = title;
    modalBody.innerHTML = html;
    modal.classList.add('active');
    initTool(tool);
  }

  // === 工具表单模板 ===
  function resizeForm() {
    return '<div class="tool-form">' +
      '<div class="form-row"><div class="form-group"><label>宽度 (px)</label><input type="number" id="rw"></div>' +
      '<div class="form-group"><label>高度 (px)</label><input type="number" id="rh"></div></div>' +
      '<div class="form-group"><label>通用/屏幕</label><div class="size-presets">' +
      presetBtn(3840,2160,'4K UHD') + presetBtn(2560,1440,'2K QHD') +
      presetBtn(1920,1080,'Full HD') + presetBtn(1366,768,'笔记本') +
      presetBtn(1280,720,'HD 720p') + presetBtn(1024,768,'XGA') +
      presetBtn(800,600,'SVGA') + presetBtn(640,480,'VGA') +
      '</div></div>' +
      '<div class="form-group"><label>社交媒体</label><div class="size-presets">' +
      presetBtn(200,200,'微信头像') + presetBtn(900,383,'微信公众号首图') +
      presetBtn(1080,1080,'微信朋友圈') + presetBtn(1080,1920,'抖音/快手竖版') +
      presetBtn(1080,1440,'小红书') + presetBtn(1920,1000,'微博头图') +
      presetBtn(900,500,'微博配图') + presetBtn(1080,1080,'Instagram') +
      presetBtn(1080,1920,'IG Story/Reels') + presetBtn(820,312,'Facebook封面') +
      presetBtn(180,180,'Facebook头像') + presetBtn(1500,500,'Twitter/X头图') +
      presetBtn(1280,720,'YouTube缩略图') + presetBtn(2560,1440,'YouTube横幅') +
      presetBtn(1146,717,'B站封面') + presetBtn(1920,1080,'B站视频') +
      presetBtn(1146,717,'知乎头图') + presetBtn(1080,1350,'Pinterest') +
      '</div></div>' +
      '<div class="form-group"><label>电商</label><div class="size-presets">' +
      presetBtn(800,800,'淘宝/天猫主图') + presetBtn(800,800,'京东主图') +
      presetBtn(750,1000,'详情页宽图') + presetBtn(1242,1660,'天猫详情页') +
      '</div></div>' +
      '<div class="form-group"><label>证件照</label><div class="size-presets">' +
      presetBtn(295,413,'一寸') + presetBtn(413,579,'二寸') +
      presetBtn(413,531,'小一寸') + presetBtn(626,413,'护照') +
      '</div></div>' +
      '<div class="form-group"><label>Web 开发</label><div class="size-presets">' +
      presetBtn(16,16,'Favicon') + presetBtn(32,32,'Favicon@2x') +
      presetBtn(180,180,'Apple Touch Icon') + presetBtn(192,192,'PWA Icon') +
      presetBtn(512,512,'PWA Icon HD') + presetBtn(1200,630,'OG Image') +
      presetBtn(1200,600,'Twitter Card') + presetBtn(2400,1260,'OG Image HD') +
      presetBtn(1920,600,'Hero Banner') + presetBtn(1920,400,'Website Header') +
      presetBtn(1024,768,'iPad') + presetBtn(768,1024,'iPad竖版') +
      presetBtn(375,812,'iPhone X') + presetBtn(414,896,'iPhone XR') +
      presetBtn(360,640,'Android') + presetBtn(768,1024,'Tablet') +
      '</div></div>' +
      '<div class="modal-actions"><button class="btn btn-secondary" id="tool-cancel">取消</button>' +
      '<button class="btn btn-primary" id="tool-apply">应用</button></div></div>';
  }

  function presetBtn(w, h, name) {
    return '<div class="size-preset" data-w="' + w + '" data-h="' + h + '">' +
      '<div class="preset-name">' + name + '</div>' +
      '<div class="preset-size">' + w + '×' + h + '</div></div>';
  }

  function cropForm() {
    return '<div class="tool-form">' +
      '<div class="form-group"><label>裁剪形状</label><div class="crop-options">' +
      '<div class="crop-option active" data-shape="rectangle"><div class="shape-icon">▭</div><div class="shape-label">矩形</div></div>' +
      '<div class="crop-option" data-shape="circle"><div class="shape-icon">○</div><div class="shape-label">圆形</div></div>' +
      '</div></div>' +
      '<div class="form-row"><div class="form-group"><label>X</label><input type="number" id="cx" value="0"></div>' +
      '<div class="form-group"><label>Y</label><input type="number" id="cy" value="0"></div></div>' +
      '<div class="form-row"><div class="form-group"><label>宽度</label><input type="number" id="cw"></div>' +
      '<div class="form-group"><label>高度</label><input type="number" id="ch"></div></div>' +
      '<div class="modal-actions"><button class="btn btn-secondary" id="tool-cancel">取消</button>' +
      '<button class="btn btn-primary" id="tool-apply">应用</button></div></div>';
  }

  function compressForm() {
    return '<div class="tool-form">' +
      '<div class="form-group"><label>压缩质量: <span id="cq-val">80</span>%</label>' +
      '<input type="range" id="cq" min="10" max="100" value="80"></div>' +
      '<div class="form-group"><label>输出格式</label><select id="cf">' +
      '<option value="jpeg">JPEG</option><option value="png">PNG</option><option value="webp">WebP</option></select></div>' +
      '<div class="modal-actions"><button class="btn btn-secondary" id="tool-cancel">取消</button>' +
      '<button class="btn btn-primary" id="tool-apply">压缩并下载</button></div></div>';
  }

  function convertForm() {
    return '<div class="tool-form">' +
      '<div class="form-group"><label>目标格式</label><select id="vf">' +
      '<option value="jpeg">JPEG</option><option value="png">PNG</option><option value="webp">WebP</option></select></div>' +
      '<div class="form-group"><label>质量: <span id="vq-val">92</span>%</label>' +
      '<input type="range" id="vq" min="10" max="100" value="92"></div>' +
      '<div class="modal-actions"><button class="btn btn-secondary" id="tool-cancel">取消</button>' +
      '<button class="btn btn-primary" id="tool-apply">转换并下载</button></div></div>';
  }

  function upscaleForm() {
    return '<div class="tool-form">' +
      '<div class="form-group"><label>放大倍数</label><div class="upscale-options">' +
      '<div class="upscale-option active" data-scale="2"><div class="scale-factor">2×</div><div class="scale-label">标准</div></div>' +
      '<div class="upscale-option" data-scale="3"><div class="scale-factor">3×</div><div class="scale-label">高质量</div></div>' +
      '<div class="upscale-option" data-scale="4"><div class="scale-factor">4×</div><div class="scale-label">超高清</div></div>' +
      '</div></div>' +
      '<div class="modal-actions"><button class="btn btn-secondary" id="tool-cancel">取消</button>' +
      '<button class="btn btn-primary" id="tool-apply">放大并预览</button></div></div>';
  }

  function base64Form() {
    return '<div class="tool-form">' +
      '<div class="form-group"><label>Data URL / Base64</label>' +
      '<textarea class="base64-output" id="b64-out" readonly></textarea></div>' +
      '<div class="modal-actions">' +
      '<button class="btn btn-secondary" id="copy-b64">复制Base64</button>' +
      '<button class="btn btn-secondary" id="copy-url">复制Data URL</button>' +
      '<button class="btn btn-primary" id="tool-cancel">关闭</button></div></div>';
  }

  // === 工具事件初始化 ===
  function initTool(tool) {
    var cancelBtn = document.getElementById('tool-cancel');
    if (cancelBtn) cancelBtn.addEventListener('click', function() { modal.classList.remove('active'); });

    var applyBtn = document.getElementById('tool-apply');

    switch (tool) {
      case 'resize':
        document.querySelectorAll('.size-preset').forEach(function(p) {
          p.addEventListener('click', function() {
            // 移除其他预设的 active 状态
            document.querySelectorAll('.size-preset').forEach(function(x) { 
              x.classList.remove('active'); 
            });
            // 添加当前预设的 active 状态
            p.classList.add('active');
            // 填入宽高值
            document.getElementById('rw').value = p.dataset.w;
            document.getElementById('rh').value = p.dataset.h;
          });
        });
        if (applyBtn) applyBtn.addEventListener('click', function() {
          var w = parseInt(document.getElementById('rw').value);
          var h = parseInt(document.getElementById('rh').value);
          if (!w || !h) { showNotification('请输入宽高', 'error'); return; }
          processAndPreview({ resize: { width: w, height: h } }, 'resized_');
        });
        break;

      case 'crop':
        document.querySelectorAll('.crop-option').forEach(function(o) {
          o.addEventListener('click', function() {
            document.querySelectorAll('.crop-option').forEach(function(x) { x.classList.remove('active'); });
            o.classList.add('active');
          });
        });
        if (applyBtn) applyBtn.addEventListener('click', function() {
          var x = parseInt(document.getElementById('cx').value) || 0;
          var y = parseInt(document.getElementById('cy').value) || 0;
          var w = parseInt(document.getElementById('cw').value);
          var h = parseInt(document.getElementById('ch').value);
          if (!w || !h) { showNotification('请输入裁剪尺寸', 'error'); return; }
          processAndPreview({ crop: { x: x, y: y, width: w, height: h }, resize: { width: w, height: h } }, 'cropped_');
        });
        break;

      case 'compress':
        var cq = document.getElementById('cq');
        cq.addEventListener('input', function() { document.getElementById('cq-val').textContent = cq.value; });
        if (applyBtn) applyBtn.addEventListener('click', function() {
          var q = parseInt(cq.value) / 100;
          var f = document.getElementById('cf').value;
          processAndPreview({ format: f, quality: q }, 'compressed_');
        });
        break;

      case 'convert':
        var vq = document.getElementById('vq');
        vq.addEventListener('input', function() { document.getElementById('vq-val').textContent = vq.value; });
        if (applyBtn) applyBtn.addEventListener('click', function() {
          var q = parseInt(vq.value) / 100;
          var f = document.getElementById('vf').value;
          processAndPreview({ format: f, quality: q }, 'converted_');
        });
        break;

      case 'upscale':
        var scale = 2;
        document.querySelectorAll('.upscale-option').forEach(function(o) {
          o.addEventListener('click', function() {
            document.querySelectorAll('.upscale-option').forEach(function(x) { x.classList.remove('active'); });
            o.classList.add('active');
            scale = parseInt(o.dataset.scale);
          });
        });
        if (applyBtn) applyBtn.addEventListener('click', async function() {
          // 检查是否启用了AI放大
          var aiConfig = await new Promise(resolve => {
            chrome.storage.sync.get({
              aiUpscaleEnabled: false,
              aiUpscaleProvider: '',
              aiUpscaleApiKey: '',
              aiUpscaleEndpoint: ''
            }, resolve);
          });
          
          if (aiConfig.aiUpscaleEnabled && aiConfig.aiUpscaleApiKey) {
            // 调用AI放大API
            showNotification('正在调用AI放大服务...');
            try {
              await callAiUpscaleApi(scale, aiConfig);
            } catch (err) {
              showNotification('AI放大失败: ' + err.message + '，使用算法放大', 'error');
              // 降级到算法放大
              var img = new Image();
              img.onload = function() {
                processAndPreview({ resize: { width: img.width * scale, height: img.height * scale } }, 'upscaled_');
              };
              img.src = currentImage.url;
            }
          } else {
            // 默认算法放大
            var img = new Image();
            img.onload = function() {
              processAndPreview({ resize: { width: img.width * scale, height: img.height * scale } }, 'upscaled_');
            };
            img.src = currentImage.url;
          }
        });
        break;

      case 'base64':
        var output = document.getElementById('b64-out');
        fetch(currentImage.url).then(function(r) { return r.blob(); }).then(function(blob) {
          var reader = new FileReader();
          reader.onloadend = function() { output.value = reader.result; };
          reader.readAsDataURL(blob);
        });
        document.getElementById('copy-b64').addEventListener('click', function() {
          copyToClipboard(output.value.split(',')[1]).then(() => {
            showNotification('Base64已复制');
          }).catch(() => {
            showNotification('复制失败', 'error');
          });
        });

        document.getElementById('copy-url').addEventListener('click', function() {
          copyToClipboard(output.value).then(() => {
            showNotification('Data URL已复制');
          }).catch(() => {
            showNotification('复制失败', 'error');
          });
        });
        break;
    }
  }

  // === 图片处理并下载 ===
  function processAndPreview(options, prefix) {
    var canvas = document.createElement('canvas');
    var ctx = canvas.getContext('2d');
    var img = new Image();
    img.onload = function() {
      var w = options.resize ? options.resize.width : img.width;
      var h = options.resize ? options.resize.height : img.height;
      var cx = options.crop ? options.crop.x : 0;
      var cy = options.crop ? options.crop.y : 0;
      var cw = options.crop ? options.crop.width : img.width;
      var ch = options.crop ? options.crop.height : img.height;

      canvas.width = w;
      canvas.height = h;

      var fmt = options.format || 'jpeg';
      if (fmt === 'jpeg') {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, w, h);
      }

      ctx.drawImage(img, cx, cy, cw, ch, 0, 0, w, h);

      var mime = fmt === 'png' ? 'image/png' : fmt === 'webp' ? 'image/webp' : 'image/jpeg';
      var quality = options.quality || 0.92;
      var ext = fmt === 'png' ? '.png' : fmt === 'webp' ? '.webp' : '.jpg';

      canvas.toBlob(function(blob) {
        var url = URL.createObjectURL(blob);
        var filename = (prefix || '') + currentImage.name.replace(/\.[^/.]+$/, '') + ext;
        
        // 关闭工具模态框
        modal.classList.remove('active');
        
        // 显示预览
        showProcessedPreview(url, filename, w, h, blob.size);
      }, mime, quality);
    };
    img.src = currentImage.url;
  }

  function showProcessedPreview(url, filename, width, height, size) {
    // 切换到图片处理 tab
    var tabs = document.querySelectorAll('.tab-btn');
    var contents = document.querySelectorAll('.tab-content');
    tabs.forEach(function(t) { t.classList.remove('active'); });
    contents.forEach(function(c) { c.classList.remove('active'); });
    
    var processTab = document.querySelector('[data-tab="process"]');
    if (processTab) {
      processTab.classList.add('active');
      var processContent = document.getElementById('process-tab');
      if (processContent) processContent.classList.add('active');
    }

    // 更新预览区域
    previewImg.src = url;
    previewArea.style.display = 'block';
    uploadArea.style.display = 'none';
    imageDimensions.textContent = width + '×' + height;
    imageSize.textContent = formatSize(size);
    
    // 更新 currentImage 为处理后的图片
    currentImage = { url: url, name: filename, size: size };

    // 添加操作按钮到预览区域
    var actionsDiv = document.getElementById('preview-actions');
    if (!actionsDiv) {
      actionsDiv = document.createElement('div');
      actionsDiv.id = 'preview-actions';
      actionsDiv.style.cssText = 'display: flex; gap: 10px; margin-top: 12px;';
      previewArea.appendChild(actionsDiv);
    }
    
    actionsDiv.innerHTML = '';
    
    // 继续编辑按钮
    var editBtn = document.createElement('button');
    editBtn.className = 'btn btn-secondary';
    editBtn.textContent = '继续编辑';
    editBtn.style.flex = '1';
    editBtn.onclick = function() {
      // 滚动到工具卡片区域
      var toolsGrid = document.querySelector('.tools-grid');
      if (toolsGrid) {
        toolsGrid.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
      showNotification('请选择下一个编辑工具');
    };
    actionsDiv.appendChild(editBtn);
    
    // 下载按钮
    var downloadBtn = document.createElement('button');
    downloadBtn.className = 'btn btn-primary';
    downloadBtn.textContent = '下载图片';
    downloadBtn.style.flex = '1';
    downloadBtn.onclick = function() {
      chrome.runtime.sendMessage({ 
        action: 'downloadImage', 
        url: url, 
        filename: filename 
      });
    };
    actionsDiv.appendChild(downloadBtn);

    // 上传到图床按钮
    var uploadBtn = document.createElement('button');
    uploadBtn.className = 'btn btn-primary';
    uploadBtn.textContent = '上传到图床';
    uploadBtn.style.flex = '1';
    uploadBtn.style.background = '#2196F3';
    uploadBtn.onclick = function() {
      uploadImageToPicx(url, filename);
    };
    actionsDiv.appendChild(uploadBtn);

    showNotification('处理完成，可以继续编辑、下载或上传到图床');
  }

  // === 批量操作 Tab ===
  var bq = document.getElementById('batch-quality');
  bq.addEventListener('input', function() {
    document.getElementById('quality-value').textContent = bq.value + '%';
  });

  document.getElementById('batch-convert-btn').addEventListener('click', async function() {
    try {
      var tabArr = await chrome.tabs.query({ active: true, currentWindow: true });
      var tab = tabArr[0];
      var response = await new Promise(function(resolve, reject) {
        chrome.runtime.sendMessage({ action: 'getImages', tabId: tab.id }, function(resp) {
          if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message));
          else resolve(resp);
        });
      });
      var images = (response && response.images) ? response.images : [];

      if (images.length === 0) { showNotification('未检测到图片', 'error'); return; }

      var fmt = document.getElementById('batch-format').value;
      var quality = parseInt(bq.value) / 100;

      showNotification('正在处理 ' + images.length + ' 张图片...');

      for (var i = 0; i < images.length; i++) {
        chrome.runtime.sendMessage({
          action: 'downloadImage',
          url: images[i].url,
          filename: 'batch_' + i,
          format: fmt === 'original' ? null : fmt,
          quality: quality
        });
      }
      showNotification('批量处理完成');
    } catch (err) {
      showNotification('批量处理失败: ' + err.message, 'error');
    }
  });

  // === 设置 Tab ===
  var dq = document.getElementById('default-quality');
  dq.addEventListener('input', function() {
    document.getElementById('default-quality-value').textContent = dq.value + '%';
  });

  // AI 放大配置
  var aiProvider = document.getElementById('ai-upscale-provider');
  var aiEndpointGroup = document.getElementById('ai-upscale-endpoint-group');
  
  aiProvider.addEventListener('change', function() {
    aiEndpointGroup.style.display = this.value === 'custom' ? 'block' : 'none';
    chrome.storage.sync.set({ aiUpscaleProvider: this.value });
  });

  chrome.storage.sync.get({
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
  }, function(s) {
    document.getElementById('default-format').value = s.defaultFormat;
    dq.value = s.defaultQuality;
    document.getElementById('default-quality-value').textContent = s.defaultQuality + '%';
    document.getElementById('auto-detect').checked = s.autoDetect;
    document.getElementById('show-notifications').checked = s.showNotifications;
    
    // AI 放大配置
    document.getElementById('ai-upscale-enabled').checked = s.aiUpscaleEnabled;
    aiProvider.value = s.aiUpscaleProvider;
    document.getElementById('ai-upscale-apikey').value = s.aiUpscaleApiKey;
    document.getElementById('ai-upscale-endpoint').value = s.aiUpscaleEndpoint;
    aiEndpointGroup.style.display = s.aiUpscaleProvider === 'custom' ? 'block' : 'none';
    
    // GitHub 图床配置
    document.getElementById('picx-token').value = s.picxToken;
    document.getElementById('picx-owner').value = s.picxOwner;
    document.getElementById('picx-repo').value = s.picxRepo;
    document.getElementById('picx-branch').value = s.picxBranch;
    document.getElementById('picx-cdn-type').value = s.picxCdnType;
    document.getElementById('picx-custom-cdn').value = s.picxCustomCdn;
    document.getElementById('picx-custom-cdn-group').style.display = s.picxCdnType === 'custom' ? 'block' : 'none';
  });

  document.getElementById('default-format').addEventListener('change', function() {
    chrome.storage.sync.set({ defaultFormat: this.value });
  });
  dq.addEventListener('change', function() {
    chrome.storage.sync.set({ defaultQuality: parseInt(this.value) });
  });
  document.getElementById('auto-detect').addEventListener('change', function() {
    chrome.storage.sync.set({ autoDetect: this.checked });
  });
  document.getElementById('show-notifications').addEventListener('change', function() {
    chrome.storage.sync.set({ showNotifications: this.checked });
  });
  
  // AI 放大配置保存
  document.getElementById('ai-upscale-enabled').addEventListener('change', function() {
    chrome.storage.sync.set({ aiUpscaleEnabled: this.checked });
  });
  document.getElementById('ai-upscale-apikey').addEventListener('change', function() {
    chrome.storage.sync.set({ aiUpscaleApiKey: this.value });
  });
  document.getElementById('ai-upscale-endpoint').addEventListener('change', function() {
    chrome.storage.sync.set({ aiUpscaleEndpoint: this.value });
  });

  // GitHub 图床配置保存
  var picxCdnType = document.getElementById('picx-cdn-type');
  var picxCustomCdnGroup = document.getElementById('picx-custom-cdn-group');
  
  picxCdnType.addEventListener('change', function() {
    picxCustomCdnGroup.style.display = this.value === 'custom' ? 'block' : 'none';
    chrome.storage.sync.set({ picxCdnType: this.value });
  });

  document.getElementById('picx-token').addEventListener('change', function() {
    chrome.storage.sync.set({ picxToken: this.value });
  });
  document.getElementById('picx-owner').addEventListener('change', function() {
    chrome.storage.sync.set({ picxOwner: this.value });
  });
  document.getElementById('picx-repo').addEventListener('change', function() {
    chrome.storage.sync.set({ picxRepo: this.value });
  });
  document.getElementById('picx-branch').addEventListener('change', function() {
    chrome.storage.sync.set({ picxBranch: this.value });
  });
  document.getElementById('picx-custom-cdn').addEventListener('change', function() {
    chrome.storage.sync.set({ picxCustomCdn: this.value });
  });

  // 测试连接按钮
  document.getElementById('picx-test-connection').addEventListener('click', async function() {
    const token = document.getElementById('picx-token').value;
    const owner = document.getElementById('picx-owner').value;
    const repo = document.getElementById('picx-repo').value;
    const branch = document.getElementById('picx-branch').value;

    if (!token || !owner) {
      showNotification('请先填写 Token 和用户名', 'error');
      return;
    }

    try {
      const response = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        showNotification(`连接成功！仓库: ${data.full_name}`, 'success');
      } else {
        showNotification(`连接失败: ${response.status} ${response.statusText}`, 'error');
      }
    } catch (error) {
      showNotification('连接失败: ' + error.message, 'error');
    }
  });
});
