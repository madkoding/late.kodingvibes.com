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

# Write latest.json so the shell's UpdateNotice can detect an upgrade while
# the user is already on the page. Cache-Control: no-cache; tiny payload.
cat > "$DEST/latest.json" <<EOF
{"version":"$VERSION","name":"chat"}
EOF

echo "[build-micro-chat] deployed to $DEST/v$VERSION"
