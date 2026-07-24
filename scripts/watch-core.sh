#!/usr/bin/env bash
#
# Live-rebuild keyring-agent-core and sync its dist into THIS app's
# node_modules on every save — so editing the core repo is picked up by Metro
# without `npm publish` or reinstall.
#
# How it works: runs the core's `tsup --watch`; the core's tsup.config copies
# its freshly-built dist to $KEYRING_AGENT_SYNC_DIST after each build (guarded
# by that env var, so it never affects publish builds). The dist lands inside
# this app's node_modules, which Metro already watches, so it re-bundles.
#
# Usage (from the app root):  yarn watch:core
# Then run the app as usual (yarn ios / yarn android) and reload after a change.
#
# Override the core repo location with CORE_DIR=/path yarn watch:core
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CORE_DIR="${CORE_DIR:-$(cd "$APP_DIR/../keyring-agent-core" && pwd)}"
APP_DIST="$APP_DIR/node_modules/keyring-agent-core/dist"

if [ ! -d "$CORE_DIR" ]; then
  echo "✗ keyring-agent-core not found at: $CORE_DIR" >&2
  echo "  Set CORE_DIR=/absolute/path/to/keyring-agent-core and retry." >&2
  exit 1
fi

echo "▶ Watching core : $CORE_DIR"
echo "▶ Syncing dist → : $APP_DIST"
echo "  (edit core source → saves rebuild + sync; reload the app to pick up)"

cd "$CORE_DIR"
KEYRING_AGENT_SYNC_DIST="$APP_DIST" exec yarn dev
