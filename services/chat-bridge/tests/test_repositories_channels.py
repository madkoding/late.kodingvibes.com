import time
import pytest
from core.db import db
from repositories.channels import (
    list_channels, get_channel, create_channel, update_channel,
    join_channel, leave_channel, is_member,
)


def test_create_channel(consume_admin_slot, make_session):
    _, user = make_session()
    ch = create_channel("#test", "Test channel", True, user["id"])
    assert ch["id"] > 0
    assert ch["name"] == "#test"
    with db() as conn:
        member = conn.execute(
            "SELECT role FROM channel_members WHERE channel_id = ? AND user_id = ?",
            (ch["id"], user["id"]),
        ).fetchone()
        assert member["role"] == "admin"


def test_create_channel_without_hash(consume_admin_slot, make_session):
    _, user = make_session()
    ch = create_channel("test", "No hash", True, user["id"])
    assert ch["name"] == "test"


def test_get_channel(consume_admin_slot, make_session):
    _, user = make_session()
    ch = create_channel("#gettest", "Get test", True, user["id"])
    found = get_channel(ch["id"])
    assert found is not None
    assert found["name"] == "#gettest"
    assert get_channel(99999) is None


def test_list_channels(consume_admin_slot, make_session):
    _, user = make_session()
    chans = list_channels(user["id"])
    names = [c["name"] for c in chans]
    assert "#lobby" in names
    assert "#random" in names
    assert "#dev" in names
    assert "#infra" in names
    for c in chans:
        assert "member_count" in c
        assert "unread" in c
        assert "my_role" in c


def test_list_channels_includes_last_message(consume_admin_slot, make_session):
    _, user = make_session()
    chans = list_channels(user["id"])
    for c in chans:
        assert "last_message" in c


def test_join_channel(consume_admin_slot, make_session):
    _, user = make_session()
    ch = create_channel("#jointest", "Join test", True, user["id"])
    join_channel(ch["id"], user["id"])
    assert is_member(ch["id"], user["id"]) is True


def test_join_channel_idempotent(consume_admin_slot, make_session):
    _, user = make_session()
    ch = create_channel("#joinidem", "Idem", True, user["id"])
    join_channel(ch["id"], user["id"])
    join_channel(ch["id"], user["id"])
    assert is_member(ch["id"], user["id"]) is True


def test_leave_channel(consume_admin_slot, make_session):
    _, user = make_session()
    ch = create_channel("#leavetest", "Leave test", True, user["id"])
    leave_channel(ch["id"], user["id"])
    assert is_member(ch["id"], user["id"]) is False


def test_update_channel(consume_admin_slot, make_session):
    _, user = make_session()
    ch = create_channel("#updatetest", "Update test", True, user["id"])
    update_channel(ch["id"], {"position": 10})
    updated = get_channel(ch["id"])
    assert updated["position"] == 10


def test_is_member(consume_admin_slot, make_session):
    _, user = make_session()
    with db() as conn:
        lobby = conn.execute("SELECT id FROM channels WHERE name = '#lobby'").fetchone()
    assert is_member(lobby["id"], user["id"]) is True
    assert is_member(99999, user["id"]) is False
