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


def test_list_channels_includes_public_unjoined(consume_admin_slot, make_session):
    _, user = make_session()
    # Create a public channel from a different user; the test user doesn't join.
    _, other = make_session(sub="other-sub", email="other@example.com", name="Other")
    create_channel("#discoverable", "Public", True, other["id"])
    chans = list_channels(user["id"])
    by_name = {c["name"]: c for c in chans}
    assert "#discoverable" in by_name
    assert by_name["#discoverable"]["joined"] is False
    assert by_name["#discoverable"]["my_role"] is None
    assert by_name["#discoverable"]["unread"] == 0
    # Joined channels must still carry joined=True.
    for name in ("#lobby", "#random", "#dev", "#infra"):
        assert by_name[name]["joined"] is True


def test_super_admin_sees_admin_role_on_every_channel(consume_admin_slot, make_session):
    from core.db import db
    _, user = make_session()
    with db() as conn:
        conn.execute("UPDATE users SET global_role = 'super_admin' WHERE id = ?", (user["id"],))
    # Other user creates a channel and doesn't invite us.
    _, other = make_session(sub="other2-sub", email="other2@example.com", name="Other2")
    create_channel("#otherplace", "Other's", True, other["id"])
    chans = list_channels(user["id"])
    by_name = {c["name"]: c for c in chans}
    # Joined channels: my_role forced to 'admin' even if we never were admin there.
    for name in ("#lobby", "#random", "#dev", "#infra"):
        assert by_name[name]["my_role"] == "admin"
    # Non-joined public channel: my_role is also 'admin', joined=False.
    assert by_name["#otherplace"]["my_role"] == "admin"
    assert by_name["#otherplace"]["joined"] is False


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
