#!/usr/bin/env bash
# Restart chat-bridge on the host (no Docker).
# Idempotent: re-runs pip install and restarts the systemd service.
set -euo pipefail

REPO="/root/late.kodingvibes.com"
APP_DIR="$REPO/services/chat-bridge"
VENV_DIR="/opt/chat-bridge/venv"
ENV_FILE="/root/.env.backup"
SERVICE="chat-bridge"
HOST="127.0.0.1"
PORT="9100"

log() { echo "[restart-chat-bridge] $*"; }

log "ensuring venv at $VENV_DIR"
python3 -m venv "$VENV_DIR" 2>/dev/null || true
source "$VENV_DIR/bin/activate"

log "updating dependencies"
pip install --quiet --upgrade pip
pip install --quiet -r "$APP_DIR/requirements.txt"

log "ensuring data and attachment directories"
mkdir -p /data/chat-bridge
mkdir -p /var/lib/late-attachments

log "restarting service $SERVICE"
if systemctl is-active --quiet "$SERVICE" 2>/dev/null; then
  systemctl restart "$SERVICE"
else
  systemctl start "$SERVICE"
fi

# Give uvicorn a moment to bind before the health probe.
sleep 1

log "waiting for /api/chat/unfurl to respond"
for i in {1..30}; do
  if curl -fsS "http://$HOST:$PORT/api/chat/unfurl?url=https://example.com" >/dev/null 2>&1; then
    log "unfurl endpoint is healthy"
    exit 0
  fi
  sleep 1
done

log "ERROR: /api/chat/unfurl did not become healthy within 30s"
exit 1
