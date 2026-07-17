#!/bin/sh
# Node was installed locally to ~/.local/node (no Homebrew on this machine).
export PATH="$HOME/.local/node/bin:$PATH"
cd "$(dirname "$0")"
exec ./node_modules/.bin/next dev "$@"
