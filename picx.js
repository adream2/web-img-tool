// PicX 图床管理器 - 基于 GitHub API

class PicXManager {
  constructor(config) {
    this.token = config.token || '';
    this.owner = config.owner || '';
    this.repo = config.repo || 'picx-images-hosting';
    this.branch = config.branch || 'master';
    this.cdnType = config.cdnType || 'github'; // github, jsdelivr, staticaly, ghproxy, custom
    this.customCdn = config.customCdn || '';
    this.apiBase = 'https://api.github.com';
  }

  // CDN 链接生成规则
  static CDN_TEMPLATES = {
    github: 'https://raw.githubusercontent.com/{owner}/{repo}/{branch}/{path}',
    jsdelivr: 'https://cdn.jsdelivr.net/gh/{owner}/{repo}@{branch}/{path}',
    staticaly: 'https://cdn.staticaly.com/gh/{owner}/{repo}@{branch}/{path}',
    ghproxy: 'https://ghproxy.com/https://raw.githubusercontent.com/{owner}/{repo}/{branch}/{path}',
    i0wp: 'https://i0.wp.com/raw.githubusercontent.com/{owner}/{repo}/{branch}/{path}'
  };

  // 构建请求头
  getHeaders() {
    return {
      'Authorization': `token ${this.token}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'Web-Image-Tool-Pro'
    };
  }

  // 构建 API URL
  buildApiUrl(path = '') {
    const encodedPath = path ? encodeURIComponent(path).replace(/%2F/g, '/') : '';
    return `${this.apiBase}/repos/${this.owner}/${this.repo}/contents/${encodedPath}`;
  }

  // 测试连接
  async testConnection() {
    try {
      const url = this.buildApiUrl('');
      const response = await fetch(url, {
        headers: this.getHeaders()
      });
      if (!response.ok) {
        throw new Error(`连接失败: ${response.status} ${response.statusText}`);
      }
      return { success: true, message: '连接成功' };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  // 获取目录列表
  async listDirectories(path = '') {
    try {
      const url = this.buildApiUrl(path);
      const response = await fetch(url, {
        headers: this.getHeaders()
      });
      
      if (!response.ok) {
        throw new Error(`获取目录失败: ${response.status}`);
      }

      const items = await response.json();
      const directories = items
        .filter(item => item.type === 'dir')
        .map(item => ({
          name: item.name,
          path: item.path,
          sha: item.sha
        }));

      return { success: true, directories };
    } catch (error) {
      return { success: false, message: error.message, directories: [] };
    }
  }

  // 获取目录下的图片
  async listImages(path = '') {
    try {
      const url = this.buildApiUrl(path);
      const response = await fetch(url, {
        headers: this.getHeaders()
      });

      if (!response.ok) {
        throw new Error(`获取图片列表失败: ${response.status}`);
      }

      const items = await response.json();
      const images = items
        .filter(item => item.type === 'file' && this.isImageFile(item.name))
        .map(item => ({
          name: item.name,
          path: item.path,
          sha: item.sha,
          size: item.size,
          downloadUrl: item.download_url,
          url: this.generateImageUrl(item.path)
        }));

      return { success: true, images };
    } catch (error) {
      return { success: false, message: error.message, images: [] };
    }
  }

  // 判断是否为图片文件
  isImageFile(filename) {
    const ext = filename.split('.').pop().toLowerCase();
    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'ico', 'bmp', 'avif'].includes(ext);
  }

  // 上传图片
  async uploadImage(file, options = {}) {
    try {
      // 处理文件名
      let filename = options.filename || file.name;

      // 如果重命名后没有扩展名，从 MIME 类型自动补全
      if (filename && !filename.includes('.') && !filename.endsWith('.')) {
        const extMap = {
          'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
          'image/gif': 'gif', 'image/svg+xml': 'svg', 'image/bmp': 'bmp',
          'image/avif': 'avif', 'image/x-icon': 'ico'
        };
        filename += '.' + (extMap[file.type] || 'jpg');
      }

      if (options.hashName) {
        const hash = await this.generateHash(file);
        const ext = filename.split('.').pop();
        filename = `${hash}.${ext}`;
      }

      // 处理目录
      let uploadPath = options.path || '';
      if (options.autoDateDir) {
        const now = new Date();
        const datePath = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(2, '0')}`;
        uploadPath = uploadPath ? `${uploadPath}/${datePath}` : datePath;
      }

      // 转换图片格式（如果需要）
      let blob = file;
      if (options.convertToWebp && file.type !== 'image/webp') {
        blob = await this.convertToWebp(file, options.quality || 0.92);
        filename = filename.replace(/\.[^/.]+$/, '.webp');
      }

      // 转为 Base64
      const base64 = await this.blobToBase64(blob);
      const content = base64.split(',')[1];

      // 构建完整路径
      const fullPath = uploadPath ? `${uploadPath}/${filename}` : filename;

      // 上传到 GitHub
      const url = this.buildApiUrl(fullPath);
      const response = await fetch(url, {
        method: 'PUT',
        headers: this.getHeaders(),
        body: JSON.stringify({
          message: options.message || 'Upload image',
          content: content,
          branch: this.branch
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `上传失败: ${response.status}`);
      }

      const result = await response.json();
      return {
        success: true,
        path: fullPath,
        url: this.generateImageUrl(fullPath),
        sha: result.content.sha
      };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  // 删除图片
  async deleteImage(path) {
    try {
      const url = this.buildApiUrl(path);
      const response = await fetch(url, {
        method: 'DELETE',
        headers: this.getHeaders(),
        body: JSON.stringify({
          message: 'Delete image',
          sha: await this.getFileSha(path),
          branch: this.branch
        })
      });

      if (!response.ok) {
        throw new Error(`删除失败: ${response.status}`);
      }

      return { success: true };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  // 获取文件 SHA
  async getFileSha(path) {
    const url = this.buildApiUrl(path);
    const response = await fetch(url, { headers: this.getHeaders() });
    if (!response.ok) throw new Error('获取文件信息失败');
    const data = await response.json();
    return data.sha;
  }

  // 生成图片链接
  generateImageUrl(path) {
    if (this.cdnType === 'custom' && this.customCdn) {
      // 自定义加速链接
      return this.customCdn
        .replace(/\{owner\}/g, this.owner)
        .replace(/\{repo\}/g, this.repo)
        .replace(/\{branch\}/g, this.branch)
        .replace(/\{path\}/g, path);
    }
    
    // 使用预设的 CDN 模板
    const template = PicXManager.CDN_TEMPLATES[this.cdnType] || PicXManager.CDN_TEMPLATES.github;
    return template
      .replace(/\{owner\}/g, this.owner)
      .replace(/\{repo\}/g, this.repo)
      .replace(/\{branch\}/g, this.branch)
      .replace(/\{path\}/g, path);
  }

  // 生成 jsDelivr 加速链接
  generateJsdelivrUrl(path) {
    return `https://cdn.jsdelivr.net/gh/${this.owner}/${this.repo}@${this.branch}/${path}`;
  }

  // 生成 Markdown 链接
  generateMarkdownLink(path, alt = '') {
    const url = this.generateImageUrl(path);
    return `![${alt}](${url})`;
  }

  // 生成 HTML 链接
  generateHtmlLink(path, alt = '') {
    const url = this.generateImageUrl(path);
    return `<img src="${url}" alt="${alt}" />`;
  }

  // 转换为 WebP
  async convertToWebp(file, quality = 0.92) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        canvas.toBlob(blob => {
          if (blob) resolve(blob);
          else reject(new Error('转换失败'));
        }, 'image/webp', quality);
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }

  // Blob 转 Base64
  blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  }

  // 生成文件哈希
  async generateHash(file) {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex.substring(0, 12); // 使用 12 位哈希
  }
}

// 导出（如果在模块环境中）
if (typeof module !== 'undefined' && module.exports) {
  module.exports = PicXManager;
}
