from fastapi import APIRouter, Depends, Header, HTTPException
import jwt
import time
from core.config import SSO_SECRET
from core.auth import get_session_user, generate_session_id, display_name_from_email
from schemas.chat import ExchangeRequest
from repositories.users import upsert_user, update_user, get_user_by_id
from core.db import db

router = APIRouter()

@router.get("/healthz")
@router.get("/api/chat/healthz")
async def healthz():
    return {"ok": True}

@router.post("/api/chat/exchange")
async def exchange(req: ExchangeRequest):
    try:
        payload = jwt.decode(req.token, SSO_SECRET, algorithms=["HS256"], audience="late.sh", issuer="kodingvibes.com")
    except jwt.ExpiredSignatureError:
        raise HTTPException(401, "Token expired")
    except jwt.InvalidTokenError as e:
        raise HTTPException(401, f"Invalid token: {e}")
    sub = payload["sub"]
    email = payload.get("email", "")
    name = payload.get("name", email)
    user = upsert_user(sub, email, name)
    now = int(time.time())
    session_id = generate_session_id()
    with db() as conn:
        conn.execute(
            "INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)",
            (session_id, user["id"], now, now + 86400 * 365),
        )
    return {"session_id": session_id, "user": {"id": user["id"], "email": user["email"], "name": user.get("name"), "display_name": user["display_name"]}}

@router.post("/api/chat/logout")
async def logout(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        return {"ok": True}
    token = authorization[7:]
    with db() as conn:
        conn.execute("DELETE FROM sessions WHERE id = ?", (token,))
    return {"ok": True}

@router.get("/api/chat/me")
async def me(session: dict = Depends(get_session_user)):
    return {"id": session["user_id"], "email": session["email"], "name": session.get("name"), "display_name": session["display_name"]}

@router.patch("/api/chat/me")
async def update_me(payload: dict, session: dict = Depends(get_session_user)):
    from core.auth import validate_display_name
    new_display = (payload.get("display_name") or "").strip()
    if new_display:
        err = validate_display_name(new_display)
        if err:
            raise HTTPException(400, err)
        with db() as conn:
            clash = conn.execute(
                "SELECT id FROM users WHERE display_name = ? COLLATE NOCASE AND id != ?",
                (new_display, session["user_id"]),
            ).fetchone()
            if clash:
                raise HTTPException(409, "display_name already in use")
    updates = {}
    if new_display:
        updates["display_name"] = new_display
    if payload.get("name"):
        updates["name"] = payload["name"].strip()[:80]
    user = update_user(session["user_id"], updates)
    return user

@router.post("/api/chat/heartbeat")
async def heartbeat(session: dict = Depends(get_session_user)):
    from repositories.users import touch_last_seen
    touch_last_seen(session["user_id"])
    return {"ok": True}
