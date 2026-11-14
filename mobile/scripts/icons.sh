#!/usr/bin/env bash
# Renders the app icons from scripts/icon.html. Run from mobile/:  bash scripts/icons.sh
set -e
CHROME="${CHROME:-/c/Program Files/Google/Chrome/Application/chrome.exe}"
PAGE="file:///$(pwd -W 2>/dev/null || pwd)/scripts/icon.html"
shot() { "$CHROME" --headless=new --disable-gpu --hide-scrollbars --default-background-color=00000000 --window-size=1024,1024 --virtual-time-budget=4000 --screenshot="$(pwd -W 2>/dev/null || pwd)/assets/$2" "$PAGE?v=$1" >/dev/null 2>&1; echo "wrote assets/$2"; }
shot icon icon.png
shot icon favicon.png
shot fg android-icon-foreground.png
shot mono android-icon-monochrome.png
shot splash splash-icon.png
