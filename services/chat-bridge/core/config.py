import os

SSO_SECRET = os.environ["SSO_BRIDGE_SECRET"]
SQLITE_PATH = os.environ.get("SQLITE_PATH", "/data/chat-bridge.db")
KV_WEBHOOK_URL = os.environ.get("KV_WEBHOOK_URL", "")
KV_WEBHOOK_SECRET = os.environ.get("KV_WEBHOOK_SECRET", "")
SHARED_INTERNAL_SECRET = os.environ.get("SHARED_INTERNAL_SECRET", SSO_SECRET)

ATTACHMENT_DIR = os.environ.get("ATTACHMENT_DIR", "/var/lib/late-attachments")
MAX_ATTACHMENT_BYTES = int(os.environ.get("MAX_ATTACHMENT_BYTES", str(50 * 1024 * 1024)))
ATTACHMENT_TTL_DAYS = int(os.environ.get("ATTACHMENT_TTL_DAYS", "7"))
ALLOWED_MIME_PREFIXES = ("image/", "audio/", "video/", "text/", "application/pdf", "application/zip", "application/x-rar", "application/x-tar", "application/gzip", "application/json", "application/octet-stream")
