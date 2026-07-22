import time
from core.db import db


def create_attachment(id: str, channel_id: int, user_id: int, kind: str, filename: str, mime: str, size_bytes: int, storage_path: str, expires_at: int):
    with db() as conn:
        now = int(time.time())
        conn.execute(
            "INSERT INTO attachments (id, channel_id, user_id, kind, filename, mime, size_bytes, storage_path, created_at, expires_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            (id, channel_id, user_id, kind, filename, mime, size_bytes, storage_path, now, expires_at),
        )


def get_attachment(attachment_id: str) -> dict | None:
    base_id = attachment_id.split(".")[0]
    with db() as conn:
        row = conn.execute(
            "SELECT * FROM attachments WHERE id = ?", (base_id,),
        ).fetchone()
    return dict(row) if row else None


def get_attachment_meta(attachment_id: str) -> dict | None:
    base_id = attachment_id.split(".")[0]
    with db() as conn:
        row = conn.execute(
            "SELECT id, channel_id, user_id, kind, filename, mime, size_bytes, created_at, expires_at "
            "FROM attachments WHERE id = ?", (base_id,),
        ).fetchone()
    return dict(row) if row else None


def delete_expired() -> list[dict]:
    with db() as conn:
        expired = conn.execute(
            "SELECT id, storage_path FROM attachments WHERE expires_at < ?",
            (int(time.time()),),
        ).fetchall()
        if expired:
            ids = ",".join("?" * len(expired))
            conn.execute(
                f"DELETE FROM attachments WHERE id IN ({ids})",
                [e["id"] for e in expired],
            )
    return [dict(r) for r in expired]
