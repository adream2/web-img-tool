// PicX 图床面板逻辑 - 纯操作页面，配置从设置读取

(function() {
  'use strict';

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

  let picxManager = null;
  let currentPath = '';
  let currentImage = null;
  let isInitialized = false;

  // 初始化 - 监听标签页切换
  function init() {
    const picxTabBtn = document.querySelector('[data-tab="picx"]');
    if (picxTabBtn) {
      picxTabBtn.addEventListener('click', function() {
        if (!isInitialized) {
          loadPicxContent();
        }
      });
    }
  }

  // 加载 PicX 内容
  async function loadPicxContent() {
    try {
      const response = await fetch(chrome.runtime.getURL('picx.html'));
      const html = await response.text();
      const container = document.getElementById('picx-container');
      if (container) {
        container.innerHTML = html;
        isInitialized = true;
        setTimeout(() => {
          loadConfig();
          bindEvents();
          loadQuickDirs();
        }, 100);
      }
    } catch (error) {
      console.error('加载 PicX 内容失败:', error);
    }
  }

  // 加载配置并初始化
  function loadConfig() {
    chrome.storage.sync.get({
      picxToken: '',
      picxOwner: '',
      picxRepo: 'picx-images-hosting',
      picxBranch: 'master',
      picxCdnType: 'github',
      picxCustomCdn: '',
      picxUploadPath: '',
      picxAutoDateDir: false,
      picxConvertWebp: true,
      picxQuickDirs: ['images', 'blog']
    }, function(config) {
      // 检查是否已配置
      if (!config.picxToken || !config.picxOwner) {
        showUnconfigured();
        return;
      }

      // 初始化 PicX 管理器
      picxManager = new PicXManager({
        token: config.picxToken,
        owner: config.picxOwner,
        repo: config.picxRepo,
        branch: config.picxBranch,
        cdnType: config.picxCdnType,
        customCdn: config.picxCustomCdn
      });

      // 保存默认配置供上传时使用
      window.picxDefaultConfig = {
        uploadPath: config.picxUploadPath,
        autoDateDir: config.picxAutoDateDir,
        convertWebp: config.picxConvertWebp
      };

      renderQuickDirs(config.picxQuickDirs);
      loadDirectoryTree();
    });
  }

  // 显示未配置状态
  function showUnconfigured() {
    const container = document.getElementById('picx-container');
    container.innerHTML = `
      <div class="picx-unconfigured">
        <div class="unconfigured-icon">📦</div>
        <h3>图床未配置</h3>
        <p>请先在设置页面配置 GitHub 图床信息</p>
        <button class="btn btn-primary" id="go-to-settings">前往设置</button>
      </div>
    `;
    document.getElementById('go-to-settings').addEventListener('click', function() {
      document.querySelector('[data-tab="settings"]').click();
    });
  }

  // 绑定事件
  function bindEvents() {
    // 上传区域
    const uploadArea = document.getElementById('picx-upload-area');
    const fileInput = document.getElementById('picx-file-input');
    
    uploadArea.addEventListener('click', () => fileInput.click());
    uploadArea.addEventListener('dragover', handleDragOver);
    uploadArea.addEventListener('dragleave', handleDragLeave);
    uploadArea.addEventListener('drop', handleDrop);
    fileInput.addEventListener('change', handleFileSelect);

    // 刷新
    document.getElementById('picx-refresh').addEventListener('click', loadDirectoryTree);

    // 模态框关闭
    document.getElementById('picx-image-modal-close').addEventListener('click', () => {
      document.getElementById('picx-image-modal').classList.remove('active');
    });
    document.getElementById('picx-image-close').addEventListener('click', () => {
      document.getElementById('picx-image-modal').classList.remove('active');
    });

    // 删除图片
    document.getElementById('picx-image-delete').addEventListener('click', deleteCurrentImage);

    // 复制链接
    document.querySelectorAll('[data-copy]').forEach(btn => {
      btn.addEventListener('click', function() {
        const type = this.dataset.copy;
        copyImageLink(type);
      });
    });
  }

  // 加载目录树
  async function loadDirectoryTree() {
    if (!picxManager) return;

    const treeContainer = document.getElementById('picx-directory-tree');
    treeContainer.innerHTML = '';

    try {
      // 创建根目录节点
      const rootItem = document.createElement('div');
      rootItem.className = 'tree-item active';
      rootItem.dataset.path = '';
      rootItem.dataset.loaded = 'false';
      rootItem.innerHTML = `
        <span class="tree-toggle">▶</span>
        <span class="tree-icon">📁</span>
        <span class="tree-name">根目录</span>
      `;
      
      // 点击展开/折叠
      rootItem.querySelector('.tree-toggle').addEventListener('click', async (e) => {
        e.stopPropagation();
        await toggleDirectory(rootItem, '');
      });
      
      // 点击选中目录
      rootItem.addEventListener('click', (e) => {
        if (!e.target.classList.contains('tree-toggle')) {
          selectDirectory('');
        }
      });
      
      treeContainer.appendChild(rootItem);
      
      // 加载根目录图片
      loadImages('');
    } catch (error) {
      console.error('加载目录失败:', error);
    }
  }

  // 加载子目录（懒加载）
  async function loadChildrenDirectories(container, parentPath, level) {
    try {
      const result = await picxManager.listDirectories(parentPath);
      if (result.success && result.directories.length > 0) {
        for (const dir of result.directories) {
          const item = document.createElement('div');
          item.className = 'tree-item';
          item.dataset.path = dir.path;
          item.dataset.loaded = 'false';
          item.style.paddingLeft = (level * 20 + 8) + 'px';
          item.innerHTML = `
            <span class="tree-toggle">▶</span>
            <span class="tree-icon">📁</span>
            <span class="tree-name">${dir.name}</span>
          `;
          
          // 点击展开/折叠
          item.querySelector('.tree-toggle').addEventListener('click', async (e) => {
            e.stopPropagation();
            await toggleDirectory(item, dir.path, level + 1);
          });
          
          // 点击选中目录
          item.addEventListener('click', (e) => {
            if (!e.target.classList.contains('tree-toggle')) {
              selectDirectory(dir.path);
            }
          });
          
          container.appendChild(item);
        }
      }
    } catch (error) {
      console.error('加载子目录失败:', error);
    }
  }

  // 切换目录展开/折叠（懒加载）
  async function toggleDirectory(item, path, level = 0) {
    const toggle = item.querySelector('.tree-toggle');
    let childrenContainer = item.nextElementSibling;
    
    // 检查是否已有子目录容器
    if (!childrenContainer || !childrenContainer.classList.contains('tree-children')) {
      // 创建子目录容器
      childrenContainer = document.createElement('div');
      childrenContainer.className = 'tree-children';
      childrenContainer.style.display = 'none';
      item.after(childrenContainer);
    }
    
    if (childrenContainer.style.display === 'none') {
      // 展开
      if (item.dataset.loaded === 'false') {
        // 首次展开，加载子目录
        await loadChildrenDirectories(childrenContainer, path, level);
        item.dataset.loaded = 'true';
      }
      childrenContainer.style.display = 'block';
      toggle.textContent = '▼';
    } else {
      // 折叠
      childrenContainer.style.display = 'none';
      toggle.textContent = '▶';
    }
  }

  // 选择目录
  async function selectDirectory(path) {
    currentPath = path;
    
    // 更新目录树选中状态
    document.querySelectorAll('.tree-item').forEach(item => {
      item.classList.toggle('active', item.dataset.path === path);
    });
    
    // 加载该目录的图片
    await loadImages(path);
  }

  // 加载图片列表
  async function loadImages(path) {
    if (!picxManager) return;

    const grid = document.getElementById('picx-image-grid');
    grid.innerHTML = '<div class="empty-state"><p>加载中...</p></div>';

    try {
      const result = await picxManager.listImages(path);
      
      if (result.success && result.images.length > 0) {
        grid.innerHTML = '';
        result.images.forEach(img => {
          const item = createImageItem(img);
          grid.appendChild(item);
        });
      } else {
        grid.innerHTML = '<div class="empty-state"><p>暂无图片</p><p class="hint">请先上传图片</p></div>';
      }
    } catch (error) {
      grid.innerHTML = '<div class="empty-state"><p>加载失败</p><p class="hint">' + error.message + '</p></div>';
    }
  }

  // 创建图片项
  function createImageItem(img) {
    const item = document.createElement('div');
    item.className = 'picx-image-item';
    item.innerHTML = `
      <div class="picx-image-thumb">
        <img src="${img.url}" alt="${img.name}" loading="lazy">
      </div>
      <div class="picx-image-info">
        <div class="picx-image-name" title="${img.name}">${img.name}</div>
        <div class="picx-image-size">${formatSize(img.size)}</div>
      </div>
      <div class="picx-image-actions">
        <button class="picx-image-action-btn" title="查看详情">👁</button>
        <button class="picx-image-action-btn" title="复制链接">🔗</button>
      </div>
    `;

    // 查看详情
    item.querySelector('[title="查看详情"]').addEventListener('click', (e) => {
      e.stopPropagation();
      showImageDetail(img);
    });

    // 复制链接
    item.querySelector('[title="复制链接"]').addEventListener('click', (e) => {
      e.stopPropagation();
      copyToClipboard(img.url).then(() => {
        showNotification('链接已复制');
      }).catch(() => {
        showNotification('复制失败', 'error');
      });
    });

    // 点击显示详情
    item.addEventListener('click', () => showImageDetail(img));

    return item;
  }

  // 显示图片详情
  function showImageDetail(img) {
    currentImage = img;
    
    document.getElementById('picx-image-title').textContent = img.name;
    document.getElementById('picx-image-preview').src = img.url;
    document.getElementById('picx-image-name').textContent = img.name;
    document.getElementById('picx-image-path').textContent = img.path;
    document.getElementById('picx-image-size').textContent = formatSize(img.size);
    
    // 生成各种链接
    const rawUrl = img.url;
    const jsdelivrUrl = picxManager.generateJsdelivrUrl(img.path);
    const markdown = `![${img.name}](${rawUrl})`;
    const html = `<img src="${rawUrl}" alt="${img.name}" />`;
    
    document.getElementById('picx-image-url').value = rawUrl;
    document.getElementById('picx-image-jsdelivr').value = jsdelivrUrl;
    document.getElementById('picx-image-markdown').value = markdown;
    document.getElementById('picx-image-html').value = html;
    
    // CDN 加速链接
    const cdnRow = document.getElementById('picx-image-cdn-row');
    const cdnInput = document.getElementById('picx-image-cdn');
    if (cdnRow && cdnInput) {
      if (picxManager.cdnType !== 'github') {
        cdnRow.style.display = 'flex';
        cdnInput.value = rawUrl; // 已经是加速链接
      } else {
        cdnRow.style.display = 'flex';
        cdnInput.value = jsdelivrUrl;
      }
    }
    
    document.getElementById('picx-image-modal').classList.add('active');
  }

  // 删除当前图片
  async function deleteCurrentImage() {
    if (!currentImage || !picxManager) return;
    
    if (!confirm('确定要删除这张图片吗？')) return;
    
    try {
      const result = await picxManager.deleteImage(currentImage.path);
      if (result.success) {
        showNotification('图片已删除');
        document.getElementById('picx-image-modal').classList.remove('active');
        loadImages(currentPath);
      } else {
        showNotification('删除失败: ' + result.message, 'error');
      }
    } catch (error) {
      showNotification('删除失败: ' + error.message, 'error');
    }
  }

  // 复制链接
  function copyImageLink(type) {
    const input = document.getElementById(`picx-image-${type}`);
    if (input) {
      copyToClipboard(input.value).then(() => {
        showNotification('链接已复制');
      }).catch(() => {
        showNotification('复制失败', 'error');
      });
    }
  }

  // 处理拖拽
  function handleDragOver(e) {
    e.preventDefault();
    e.currentTarget.classList.add('dragover');
  }

  function handleDragLeave(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('dragover');
  }

  function handleDrop(e) {
    e.preventDefault();
    e.currentTarget.classList.remove('dragover');
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    if (files.length > 0) {
      uploadFiles(files);
    }
  }

  // 处理文件选择
  function handleFileSelect(e) {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      uploadFiles(files);
    }
  }

  // 上传文件
  async function uploadFiles(files) {
    if (!picxManager) {
      showNotification('请先配置图床信息', 'error');
      return;
    }

    // 显示上传配置对话框
    showUploadConfigDialog(files);
  }

  // 显示上传配置对话框
  function showUploadConfigDialog(files) {
    const modal = document.getElementById('picx-upload-config-modal');
    if (!modal) return;

    // 获取默认配置
    const defaultConfig = window.picxDefaultConfig || {};
    
    // 填充默认值
    document.getElementById('upload-config-path').value = defaultConfig.uploadPath || '';
    document.getElementById('upload-config-auto-date').checked = defaultConfig.autoDateDir || false;
    document.getElementById('upload-config-convert-webp').checked = defaultConfig.convertWebp !== false;
    
    // 显示文件列表
    const fileList = document.getElementById('upload-config-file-list');
    fileList.innerHTML = files.map((file, index) => `
      <div class="upload-file-item" data-index="${index}">
        <div class="file-preview">
          <img src="${URL.createObjectURL(file)}" alt="${file.name}">
        </div>
        <div class="file-info">
          <div class="file-name">${file.name}</div>
          <div class="file-size">${formatSize(file.size)}</div>
          <div class="file-rename">
            <input type="text" class="rename-input" placeholder="留空使用原文件名" data-index="${index}">
            <button class="btn btn-small hash-name-btn" data-index="${index}">哈希</button>
          </div>
        </div>
      </div>
    `).join('');

    // 绑定哈希按钮事件
    fileList.querySelectorAll('.hash-name-btn').forEach(btn => {
      btn.addEventListener('click', async function() {
        const index = parseInt(this.dataset.index);
        const file = files[index];
        const hash = await generateHash(file);
        const ext = file.name.split('.').pop();
        const renameInput = fileList.querySelector(`.rename-input[data-index="${index}"]`);
        renameInput.value = `${hash}.${ext}`;
      });
    });

    // 加载已有目录到 datalist
    loadDirOptions();

    // 显示对话框
    modal.classList.add('active');

    // 绑定确认/取消按钮
    const confirmBtn = document.getElementById('upload-config-confirm');
    const cancelBtn = document.getElementById('upload-config-cancel');

    confirmBtn.onclick = async () => {
      modal.classList.remove('active');
      
      // 获取用户配置
      const uploadPath = document.getElementById('upload-config-path').value;
      const autoDateDir = document.getElementById('upload-config-auto-date').checked;
      const convertToWebp = document.getElementById('upload-config-convert-webp').checked;
      
      // 收集每个文件的重命名
      const renamedFiles = files.map((file, index) => {
        const renameInput = fileList.querySelector(`.rename-input[data-index="${index}"]`);
        const newName = renameInput.value.trim();
        return {
          file: file,
          newName: newName || null
        };
      });

      // 执行上传
      await executeUpload(renamedFiles, {
        path: uploadPath,
        autoDateDir: autoDateDir,
        convertToWebp: convertToWebp
      });
    };

    cancelBtn.onclick = () => {
      modal.classList.remove('active');
    };
  }

  // 执行上传
  async function executeUpload(renamedFiles, config) {
    const progressDiv = document.getElementById('picx-upload-progress');
    const progressFill = document.getElementById('picx-progress-fill');
    const progressText = document.getElementById('picx-progress-text');
    
    progressDiv.style.display = 'block';
    
    const uploadResults = [];
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < renamedFiles.length; i++) {
      const { file, newName } = renamedFiles[i];
      const progress = ((i + 1) / renamedFiles.length) * 100;
      
      progressFill.style.width = progress + '%';
      progressText.textContent = `上传中 ${i + 1}/${renamedFiles.length}: ${file.name}`;

      try {
        const options = {
          path: config.path,
          autoDateDir: config.autoDateDir,
          convertToWebp: config.convertToWebp,
          filename: newName
        };

        const result = await picxManager.uploadImage(file, options);
        if (result.success) {
          successCount++;
          uploadResults.push({
            success: true,
            filename: newName || file.name,
            url: result.url,
            path: result.path
          });
        } else {
          failCount++;
          uploadResults.push({
            success: false,
            filename: newName || file.name,
            error: result.message
          });
          console.error('上传失败:', result.message);
        }
      } catch (error) {
        failCount++;
        uploadResults.push({
          success: false,
          filename: newName || file.name,
          error: error.message
        });
        console.error('上传失败:', error);
      }
    }

    progressText.textContent = `上传完成: 成功 ${successCount} 张, 失败 ${failCount} 张`;
    
    setTimeout(() => {
      progressDiv.style.display = 'none';
      progressFill.style.width = '0%';
      
      // 显示上传结果
      if (uploadResults.length > 0) {
        showUploadResults(uploadResults);
      }
    }, 1500);

    // 刷新图片列表
    loadImages(currentPath);
    
    if (successCount > 0) {
      showNotification(`成功上传 ${successCount} 张图片`);
    }
  }

  // 显示上传结果
  function showUploadResults(results) {
    const modal = document.getElementById('picx-upload-result-modal');
    const listDiv = document.getElementById('upload-result-list');
    
    listDiv.innerHTML = results.map(result => {
      if (result.success) {
        const markdown = `![${result.filename}](${result.url})`;
        return `
          <div class="upload-result-item success">
            <div class="result-header">
              <span class="result-icon">✓</span>
              <span class="result-filename">${result.filename}</span>
            </div>
            <div class="result-links">
              <div class="link-row">
                <label>URL:</label>
                <input type="text" value="${result.url}" readonly onclick="this.select()">
                <button class="btn btn-small copy-btn" data-text="${result.url}">复制</button>
              </div>
              <div class="link-row">
                <label>Markdown:</label>
                <input type="text" value="${markdown.replace(/"/g, '&quot;')}" readonly onclick="this.select()">
                <button class="btn btn-small copy-btn" data-text="${markdown.replace(/"/g, '&quot;')}">复制</button>
              </div>
            </div>
          </div>
        `;
      } else {
        return `
          <div class="upload-result-item failed">
            <div class="result-header">
              <span class="result-icon">✗</span>
              <span class="result-filename">${result.filename}</span>
            </div>
            <div class="result-error">失败: ${result.error}</div>
          </div>
        `;
      }
    }).join('');
    
    // 绑定复制按钮事件
    listDiv.querySelectorAll('.copy-btn').forEach(btn => {
      btn.addEventListener('click', function() {
        const text = this.dataset.text;
        copyToClipboard(text).then(() => {
          showNotification('已复制到剪贴板');
        }).catch(() => {
          showNotification('复制失败', 'error');
        });
      });
    });
    
    modal.classList.add('active');
    
    // 绑定关闭事件
    document.getElementById('upload-result-close').onclick = () => modal.classList.remove('active');
    document.getElementById('upload-result-close-btn').onclick = () => modal.classList.remove('active');
  }

  // 生成文件哈希
  async function generateHash(file) {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex.substring(0, 12);
  }

  // 加载快捷目录
  function loadQuickDirs() {
    chrome.storage.sync.get({ picxQuickDirs: ['images', 'blog', 'screenshots', 'icons'] }, function(config) {
      renderQuickDirs(config.picxQuickDirs);
    });
  }

  // 渲染快捷目录
  function renderQuickDirs(dirs) {
    // 快捷目录功能已移至上传配置对话框中
    // 这里可以保留用于其他用途
  }

  // 加载目录选项到 datalist
  async function loadDirOptions() {
    if (!picxManager) return;
    
    const datalist = document.getElementById('upload-dir-list');
    if (!datalist) return;
    
    try {
      // 递归获取所有目录
      const allDirs = [];
      await collectDirectories('', allDirs, 0);
      
      // 填充 datalist
      datalist.innerHTML = allDirs.map(dir => `<option value="${dir}">`).join('');
    } catch (error) {
      console.error('加载目录失败:', error);
    }
  }

  // 递归收集目录
  async function collectDirectories(path, allDirs, depth) {
    if (depth > 3) return; // 限制深度避免过多请求
    
    try {
      const result = await picxManager.listDirectories(path);
      if (result.success && result.directories.length > 0) {
        for (const dir of result.directories) {
          allDirs.push(dir.path);
          await collectDirectories(dir.path, allDirs, depth + 1);
        }
      }
    } catch (error) {
      console.error('加载目录失败:', path, error);
    }
  }

  // 格式化文件大小
  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  // 显示通知
  function showNotification(message, type = 'success') {
    const n = document.createElement('div');
    n.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 20px;
      background: ${type === 'error' ? '#f44336' : '#4CAF50'};
      color: white;
      border-radius: 4px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      z-index: 10000;
      font-size: 13px;
    `;
    n.textContent = message;
    document.body.appendChild(n);
    setTimeout(() => n.remove(), 3000);
  }

  // 页面加载完成后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
