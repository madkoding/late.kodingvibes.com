import time
import pytest
from core.config import SSO_SECRET


class TestHealthz:
    async def test_healthz(self, client):
        r = await client.get("/healthz")
        assert r.status_code == 200
        assert r.json() == {"ok": True}

    async def test_api_healthz(self, client):
        r = await client.get("/api/chat/healthz")
        assert r.status_code == 200
        assert r.json() == {"ok": True}


class TestExchange:
    async def test_exchange_valid(self, client, make_jwt):
        token = make_jwt()
        r = await client.post("/api/chat/exchange", json={"token": token})
        assert r.status_code == 200
        data = r.json()
        assert "session_id" in data
        assert data["user"]["email"] == "test@example.com"

    async def test_exchange_expired(self, client, make_jwt):
        token = make_jwt(exp=int(time.time()) - 10)
        r = await client.post("/api/chat/exchange", json={"token": token})
        assert r.status_code == 401
        assert "expired" in r.json()["detail"].lower()

    async def test_exchange_invalid(self, client):
        r = await client.post("/api/chat/exchange", json={"token": "invalid.jwt.token"})
        assert r.status_code == 401


class TestMe:
    async def test_me_authenticated(self, client, auth_headers):
        headers, user = auth_headers
        r = await client.get("/api/chat/me", headers=headers)
        assert r.status_code == 200
        data = r.json()
        assert data["id"] == user["id"]
        assert data["email"] == user["email"]

    async def test_me_unauthenticated(self, client):
        r = await client.get("/api/chat/me")
        assert r.status_code == 401


class TestUpdateMe:
    async def test_update_display_name(self, client, auth_headers):
        headers, user = auth_headers
        r = await client.patch("/api/chat/me", json={"display_name": "NewName"}, headers=headers)
        assert r.status_code == 200
        assert r.json()["display_name"] == "NewName"

    async def test_update_display_name_duplicate(self, client, make_session):
        session1, user1 = make_session("sub-dup-1", "alice@example.com", "Alice")
        session2, user2 = make_session("sub-dup-2", "bob@example.com", "Bob")
        r = await client.patch("/api/chat/me", json={"display_name": "alice"}, headers={"Authorization": f"Bearer {session2}"})
        assert r.status_code == 409

    async def test_update_display_name_invalid(self, client, auth_headers):
        headers, user = auth_headers
        r = await client.patch("/api/chat/me", json={"display_name": "a"}, headers=headers)
        assert r.status_code == 400

    async def test_update_name(self, client, auth_headers):
        headers, user = auth_headers
        r = await client.patch("/api/chat/me", json={"name": "New Real Name"}, headers=headers)
        assert r.status_code == 200
        assert r.json()["name"] == "New Real Name"


class TestLogout:
    async def test_logout(self, client, auth_headers):
        headers, user = auth_headers
        r = await client.post("/api/chat/logout", headers=headers)
        assert r.status_code == 200
        assert r.json() == {"ok": True}
        r2 = await client.get("/api/chat/me", headers=headers)
        assert r2.status_code == 401

    async def test_logout_no_header(self, client):
        r = await client.post("/api/chat/logout")
        assert r.status_code == 200
        assert r.json() == {"ok": True}


class TestHeartbeat:
    async def test_heartbeat(self, client, auth_headers):
        headers, user = auth_headers
        r = await client.post("/api/chat/heartbeat", headers=headers)
        assert r.status_code == 200
        assert r.json() == {"ok": True}
