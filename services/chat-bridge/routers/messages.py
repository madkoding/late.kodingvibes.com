from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
from core.auth import get_session_user
from schemas.chat import SendMessageRequest, ForwardRequest
from repositories.messages import send_message, list_messages, hide_message, delete_message, get_message, forward_message
from repositories.channels import is_member
from repositories.receipts import mark_delivered
from services.broadcaster import ws_manager
from services.notifications import send_to_kv
from core.db import db
import asyncio
import re
import json
import httpx
import logging

log = logging.getLogger("chat-bridge")
router = APIRouter()

URL_RE = re.compile(r"https?://[^\s<>\"']+", re.IGNORECASE)

def extract_urls(content: str) -> list[str]:
    seen = set()
    out = []
    for m in URL_RE.finditer(content):
        url = m.group(0).rstrip(".,;:!?)")
        if url in seen:
            continue
        seen.add(url)
        out.append(url)
        if len(out) >= 3:
            break
    return out

async def fetch_og(url: str) -> dict | None:
    try:
        async with httpx.AsyncClient(timeout=6, follow_redirects=True, headers={
            "User-Agent": "Mozilla/5.0 (compatible; late-chat-og/1.0)",
            "Accept": "text/html,application/xhtml+xml",
        }) as client:
            r = await client.get(url)
    except Exception as e:
        log.warning(f"OG fetch failed for {url}: {e}")
        return None
    if r.status_code >= 400 or "text/html" not in r.headers.get("content-type", ""):
        return None
    html = r.text[:200_000]
    def meta(prop: str) -> str | None:
        m = re.search(rf'<meta[^>]+(?:property|name)=["\']{re.escape(prop)}["\'][^>]+content=["\']([^"\']*)["\']', html, re.IGNORECASE)
        if m:
            return m.group(1).strip()
        m = re.search(rf'<meta[^>]+content=["\']([^"\']*)["\'][^>]+(?:property|name)=["\']{re.escape(prop)}["\']', html, re.IGNORECASE)
        return m.group(1).strip() if m else None
    title = meta("og:title") or meta("twitter:title")
    if not title:
        m = re.search(r"<title[^>]*>([^<]+)</title>", html, re.IGNORECASE)
        if m:
            title = m.group(1).strip()
    description = meta("og:description") or meta("twitter:description") or meta("description")
    image = meta("og:image") or meta("twitter:image")
    site_name = meta("og:site_name")
    og = {"url": url}
    if title: og["title"] = title[:300]
    if description: og["description"] = description[:500]
    if image: og["image"] = image
    if site_name: og["site_name"] = site_name[:120]
    return og

async def _enrich_og_and_broadcast(msg_id: int, channel_id: int, url: str):
    og = await fetch_og(url)
    if not og:
        return
    with db() as conn:
        conn.execute("UPDATE messages SET og_data = ? WHERE id = ?", (json.dumps(og), msg_id))
    await ws_manager.broadcast_to_channel_members(channel_id, {"type": "message_og", "data": {"id": msg_id, "og_data": og}})

@router.get("/api/chat/channels/{channel_id}/messages")
async def list_messages_route(channel_id: int, before: Optional[int] = None, limit: int = 50, session: dict = Depends(get_session_user)):
    from repositories.channels import get_channel
    ch = get_channel(channel_id)
    if not ch:
        raise HTTPException(404, "Channel not found")
    if not is_member(channel_id, session["user_id"]):
        raise HTTPException(403, "Not a member")
    return list_messages(channel_id, before, limit)

@router.post("/api/chat/channels/{channel_id}/messages")
async def send_message_route(channel_id: int, req: SendMessageRequest, session: dict = Depends(get_session_user)):
    content = req.content.strip()
    if not content:
        raise HTTPException(400, "Empty message")
    if len(content) > 2_000_000:
        raise HTTPException(400, "Message too long")
    is_action = bool(req.is_action)
    if not is_action and content.startswith("/me ") and len(content) > 4:
        is_action = True
        content = content[4:].strip()
    from repositories.channels import get_channel
    ch = get_channel(channel_id)
    if not ch:
        raise HTTPException(404, "Channel not found")
    with db() as conn:
        member = conn.execute(
            "SELECT role, muted FROM channel_members WHERE channel_id = ? AND user_id = ?",
            (channel_id, session["user_id"]),
        ).fetchone()
        if not member:
            raise HTTPException(403, "Not a member")
        if member["muted"] and member["role"] not in ("admin", "mod"):
            raise HTTPException(403, "Estás silenciado en este canal")
    msg = send_message(channel_id, session["user_id"], content, is_action, req.reply_to)
    payload = {"type": "message", "data": msg}
    await ws_manager.broadcast_to_channel_members(channel_id, payload, exclude={session["user_id"]})
    # Ponytail: receipts — anyone with a live WS at send time counts as
    # "delivered" (the message left our server to their socket). We
    # record the rows here so the checkmark survives a sender reload,
    # and broadcast a message_delivered event back so any other
    # session of the sender (e.g. the web app open in another tab)
    # flips its bubble from "sent" to "delivered" without waiting
    # for a full refetch.
    delivered_to: list[int] = []
    with db() as conn:
        member_ids = [
            r["user_id"] for r in conn.execute(
                "SELECT user_id FROM channel_members WHERE channel_id = ?",
                (channel_id,),
            ).fetchall()
        ]
    online_members = [uid for uid in member_ids if uid != session["user_id"] and ws_manager.is_online(uid)]
    delivered_to = mark_delivered(msg["id"], online_members)
    if delivered_to:
        await ws_manager.broadcast_to_channel_members(channel_id, {
            "type": "message_delivered",
            "data": {
                "message_id": msg["id"],
                "channel_id": channel_id,
                "user_ids": delivered_to,
            },
        }, exclude=set())
    asyncio.create_task(send_to_kv("message.new", {**msg}))
    urls = extract_urls(content)
    if urls and not is_action:
        asyncio.create_task(_enrich_og_and_broadcast(msg["id"], channel_id, urls[0]))
    return msg

