#!/bin/zsh
set -e
cd -- "$(dirname "$0")"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if [[ ! -d node_modules ]]; then npm ci; fi
if [[ ! -f .env ]]; then cp .env.example .env; fi
if [[ ! -f dist/index.html ]]; then npm run build; fi
echo 'Little Elsewhere lives at http://127.0.0.1:3000'
echo 'Keep this window open to let the town run. Control-C stops it safely.'
npm start
