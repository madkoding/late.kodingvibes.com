#!/usr/bin/env bash
# Build late-micro-chat and rsync to /var/www/html/micro/chat/vX.Y.Z/
set -euo pipefail

REPO="/root/late-micro-chat"
DEST="/var/www/html/micro/chat"

export PATH="/root/.nvm/versions/node/v24.18.0/bin:$PATH"

cd "$REPO"

VERSION=$(node -e "console.log(require('./package.json').version)")
echo "[build-micro-chat] version=$VERSION"

if [ ! -d node_modules ]; then
  npm install --no-audit --no-fund
fi

npm run build

rm -rf "$DEST/v$VERSION"
mkdir -p "$DEST/v$VERSION"
rsync -a --delete dist/ "$DEST/v$VERSION/"

ln -sfn "v$VERSION" "$DEST/latest"

echo "[build-micro-chat] deployed to $DEST/v$VERSION"
