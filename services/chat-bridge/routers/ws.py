import json
import asyncio
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from services.broadcaster import ws_manager
from services.voice_rooms import voice_rooms
from core.db import db

log = logging.getLogger("chat-bridge")
router = APIRouter()

@router.websocket("/api/chat/ws")
async def chat_ws(ws: WebSocket, token: str = None):
    await ws.accept()
    if not token:
        await ws.close(code=4401)
        return
    with db() as conn:
        session = conn.execute(
            "SELECT s.id, s.user_id, s.expires_at, u.display_name, u.email "
            "FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.id = ? AND s.expires_at > ?",
            (token, int(__import__('time').time())),
        ).fetchone()
    if not session:
        await ws.close(code=4401)
        return
    user_id = session["user_id"]
    await ws_manager.connect(user_id, ws)
    try:
        await ws.send_text(json.dumps({"type": "hello", "user": {"id": user_id, "display_name": session["display_name"]}}))
        while True:
            data = await ws.receive_text()
            try:
                msg = json.loads(data)
                t = msg.get("type")
                if t == "ping":
                    await ws.send_text(json.dumps({"type": "pong"}))
                elif t == "typing":
                    channel_id = int(msg.get("channel_id", 0))
                    if channel_id and msg.get("typing", True):
                        await ws_manager.broadcast_to_channel_members(channel_id, {
                            "type": "typing", "data": {
                                "channel_id": channel_id, "user_id": user_id,
                                "display_name": session["display_name"], "typing": True,
                            },
                        }, exclude={user_id})
                elif t == "voice.join":
                    room_id = msg.get("roomId", "lobby")
                    await voice_rooms.join(user_id, room_id)
                    peers = await voice_rooms.peers(user_id)
                    await ws.send_text(json.dumps({"type": "voice.peers", "data": {"peers": list(peers)}}))
                    await voice_rooms.broadcast(user_id, {"type": "voice.peer_joined", "data": {"user_id": user_id, "display_name": session["display_name"]}})
                elif t == "voice.leave":
                    await voice_rooms.leave(user_id)
                    await voice_rooms.broadcast(user_id, {"type": "voice.peer_left", "data": {"user_id": user_id, "display_name": session["display_name"]}})
                elif t == "voice.offer":
                    target = msg.get("to")
                    if target:
                        await ws_manager.send_to_user(target, {"type": "voice.offer", "data": {"from": user_id, "from_display_name": session["display_name"], "sdp": msg.get("sdp")}})
                elif t == "voice.answer":
                    target = msg.get("to")
                    if target:
                        await ws_manager.send_to_user(target, {"type": "voice.answer", "data": {"from": user_id, "from_display_name": session["display_name"], "sdp": msg.get("sdp")}})
                elif t == "voice.ice":
                    target = msg.get("to")
                    if target:
                        await ws_manager.send_to_user(target, {"type": "voice.ice", "data": {"from": user_id, "from_display_name": session["display_name"], "candidate": msg.get("candidate")}})
                elif t == "voice.hangup":
                    await voice_rooms.leave(user_id)
                    await voice_rooms.broadcast(user_id, {"type": "voice.hangup", "data": {"user_id": user_id}})
                elif t == "voice.peer_volume":
                    target = msg.get("to")
                    volume = msg.get("volume")
                    if target and volume is not None:
                        await ws_manager.send_to_user(target, {"type": "voice.peer_volume", "data": {"from": user_id, "volume": volume}})
                elif t == "voice.peer_local_mute":
                    target = msg.get("to")
                    muted = msg.get("muted")
                    if target and muted is not None:
                        await ws_manager.send_to_user(target, {"type": "voice.peer_local_mute", "data": {"from": user_id, "muted": muted}})
                elif t == "voice.peer_kick":
                    target = msg.get("target_user_id")
                    channel_id_for_voice = msg.get("channel_id")
                    if target and channel_id_for_voice:
                        with db() as conn:
                            caller_role = conn.execute("SELECT role FROM channel_members WHERE channel_id = ? AND user_id = ?", (channel_id_for_voice, user_id)).fetchone()
                        if caller_role and caller_role["role"] == "admin":
                            await ws_manager.send_to_user(target, {"type": "voice.kicked", "data": {"by": user_id, "by_display_name": session["display_name"], "channel_id": channel_id_for_voice}})
                            await voice_rooms.leave(target)
                            await voice_rooms.broadcast(target, {"type": "voice.peer_left", "data": {"user_id": target, "display_name": ""}})
            except json.JSONDecodeError:
                pass
    except WebSocketDisconnect:
        pass
    finally:
        await ws_manager.disconnect(user_id, ws)
        await voice_rooms.leave(user_id)
