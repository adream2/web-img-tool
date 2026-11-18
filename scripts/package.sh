#!/usr/bin/env bash
# 打包用于商店上传的 zip（只含扩展运行时文件，manifest.json 在根目录）
#
# 用法：
#   bash scripts/package.sh              # 输出到 dist/
#   bash scripts/package.sh ~/Desktop    # 输出到指定目录
#
# 版本号取自 manifest.json，改版本只改 manifest.json。

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT_DIR="${1:-$ROOT/dist}"
mkdir -p "$OUT_DIR"

PY_BIN="$(command -v python || command -v python3 || true)"
if [ -z "$PY_BIN" ]; then
  echo "✗ 需要 Python 3 来打包" >&2
  exit 1
fi

"$PY_BIN" - "$ROOT" "$OUT_DIR" <<'PY'
import json, os, sys, zipfile, hashlib

root, out_dir = sys.argv[1], sys.argv[2]

manifest = json.load(open(os.path.join(root, 'manifest.json'), encoding='utf-8'))
version = manifest['version']

# 运行时必需文件：manifest 引用的 + 扩展页面本身的依赖
required = [
    'manifest.json',
    'background.js', 'content.js', 'common.js',
    'popup.html', 'popup.css', 'popup.js',
    'panel.html', 'panel.css',
    'picx.html', 'picx.js', 'picx.css', 'picx-panel.js',
]
icons = sorted(f for f in os.listdir(os.path.join(root, 'icons')) if f.endswith('.png'))
files = required + ['icons/' + f for f in icons]

missing = [f for f in files if not os.path.exists(os.path.join(root, f))]
if missing:
    raise SystemExit('缺少文件: ' + ', '.join(missing))

out = os.path.join(out_dir, 'web-image-tool-pro-%s.zip' % version)
with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
    for f in files:
        z.write(os.path.join(root, f), f)

with zipfile.ZipFile(out) as z:
    names = z.namelist()
    bad = z.testzip()
    packed = json.loads(z.read('manifest.json').decode('utf-8'))

# 自检
need = {packed['background']['service_worker']} | set(packed['content_scripts'][0]['js']) | set(packed['icons'].values())
assert not bad, 'zip 校验失败: ' + str(bad)
assert 'manifest.json' in names, 'manifest.json 不在根目录'
assert not (need - set(names)), 'manifest 引用缺失: %s' % (need - set(names))
assert not any(n.startswith(('.git', 'docs/', 'promo/', '.workbuddy', 'node_modules')) for n in names), '混入了非运行时文件'

size = os.path.getsize(out)
sha = hashlib.sha256(open(out, 'rb').read()).hexdigest()

print('✓ %s' % out)
print('  版本      %s' % version)
print('  文件数    %d' % len(names))
print('  体积      %.1f KB' % (size / 1024))
print('  SHA256    %s' % sha)
print('  内容      %s' % ', '.join(names))
PY
