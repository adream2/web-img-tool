#!/usr/bin/env bash
# 从 SVG 源生成所有 PNG 资源，保证图标一律以 icons/icon.svg 为准。
#
# 用法：
#   bash scripts/build-assets.sh
#
# 实现要点：
#   · 直接把 .svg 当文档打开时，浏览器按固有尺寸渲染，视口更小会被裁剪（小图标会糊/裁边）；
#     所以把 SVG 内联进一个强制铺满视口的 HTML 再截图。
#   · 无头浏览器在窗口过小时会截出空白，因此统一按大尺寸（1024/600/880）渲染，再用 LANCZOS 降采样。
#   · 渲染器优先级：Edge/Chrome > rsvg-convert > inkscape > ImageMagick。
#
# 只改 SVG 后重跑本脚本，不要手工改 PNG。

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP="$ROOT/.workbuddy/tmp/render"
mkdir -p "$TMP"
rm -rf "$TMP"/p[0-9]* 2>/dev/null || true

# ---------- 环境探测 ----------

find_browser() {
  local candidates=(
    "/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe"
    "/c/Program Files/Microsoft/Edge/Application/msedge.exe"
    "/c/Program Files/Google/Chrome/Application/chrome.exe"
    "/c/Program Files (x86)/Google/Chrome/Application/chrome.exe"
    "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
  )
  local c
  for c in "${candidates[@]}"; do
    [ -x "$c" ] && { printf '%s' "$c"; return 0; }
  done
  for c in microsoft-edge google-chrome chromium chromium-browser; do
    if command -v "$c" >/dev/null 2>&1; then command -v "$c"; return 0; fi
  done
  return 1
}

to_file_url() {
  local p="$1"
  if command -v cygpath >/dev/null 2>&1; then p="$(cygpath -m "$p")"; fi
  printf 'file:///%s' "${p#/}"
}

to_native_path() {
  local p="$1"
  if command -v cygpath >/dev/null 2>&1; then cygpath -w "$p"; else printf '%s' "$p"; fi
}

BROWSER_BIN="$(find_browser || true)"

PY_BIN="$(command -v python || command -v python3 || true)"
HAS_PIL=0
if [ -n "$PY_BIN" ] && "$PY_BIN" -c "import PIL" >/dev/null 2>&1; then HAS_PIL=1; fi

# ---------- 渲染 ----------

make_wrapper() {
  local svg="$1" out="$2"
  {
    printf '%s' '<!doctype html><html><head><meta charset="utf-8"><style>'
    printf '%s' 'html,body{margin:0;padding:0;background:transparent;overflow:hidden}'
    printf '%s' 'body>svg{width:100vw;height:100vh;display:block}'
    printf '%s' '</style></head><body>'
    cat "$svg"
    printf '%s' '</body></html>'
  } > "$out"
}

shoot() {
  local html="$1" w="$2" h="$3" out="$4"
  local url outpath profile
  url="$(to_file_url "$html")"
  outpath="$(to_native_path "$out")"
  profile="$(to_native_path "$TMP/p$RANDOM$RANDOM")"

  rm -f "$out"
  "$BROWSER_BIN" \
    --headless=new --disable-gpu --hide-scrollbars --no-first-run --no-default-browser-check \
    --force-device-scale-factor=1 \
    --default-background-color=00000000 \
    --screenshot="$outpath" \
    --window-size="$w,$h" \
    --user-data-dir="$profile" \
    "$url" >/dev/null 2>&1 || true

  # 等文件落盘（浏览器是异步写出的）
  local i=0
  while [ "$i" -lt 60 ]; do
    [ -s "$out" ] && return 0
    sleep 0.2
    i=$((i + 1))
  done
  echo "✗ 截图超时：$out" >&2
  return 1
}

downscale() {
  local src="$1" out="$2" w="$3" h="$4"
  "$PY_BIN" - "$src" "$out" "$w" "$h" <<'PY'
import sys
from PIL import Image
src, out, w, h = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4])
im = Image.open(src).convert('RGBA')
if im.getbbox() is None:
    raise SystemExit('渲染结果为空')
# BOX（区域平均）不产生 LANCZOS 振铃，扁平矢量图形降采样后边缘最干净
im.resize((w, h), Image.BOX).save(out, optimize=True)
PY
}

