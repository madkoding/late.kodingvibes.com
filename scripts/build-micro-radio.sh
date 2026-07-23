#!/usr/bin/env bash
# Build late-micro-radio and rsync to /var/www/html/micro/radio/vX.Y.Z/
# Idempotent: re-running rebuilds and replaces.
set -euo pipefail

REPO="/root/late-micro-radio"
DEST="/var/www/html/micro/radio"

export PATH="/root/.nvm/versions/node/v24.18.0/bin:$PATH"

cd "$REPO"

VERSION=$(node -e "console.log(require('./package.json').version)")
echo "[build-micro-radio] version=$VERSION"

# Skip git pull: this host has the repo as a working tree. If you ever move
# the build to CI, uncomment the pull.
# git pull --ff-only

if [ ! -d node_modules ]; then
  npm install --no-audit --no-fund
fi

npm run build

rm -rf "$DEST/v$VERSION"
mkdir -p "$DEST/v$VERSION"
rsync -a --delete dist/ "$DEST/v$VERSION/"

# Update the "latest" symlink so the shell can reference it without a version.
ln -sfn "v$VERSION" "$DEST/latest"

echo "[build-micro-radio] deployed to $DEST/v$VERSION"
