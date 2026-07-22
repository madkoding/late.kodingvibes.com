import os
import secrets
import subprocess
import time
import mimetypes
from pathlib import Path
from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File
from fastapi.responses import FileResponse
from core.auth import get_session_user
from core.config import ATTACHMENT_DIR, MAX_ATTACHMENT_BYTES, ATTACHMENT_TTL_DAYS
from repositories.channels import is_member
from repositories.attachments import create_attachment, get_attachment, get_attachment_meta
from core.db import db

router = APIRouter()

@router.post("/api/chat/channels/{channel_id}/attachments")
async def upload_attachment(request: Request, channel_id: int, file: UploadFile = File(...), session: dict = Depends(get_session_user)):
    if not file:
        raise HTTPException(400, "No file provided")
    if not is_member(channel_id, session["user_id"]):
        raise HTTPException(403, "Not a member")
    contents = await file.read()
    if len(contents) > MAX_ATTACHMENT_BYTES:
        raise HTTPException(413, f"File too large. Max {MAX_ATTACHMENT_BYTES // 1024 // 1024} MB")
    filename = file.filename or "untitled"
    mime = file.content_type or mimetypes.guess_type(filename)[0] or "application/octet-stream"
    if mime.startswith("image/"): kind = "image"
    elif mime.startswith("audio/"): kind = "audio"
    elif mime.startswith("video/"): kind = "video"
    elif mime in ("application/pdf",) or mime.startswith("text/"): kind = "document"
    else: kind = "file"
    fid = secrets.token_urlsafe(12)
    ext = Path(filename).suffix or ""
    storage_filename = f"{fid}{ext}"
    storage_path = os.path.join(ATTACHMENT_DIR, storage_filename)
    now = int(time.time())
    expires_at = now + ATTACHMENT_TTL_DAYS * 86400
    os.makedirs(ATTACHMENT_DIR, exist_ok=True)
    try:
        with open(storage_path, "wb") as f:
            f.write(contents)
    except OSError as e:
        raise HTTPException(500, f"Failed to write file: {e}")
    size_bytes = len(contents)
    if kind == "image":
        webp_path = storage_path + ".webp"
        try:
            subprocess.run(["ffmpeg", "-y", "-i", storage_path, "-c:v", "libwebp", "-quality", "80", "-preset", "picture", webp_path],
                           capture_output=True, timeout=30)
            webp_size = os.path.getsize(webp_path)
            if webp_size < len(contents):
                os.replace(webp_path, storage_path)
                ext = ".webp"
                mime = "image/webp"
                size_bytes = webp_size
            else:
                os.remove(webp_path)
        except Exception:
            if os.path.exists(webp_path):
                os.remove(webp_path)
    if kind == "video":
        compressed_path = storage_path + ".compressed.mp4"
        try:
            subprocess.run(["ffmpeg", "-y", "-i", storage_path,
                "-vf", "scale=min(1280,iw):min(720,ih):force_original_aspect_ratio=decrease,format=yuv420p",
                "-c:v", "libx264", "-preset", "veryfast", "-crf", "28",
                "-c:a", "aac", "-b:a", "64k", "-ac", "2",
                "-movflags", "+faststart", "-threads", "0", compressed_path],
                capture_output=True, timeout=180)
            compressed_size = os.path.getsize(compressed_path)
            if compressed_size < len(contents):
                os.replace(compressed_path, storage_path)
                size_bytes = compressed_size
            else:
                os.remove(compressed_path)
        except Exception:
            if os.path.exists(compressed_path):
                os.remove(compressed_path)
    create_attachment(fid, channel_id, session["user_id"], kind, filename, mime, size_bytes, storage_path, expires_at)
    base_url = str(request.base_url).rstrip("/")
    url = f"{base_url}/api/chat/attachments/{fid}{ext}"
    return {"id": fid, "url": url, "kind": kind, "filename": filename, "mime": mime, "size_bytes": size_bytes, "created_at": now, "expires_at": expires_at}

@router.get("/api/chat/attachments/{attachment_id}")
async def get_attachment_route(attachment_id: str):
    base_id = attachment_id.split(".")[0]
    row = get_attachment(base_id)
    if not row:
        raise HTTPException(404, "Attachment not found")
    if row["expires_at"] < int(time.time()):
        raise HTTPException(410, "Attachment expired")
    path = Path(row["storage_path"])
    if not path.exists():
        raise HTTPException(404, "File not found on disk")
    return FileResponse(path=str(path), media_type=row["mime"], filename=row["filename"],
        headers={"Cache-Control": "private, max-age=3600", "X-Attachment-Expires": str(row["expires_at"])})

@router.get("/api/chat/attachments/{attachment_id}/meta")
async def get_attachment_meta_route(attachment_id: str):
    base_id = attachment_id.split(".")[0]
    row = get_attachment_meta(base_id)
    if not row:
        raise HTTPException(404, "Attachment not found")
    if row["expires_at"] < int(time.time()):
        raise HTTPException(410, "Attachment expired")
    return dict(row)