# emit <svg> <目标宽> <目标高> <输出>
emit() {
  local svg="$1" w="$2" h="$3" out="$4"

  if [ -n "$BROWSER_BIN" ] && [ "$HAS_PIL" = "1" ]; then
    # 先按 2 倍（且不小于 600）渲染，再降采样
    local base_w=$(( w * 2 ))
    [ "$base_w" -lt 600 ] && base_w=600
    # 高度必须按比例算，不能单独抬到某个下限，否则视口比例与 SVG 不一致会出现上下留白
    local base_h=$(( base_w * h / w ))

    make_wrapper "$svg" "$TMP/wrap.html"
    shoot "$TMP/wrap.html" "$base_w" "$base_h" "$TMP/base.png"
    downscale "$TMP/base.png" "$out" "$w" "$h"

  elif [ -n "$BROWSER_BIN" ]; then
    make_wrapper "$svg" "$TMP/wrap.html"
    [ "$w" -lt 128 ] || [ "$h" -lt 128 ] && \
      echo "   ! 未安装 Python/Pillow，小尺寸可能被窗口最小尺寸影响（pip install pillow）" >&2
    shoot "$TMP/wrap.html" "$w" "$h" "$out"

  elif command -v rsvg-convert >/dev/null 2>&1; then
    rsvg-convert -w "$w" -h "$h" -o "$out" "$svg"

  elif command -v inkscape >/dev/null 2>&1; then
    inkscape "$svg" -w "$w" -h "$h" -o "$out" >/dev/null 2>&1

  elif command -v magick >/dev/null 2>&1; then
    magick -background none "$svg" -resize "${w}x${h}!" "$out"

  else
    echo "✗ 找不到渲染器：请安装 Edge/Chrome（+ Python Pillow），或 rsvg-convert / inkscape / ImageMagick" >&2
    exit 1
  fi

  [ -s "$out" ] || { echo "✗ 渲染失败：$out" >&2; exit 1; }
}

rm -rf "$TMP"/p[0-9]* 2>/dev/null || true

echo "→ 扩展图标（来源 icons/icon.svg）"
# 一次大图渲染，降采样出多个尺寸，保证四个尺寸完全同源
if [ -n "$BROWSER_BIN" ] && [ "$HAS_PIL" = "1" ]; then
  make_wrapper "$ROOT/icons/icon.svg" "$TMP/wrap-icon.html"
  shoot "$TMP/wrap-icon.html" 1024 1024 "$TMP/icon-base.png"
  for size in 16 32 48 128; do
    downscale "$TMP/icon-base.png" "$ROOT/icons/icon${size}.png" "$size" "$size"
    echo "   icons/icon${size}.png"
  done
else
  for size in 16 32 48 128; do
    emit "$ROOT/icons/icon.svg" "$size" "$size" "$ROOT/icons/icon${size}.png"
    echo "   icons/icon${size}.png"
  done
fi

echo "→ 商店素材"
emit "$ROOT/promo/store-logo.svg" 300 300 "$ROOT/promo/store-logo-300.png"
echo "   promo/store-logo-300.png"
emit "$ROOT/promo/store-tile.svg" 440 280 "$ROOT/promo/store-tile-440x280.png"
echo "   promo/store-tile-440x280.png"

echo "✓ 完成，校验："
if [ "$HAS_PIL" = "1" ]; then
  "$PY_BIN" - "$ROOT" <<'PY'
import sys, pathlib
from PIL import Image
root = pathlib.Path(sys.argv[1])
files = sorted(root.joinpath('icons').glob('*.png')) + sorted(root.joinpath('promo').glob('*.png'))
for f in files:
    im = Image.open(f).convert('RGBA')
    bbox = im.getbbox()
    warn = ''
    if bbox is None:
        warn = '  ← 全透明，异常'
    elif im.width == im.height and (bbox[0] > im.width * 0.2 or bbox[2] < im.width * 0.8):
        warn = '  ← 内容过小，疑似未铺满'
    print(f"   {f.relative_to(root)}  {im.size[0]}×{im.size[1]}  bbox={bbox}{warn}")
PY
fi
