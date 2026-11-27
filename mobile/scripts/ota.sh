#!/usr/bin/env bash
# ONE PUBLISH, EVERY PHONE THAT MAY HAVE IT (owner, 2026-11-27: "Make sure
# that the Android build gets the latest. Always has the latest code, same
# as the Apple build").
#
#   1. preview, both platforms: his iPhone and the internal Android build;
#   2. production, Android only: the build the Play testers install.
#
# Never production for iOS: that channel holds the build App Review is
# testing (owner, 2026-11-24: "We shouldn't update the version the reviewer
# has"). Run from mobile/ on a clean checkout of main, one at a time.
#
#   bash scripts/ota.sh "What changed"
set -euo pipefail
msg="${1:?say what changed}"
cd "$(dirname "$0")/.."
npx eas-cli@latest update --channel preview --environment preview --message "$msg" --non-interactive
npx eas-cli@latest update --channel production --platform android --environment production --message "$msg" --non-interactive
