import pytest


class TestListChannels:
    async def test_list(self, client, auth_headers):
        headers, user = auth_headers
        r = await client.get("/api/chat/channels", headers=headers)
        assert r.status_code == 200
        data = r.json()
        assert len(data) >= 4
        names = [c["name"] for c in data]
        assert "#lobby" in names


class TestCreateChannel:
    async def test_create(self, client, auth_headers):
        headers, user = auth_headers
        r = await client.post("/api/chat/channels", json={"name": "test-channel"}, headers=headers)
        assert r.status_code == 200
        data = r.json()
        assert data["name"] == "#test-channel"

    async def test_create_with_hash(self, client, auth_headers):
        headers, user = auth_headers
        r = await client.post("/api/chat/channels", json={"name": "#explicit"}, headers=headers)
        assert r.status_code == 200
        assert r.json()["name"] == "#explicit"

    async def test_create_invalid_name(self, client, auth_headers):
        headers, user = auth_headers
        r = await client.post("/api/chat/channels", json={"name": "bad name!"}, headers=headers)
        assert r.status_code == 400

    async def test_create_too_long(self, client, auth_headers):
        headers, user = auth_headers
        r = await client.post("/api/chat/channels", json={"name": "a" * 41}, headers=headers)
        assert r.status_code == 400

    async def test_create_duplicate(self, client, auth_headers):
        headers, user = auth_headers
        await client.post("/api/chat/channels", json={"name": "dup"}, headers=headers)
        r = await client.post("/api/chat/channels", json={"name": "dup"}, headers=headers)
        assert r.status_code == 409


class TestUpdateChannel:
    async def test_update(self, client, auth_headers):
        headers, user = auth_headers
        ch = (await client.get("/api/chat/channels", headers=headers)).json()[0]
        r = await client.patch(f"/api/chat/channels/{ch['id']}", json={"position": 5}, headers=headers)
        assert r.status_code == 200
        assert r.json()["ok"] is True


class TestJoinLeave:
    async def test_join(self, client, auth_headers):
        headers, user = auth_headers
        ch = (await client.get("/api/chat/channels", headers=headers)).json()[0]
        r = await client.post(f"/api/chat/channels/{ch['id']}/join", headers=headers)
        assert r.status_code == 200

    async def test_leave(self, client, auth_headers):
        headers, user = auth_headers
        ch = (await client.get("/api/chat/channels", headers=headers)).json()[0]
        r = await client.post(f"/api/chat/channels/{ch['id']}/leave", headers=headers)
        assert r.status_code == 200


class TestSearchUsers:
    async def test_search(self, client, auth_headers):
        headers, user = auth_headers
        r = await client.get("/api/chat/users?q=test", headers=headers)
        assert r.status_code == 200
        data = r.json()
        assert len(data) >= 1

    async def test_search_empty(self, client, auth_headers):
        headers, user = auth_headers
        r = await client.get("/api/chat/users?q=", headers=headers)
        assert r.status_code == 200
        assert r.json() == []


class TestInvite:
    async def test_invite(self, client, auth_headers, consume_admin_slot, make_session):
        headers, user = auth_headers
        _, target = make_session("sub-invite", "target@example.com", "Target")
        ch = (await client.get("/api/chat/channels", headers=headers)).json()[0]
        r = await client.post(f"/api/chat/channels/{ch['id']}/invite", json={"email": "target@example.com"}, headers=headers)
        assert r.status_code == 200
        assert r.json()["ok"] is True

    async def test_invite_invalid_email(self, client, auth_headers):
        headers, user = auth_headers
        ch = (await client.get("/api/chat/channels", headers=headers)).json()[0]
        r = await client.post(f"/api/chat/channels/{ch['id']}/invite", json={"email": "notanemail"}, headers=headers)
        assert r.status_code == 400

    async def test_invite_not_found(self, client, auth_headers):
        headers, user = auth_headers
        ch = (await client.get("/api/chat/channels", headers=headers)).json()[0]
        r = await client.post(f"/api/chat/channels/{ch['id']}/invite", json={"email": "nobody@example.com"}, headers=headers)
        assert r.status_code == 404


class TestMarkRead:
    async def test_mark_read(self, client, auth_headers):
        headers, user = auth_headers
        ch = (await client.get("/api/chat/channels", headers=headers)).json()[0]
        r = await client.post(f"/api/chat/channels/{ch['id']}/read?message_id=1", headers=headers)
        assert r.status_code == 200
        assert r.json()["ok"] is True
