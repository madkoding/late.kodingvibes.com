import time
from core.db import db
from services.broadcaster import ws_manager


def list_channels(user_id: int) -> list[dict]:
    with db() as conn:
        conn.execute("UPDATE users SET last_seen = ? WHERE id = ?", (int(time.time()), user_id))
        rows = conn.execute("""
            SELECT c.*,
                (SELECT COUNT(*) FROM channel_members WHERE channel_id = c.id) AS member_count,
                (SELECT id FROM messages WHERE channel_id = c.id ORDER BY id DESC LIMIT 1) AS last_message_id,
                (SELECT content FROM messages WHERE channel_id = c.id ORDER BY id DESC LIMIT 1) AS last_message_content,
                (SELECT created_at FROM messages WHERE channel_id = c.id ORDER BY id DESC LIMIT 1) AS last_message_at
            FROM channels c
            WHERE c.id IN (SELECT channel_id FROM channel_members WHERE user_id = ?)
            ORDER BY c.name
        """, (user_id,)).fetchall()
        channels = []
        for r in rows:
            member_uids = [
                m["user_id"] for m in conn.execute(
                    "SELECT user_id FROM channel_members WHERE channel_id = ?", (r["id"],)
                ).fetchall()
            ]
            active_count = sum(1 for uid in member_uids if ws_manager.is_online(uid))
            read_id = conn.execute(
                "SELECT last_read_message_id FROM channel_members WHERE channel_id = ? AND user_id = ?",
                (r["id"], user_id),
            ).fetchone()
            read_id = read_id["last_read_message_id"] if read_id else 0
            unread = 0
            if r["last_message_id"] and r["last_message_id"] > read_id:
                unread = conn.execute(
                    "SELECT COUNT(*) AS c FROM messages WHERE channel_id = ? AND id > ?",
                    (r["id"], read_id),
                ).fetchone()["c"]
            my_role = conn.execute(
                "SELECT role FROM channel_members WHERE channel_id = ? AND user_id = ?",
                (r["id"], user_id),
            ).fetchone()
            ch_type = dict(r).get("channel_type", "text")
            channels.append({
                "id": r["id"],
                "name": r["name"],
                "description": r["description"],
                "is_public": bool(r["is_public"]),
                "channel_type": ch_type,
                "category_id": r["category_id"],
                "position": r["position"],
                "member_count": r["member_count"],
                "active_count": active_count,
                "voice_participants": 0,
                "unread": unread,
                "my_role": my_role["role"] if my_role else None,
                "last_message": {
                    "id": r["last_message_id"],
                    "content": r["last_message_content"],
                    "created_at": r["last_message_at"],
                } if r["last_message_id"] else None,
            })
    return channels


def get_channel(channel_id: int) -> dict | None:
    with db() as conn:
        row = conn.execute("SELECT * FROM channels WHERE id = ?", (channel_id,)).fetchone()
    return dict(row) if row else None


def create_channel(name: str, description: str | None, is_public: bool, created_by: int, channel_type: str = "text") -> dict:
    with db() as conn:
        now = int(time.time())
        cur = conn.execute(
            "INSERT INTO channels (name, description, is_public, created_by, created_at, channel_type) VALUES (?, ?, ?, ?, ?, ?)",
            (name, description, 1 if is_public else 0, created_by, now, channel_type),
        )
        channel_id = cur.lastrowid
        conn.execute(
            "INSERT INTO channel_members (channel_id, user_id, joined_at, role) VALUES (?, ?, ?, ?)",
            (channel_id, created_by, now, "admin"),
        )
    return {"id": channel_id, "name": name}


def update_channel(channel_id: int, patch: dict):
    with db() as conn:
        updates = []
        params = []
        if "category_id" in patch:
            updates.append("category_id = ?")
            params.append(patch["category_id"])
        if "position" in patch:
            updates.append("position = ?")
            params.append(patch["position"])
        if updates:
            params.append(channel_id)
            conn.execute(f"UPDATE channels SET {', '.join(updates)} WHERE id = ?", params)


def join_channel(channel_id: int, user_id: int):
    with db() as conn:
        conn.execute(
            "INSERT OR IGNORE INTO channel_members (channel_id, user_id, joined_at) VALUES (?, ?, ?)",
            (channel_id, user_id, int(time.time())),
        )


def leave_channel(channel_id: int, user_id: int):
    with db() as conn:
        conn.execute("DELETE FROM channel_members WHERE channel_id = ? AND user_id = ?", (channel_id, user_id))


def is_member(channel_id: int, user_id: int) -> bool:
    with db() as conn:
        row = conn.execute(
            "SELECT 1 FROM channel_members WHERE channel_id = ? AND user_id = ?",
            (channel_id, user_id),
        ).fetchone()
    return row is not None
