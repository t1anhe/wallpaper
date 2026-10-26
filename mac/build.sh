#!/bin/bash
# Build LiveWall.app (universal, ad-hoc signed) and zip it. Runs on macOS with the Xcode command line tools.
#   VERSION=12 bash mac/build.sh   ->  build/LiveWall.app, build/LiveWall.zip
set -euo pipefail
cd "$(dirname "$0")/.."

VERSION="${VERSION:-1}"
APP=build/LiveWall.app
rm -rf build
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources/Wallpapers/images"

for arch in arm64 x86_64; do
  swiftc -O -target "$arch-apple-macos12.0" -o "build/LiveWall-$arch" mac/main.swift \
    -framework Cocoa -framework WebKit -framework AVFoundation -framework ServiceManagement
done
lipo -create -output "$APP/Contents/MacOS/LiveWall" build/LiveWall-arm64 build/LiveWall-x86_64
sed "s/__VERSION__/$VERSION/g" mac/Info.plist > "$APP/Contents/Info.plist"

# App icon from the 1024px source
mkdir -p build/AppIcon.iconset
for s in 16 32 128 256 512; do
  sips -z $s $s mac/icon.png --out "build/AppIcon.iconset/icon_${s}x${s}.png" >/dev/null
  sips -z $((s * 2)) $((s * 2)) mac/icon.png --out "build/AppIcon.iconset/icon_${s}x${s}@2x.png" >/dev/null
done
iconutil -c icns build/AppIcon.iconset -o "$APP/Contents/Resources/AppIcon.icns"

# Bundled wallpapers: the live pages with their shared scripts, plus the static set
cp -R lib live "$APP/Contents/Resources/Wallpapers/"
for f in output/static/*-desktop.jpg; do
  cp "$f" "$APP/Contents/Resources/Wallpapers/images/$(basename "$f" -desktop.jpg).jpg"
done

codesign --force --deep --sign - "$APP"
(cd build && ditto -c -k --keepParent LiveWall.app LiveWall.zip)
echo "Built $APP (version $VERSION)"
