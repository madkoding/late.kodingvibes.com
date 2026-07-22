import asyncio
import json
import logging
from typing import Optional

log = logging.getLogger("chat-bridge")

class ConnectionManager:
    def __init__(self):
        self.connections: dict[int, set] = {}
        self.lock = asyncio.Lock()

    async def connect(self, user_id: int, ws):
        async with self.lock:
            self.connections.setdefault(user_id, set()).add(ws)

    async def disconnect(self, user_id: int, ws):
        async with self.lock:
            if user_id in self.connections:
                self.connections[user_id].discard(ws)
                if not self.connections[user_id]:
                    del self.connections[user_id]

    async def broadcast_to_channel_members(self, channel_id: int, message: dict, exclude: set[int] | None = None):
        from core.db import db
        with db() as conn:
            members = conn.execute(
                "SELECT user_id FROM channel_members WHERE channel_id = ?", (channel_id,)
            ).fetchall()
        for m in members:
            if exclude and m["user_id"] in exclude:
                continue
            await self.send_to_user(m["user_id"], message)

    async def send_to_user(self, user_id: int, message: dict):
        async with self.lock:
            sockets = list(self.connections.get(user_id, []))
        data = json.dumps(message)
        for ws in sockets:
            try:
                await ws.send_text(data)
            except Exception as e:
                log.warning(f"Failed to send to user {user_id}: {e}")

ws_manager = ConnectionManager()
