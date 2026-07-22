from fastapi import APIRouter, Depends, HTTPException
from core.auth import get_session_user
from schemas.chat import CreateChannelRequest, UpdateChannelRequest, InviteRequest
from repositories.channels import list_channels, get_channel, create_channel, update_channel, join_channel, leave_channel, is_member
from repositories.users import search_users
from services.notifications import send_to_kv
from core.db import db
import asyncio

router = APIRouter()

@router.get("/api/chat/channels")
async def list_channels_route(session: dict = Depends(get_session_user)):
    return list_channels(session["user_id"])

@router.post("/api/chat/channels")
async def create_channel_route(req: CreateChannelRequest, session: dict = Depends(get_session_user)):
    name = req.name.strip()
    ch_type = req.channel_type or "text"
    if ch_type == "text":
        if not name.startswith("#"):
            name = "#" + name
        if not name[1:].replace("_", "").replace("-", "").isalnum():
            raise HTTPException(400, "Invalid channel name")
    if len(name) > 40:
        raise HTTPException(400, "Channel name too long")
    try:
        ch = create_channel(name, req.description, req.is_public, session["user_id"], ch_type)
        return ch
    except Exception:
        raise HTTPException(409, "Channel already exists")

@router.patch("/api/chat/channels/{channel_id}")
async def update_channel_route(channel_id: int, req: UpdateChannelRequest, session: dict = Depends(get_session_user)):
    update_channel(channel_id, {"category_id": req.category_id, "position": req.position})
    return {"ok": True}

@router.post("/api/chat/channels/{channel_id}/join")
async def join_channel_route(channel_id: int, session: dict = Depends(get_session_user)):
    ch = get_channel(channel_id)
    if not ch:
        raise HTTPException(404, "Channel not found")
    join_channel(channel_id, session["user_id"])
    return {"ok": True}

@router.post("/api/chat/channels/{channel_id}/leave")
async def leave_channel_route(channel_id: int, session: dict = Depends(get_session_user)):
    leave_channel(channel_id, session["user_id"])
    return {"ok": True}

@router.get("/api/chat/users")
async def search_users_route(q: str, session: dict = Depends(get_session_user)):
    q = q.strip().lower()
    if not q:
        return []
    return search_users(q)

@router.post("/api/chat/channels/{channel_id}/invite")
async def invite_user(channel_id: int, req: InviteRequest, session: dict = Depends(get_session_user)):
    email = req.email.strip().lower()
    if not email or "@" not in email:
        raise HTTPException(400, "Invalid email")
    ch = get_channel(channel_id)
    if not ch:
        raise HTTPException(404, "Channel not found")
    if not is_member(channel_id, session["user_id"]):
        raise HTTPException(403, "Not a member")
    from repositories.users import get_user_by_id
    with db() as conn:
        target = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
        if not target:
            raise HTTPException(404, "User not found")
        conn.execute(
            "INSERT OR IGNORE INTO channel_members (channel_id, user_id, joined_at) VALUES (?, ?, ?)",
            (channel_id, target["id"], int(__import__('time').time())),
        )
    asyncio.create_task(send_to_kv("channel.invited", {
        "channel_id": channel_id, "channel_name": ch["name"],
        "user_id": target["id"], "display_name": target["display_name"],
        "by": session["display_name"],
    }))
    return {"ok": True, "user": {"id": target["id"], "display_name": target["display_name"]}}

@router.post("/api/chat/channels/{channel_id}/read")
async def mark_read(channel_id: int, message_id: int, session: dict = Depends(get_session_user)):
    with db() as conn:
        conn.execute(
            "UPDATE channel_members SET last_read_message_id = MAX(last_read_message_id, ?) WHERE channel_id = ? AND user_id = ?",
            (message_id, channel_id, session["user_id"]),
        )
    return {"ok": True}
