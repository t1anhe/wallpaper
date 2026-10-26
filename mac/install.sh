#!/bin/bash
# One-line install for the Wallpaper menu bar app:
#   curl -fsSL https://raw.githubusercontent.com/t1anhe/wallpaper/claude/affectionate-hamilton-in1kmo/mac/install.sh | bash
# Downloads the latest build, puts it in /Applications (replacing the older LiveWall if present) and opens it.
set -euo pipefail

URL="https://github.com/t1anhe/wallpaper/releases/download/mac-latest/Wallpaper.zip"
DEST="/Applications"
[ -w "$DEST" ] || DEST="$HOME/Applications"
mkdir -p "$DEST"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "→ 下载 Wallpaper…"
curl -fL --progress-bar "$URL" -o "$TMP/Wallpaper.zip"
ditto -x -k "$TMP/Wallpaper.zip" "$TMP"

# Quit running copies (including the app's old name) before replacing them
pkill -x Wallpaper 2>/dev/null || true
pkill -x LiveWall 2>/dev/null || true
sleep 1
rm -rf "$DEST/Wallpaper.app" "$DEST/LiveWall.app"
mv "$TMP/Wallpaper.app" "$DEST/Wallpaper.app"
# Downloaded with curl, so there is no quarantine flag; clear it anyway in case of an older copy
xattr -dr com.apple.quarantine "$DEST/Wallpaper.app" 2>/dev/null || true

open "$DEST/Wallpaper.app"
echo "✓ 已安装到 $DEST/Wallpaper.app，菜单栏会出现 ✦ 图标。壁纸文件夹：~/Wallpaper"
