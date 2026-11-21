#!/usr/bin/env bash
# The app's web build, onto the site at /row100k/app/index.html.
#
# A preview for a phone that cannot install a build yet: the same screens,
# the demo row, no Bluetooth on an iPhone. Unlisted (noindex), linked only
# from the Development group of the account menu.
#
#   npm run export:web        (from mobile/)
#
# The base path is experiments.baseUrl in app.json. Expo writes the fonts
# under assets/node_modules/, a folder name git ignores, so that folder is
# renamed and the bundle is pointed at the new name.
set -euo pipefail
cd "$(dirname "$0")/.."
OUT=../public/row100k/app

rm -rf dist
# The build on the site talks to the site it is served from: no API address is
# baked in, whatever mobile/.env.local says on this machine.
EXPO_PUBLIC_API= npx expo export -p web

# Copied, then removed if it will go: with the app's dev server running,
# Windows holds the folder and refuses a rename.
cp -r dist/assets/node_modules dist/assets/nm
rm -rf dist/assets/node_modules 2>/dev/null || true
sed -i 's#assets/node_modules/#assets/nm/#g' dist/_expo/static/js/web/*.js
sed -i 's#<head>#<head><meta name="robots" content="noindex,nofollow">#' dist/index.html
rm -f dist/metadata.json

rm -rf "$OUT"
mkdir -p "$OUT"
cp -r dist/. "$OUT/"
rm -rf "$OUT/assets/node_modules" 2>/dev/null || true
echo "wrote $OUT"