@router.post("/api/chat/messages/{message_id}/hide")
async def hide_message_route(message_id: int, session: dict = Depends(get_session_user)):
    from core.auth import require_admin_or_mod
    with db() as conn:
        msg = conn.execute(
            "SELECT m.*, c.id as ch_id FROM messages m JOIN channels c ON c.id = m.channel_id WHERE m.id = ?",
            (message_id,),
        ).fetchone()
        if not msg:
            raise HTTPException(404, "Message not found")
        channel_id = msg["ch_id"]
        is_admin = require_admin_or_mod(channel_id, session["user_id"], conn)
        is_author = msg["user_id"] == session["user_id"]
        if not is_admin and not is_author:
            raise HTTPException(403, "Not allowed")
        hide_message(message_id)
    await ws_manager.broadcast_to_channel_members(channel_id, {"type": "hide", "data": {"message_id": message_id, "channel_id": channel_id}})
    return {"ok": True}

@router.delete("/api/chat/messages/{message_id}")
async def delete_message_route(message_id: int, session: dict = Depends(get_session_user)):
    from core.auth import require_admin_or_mod
    with db() as conn:
        msg = conn.execute(
            "SELECT m.*, c.id as ch_id FROM messages m JOIN channels c ON c.id = m.channel_id WHERE m.id = ?",
            (message_id,),
        ).fetchone()
        if not msg:
            raise HTTPException(404, "Message not found")
        channel_id = msg["ch_id"]
        is_admin = require_admin_or_mod(channel_id, session["user_id"], conn)
        is_author = msg["user_id"] == session["user_id"]
        if not is_admin and not is_author:
            raise HTTPException(403, "Not allowed")
        delete_message(message_id)
    await ws_manager.broadcast_to_channel_members(channel_id, {"type": "delete", "data": {"message_id": message_id, "channel_id": channel_id}})
    return {"ok": True}

@router.post("/api/chat/messages/{message_id}/forward")
async def forward_message_route(message_id: int, req: ForwardRequest, session: dict = Depends(get_session_user)):
    if req.target_user_id is not None:
        raise HTTPException(501, "p2p forwarding not implemented yet")
    from repositories.channels import get_channel
    target_ch = get_channel(req.target_channel_id)
    if not target_ch:
        raise HTTPException(404, "Target channel not found")
    with db() as conn:
        orig = conn.execute(
            "SELECT m.*, u.display_name, u.email, c.name as ch_name FROM messages m "
            "JOIN users u ON u.id = m.user_id JOIN channels c ON c.id = m.channel_id WHERE m.id = ?",
            (message_id,),
        ).fetchone()
        if not orig:
            raise HTTPException(404, "Original message not found")
        if orig["hidden"]:
            raise HTTPException(400, "Cannot forward a hidden or deleted message")
        if not is_member(orig["channel_id"], session["user_id"]):
            raise HTTPException(403, "Not a member of the source channel")
        target_member = conn.execute(
            "SELECT muted, role FROM channel_members WHERE channel_id = ? AND user_id = ?",
            (req.target_channel_id, session["user_id"]),
        ).fetchone()
        if not target_member:
            raise HTTPException(403, "Not a member of the target channel")
        if target_member["muted"] and target_member["role"] not in ("admin", "mod"):
            raise HTTPException(403, "Estás silenciado en el canal destino")
    new_msg = forward_message(message_id, req.target_channel_id, session["user_id"])
    payload = {"type": "message", "data": new_msg}
    await ws_manager.broadcast_to_channel_members(req.target_channel_id, payload, exclude={session["user_id"]})
    with db() as conn:
        member_ids = [
            r["user_id"] for r in conn.execute(
                "SELECT user_id FROM channel_members WHERE channel_id = ?",
                (req.target_channel_id,),
            ).fetchall()
        ]
    online_members = [uid for uid in member_ids if uid != session["user_id"] and ws_manager.is_online(uid)]
    delivered_to = mark_delivered(new_msg["id"], online_members)
    if delivered_to:
        await ws_manager.broadcast_to_channel_members(req.target_channel_id, {
            "type": "message_delivered",
            "data": {
                "message_id": new_msg["id"],
                "channel_id": req.target_channel_id,
                "user_ids": delivered_to,
            },
        }, exclude=set())
    asyncio.create_task(send_to_kv("message.new", {**new_msg}))
    urls = extract_urls(new_msg.get("content", ""))
    if urls:
        asyncio.create_task(_enrich_og_and_broadcast(new_msg["id"], req.target_channel_id, urls[0]))
    return new_msg
