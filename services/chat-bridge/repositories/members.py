import time
from core.db import db


def list_members(channel_id: int) -> list[dict]:
    with db() as conn:
        rows = conn.execute(
            "SELECT u.id, u.display_name, u.email, u.last_seen, cm.role, cm.muted FROM channel_members cm "
            "JOIN users u ON u.id = cm.user_id "
            "WHERE cm.channel_id = ? ORDER BY u.last_seen DESC, u.display_name",
            (channel_id,),
        ).fetchall()
    now = int(time.time())
    return [{
        "id": r["id"],
        "display_name": r["display_name"],
        "email": r["email"],
        "active": r["last_seen"] > now - 300,
        "role": r["role"],
        "muted": bool(r["muted"]),
    } for r in rows]


def change_role(channel_id: int, target_user_id: int, role: str | None):
    with db() as conn:
        conn.execute(
            "UPDATE channel_members SET role = ? WHERE channel_id = ? AND user_id = ?",
            (role, channel_id, target_user_id),
        )


def change_mute(channel_id: int, target_user_id: int, muted: bool):
    with db() as conn:
        conn.execute(
            "UPDATE channel_members SET muted = ? WHERE channel_id = ? AND user_id = ?",
            (1 if muted else 0, channel_id, target_user_id),
        )


def get_member(channel_id: int, user_id: int) -> dict | None:
    with db() as conn:
        row = conn.execute(
            "SELECT cm.*, u.display_name, u.email FROM channel_members cm "
            "JOIN users u ON u.id = cm.user_id "
            "WHERE cm.channel_id = ? AND cm.user_id = ?",
            (channel_id, user_id),
        ).fetchone()
    return dict(row) if row else None
