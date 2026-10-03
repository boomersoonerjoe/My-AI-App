#!/bin/zsh
set -eu
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
# Use an installed Node first, with the Codex bundled runtime as a local fallback.
if ! command -v node >/dev/null; then
  NODE_DIR="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin"
  export PATH="$NODE_DIR:$PATH"
fi
cd "$PROJECT_DIR/web"
if [[ ! -f node_modules/vite/bin/vite.js || ! -f dist/index.html ]]; then
  print -u2 'Build the web client first; see docs/MAC-LOCAL-AI.md.'
  exit 1
fi
exec node scripts/server.mjs
