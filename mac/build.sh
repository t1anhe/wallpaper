#!/bin/bash
# Build Wallpaper.app (universal, ad-hoc signed) and zip it. Runs on macOS with the Xcode command line tools.
#   VERSION=12 bash mac/build.sh   ->  build/Wallpaper.app, build/Wallpaper.zip
set -euo pipefail
cd "$(dirname "$0")/.."

VERSION="${VERSION:-1}"
APP=build/Wallpaper.app
rm -rf build
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources/Wallpapers"

for arch in arm64 x86_64; do
  swiftc -O -target "$arch-apple-macos12.0" -o "build/Wallpaper-$arch" mac/main.swift \
    -framework Cocoa -framework WebKit -framework AVFoundation -framework ServiceManagement
done
lipo -create -output "$APP/Contents/MacOS/Wallpaper" build/Wallpaper-arm64 build/Wallpaper-x86_64
sed "s/__VERSION__/$VERSION/g" mac/Info.plist > "$APP/Contents/Info.plist"

# App icon from the 1024px source
mkdir -p build/AppIcon.iconset
for s in 16 32 128 256 512; do
  sips -z $s $s mac/icon.png --out "build/AppIcon.iconset/icon_${s}x${s}.png" >/dev/null
  sips -z $((s * 2)) $((s * 2)) mac/icon.png --out "build/AppIcon.iconset/icon_${s}x${s}@2x.png" >/dev/null
done
iconutil -c icns build/AppIcon.iconset -o "$APP/Contents/Resources/AppIcon.icns"

# Bundled wallpapers: the live pages with their shared scripts (each names its category), plus the
# static set in ASCII, filed in folders named after their categories
cp -R lib live "$APP/Contents/Resources/Wallpapers/"
for pair in aurora:Nature dunes:Nature bauhaus:Abstract silk:Abstract topography:Abstract; do
  name=${pair%%:*} folder=${pair#*:}
  mkdir -p "$APP/Contents/Resources/Wallpapers/$folder"
  cp "output/static/ascii/$name-desktop.jpg" "$APP/Contents/Resources/Wallpapers/$folder/$name.jpg"
done

codesign --force --deep --sign - "$APP"
(cd build && ditto -c -k --keepParent Wallpaper.app Wallpaper.zip)
echo "Built $APP (version $VERSION)"
