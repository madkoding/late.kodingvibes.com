import time
import pytest
from core.db import db
from repositories.attachments import create_attachment, get_attachment, get_attachment_meta, delete_expired
from repositories.users import upsert_user
from repositories.channels import create_channel


@pytest.fixture
def user_and_channel():
    user = upsert_user("att-test-user", "att@example.com", "Att User")
    ch = create_channel("#attachments", "Attachments test", True, user["id"])
    return user, ch


def test_create_and_get_attachment(user_and_channel):
    user, ch = user_and_channel
    now = int(time.time())
    create_attachment("att1", ch["id"], user["id"], "image", "photo.jpg", "image/jpeg", 1024, "/tmp/test.jpg", now + 86400)
    row = get_attachment("att1")
    assert row is not None
    assert row["kind"] == "image"
    assert row["filename"] == "photo.jpg"


def test_get_attachment_with_extension(user_and_channel):
    user, ch = user_and_channel
    now = int(time.time())
    create_attachment("att2", ch["id"], user["id"], "audio", "song.mp3", "audio/mpeg", 2048, "/tmp/song.mp3", now + 86400)
    row = get_attachment("att2.mp3")
    assert row is not None
    assert row["id"] == "att2"


def test_get_attachment_not_found():
    assert get_attachment("nonexistent") is None


def test_get_attachment_meta(user_and_channel):
    user, ch = user_and_channel
    now = int(time.time())
    create_attachment("att3", ch["id"], user["id"], "video", "clip.mp4", "video/mp4", 4096, "/tmp/clip.mp4", now + 86400)
    meta = get_attachment_meta("att3")
    assert meta is not None
    assert "storage_path" not in meta
    assert meta["kind"] == "video"


def test_delete_expired(user_and_channel):
    user, ch = user_and_channel
    now = int(time.time())
    create_attachment("exp1", ch["id"], user["id"], "file", "old.txt", "text/plain", 100, "/tmp/old.txt", now - 100)
    create_attachment("exp2", ch["id"], user["id"], "file", "new.txt", "text/plain", 100, "/tmp/new.txt", now + 86400)
    expired = delete_expired()
    expired_ids = [e["id"] for e in expired]
    assert "exp1" in expired_ids
    assert "exp2" not in expired_ids
    assert get_attachment("exp1") is None
    assert get_attachment("exp2") is not None
