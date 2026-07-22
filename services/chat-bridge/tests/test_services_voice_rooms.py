import pytest
from unittest.mock import AsyncMock, patch
from services.voice_rooms import voice_rooms, VoiceRoomManager


class TestVoiceRoomManager:
    @pytest.fixture(autouse=True)
    def reset(self):
        voice_rooms.rooms.clear()
        voice_rooms.user_room.clear()

    @pytest.fixture(autouse=True)
    def mock_broadcast(self):
        with patch.object(voice_rooms, "_broadcast_participants", new=AsyncMock()):
            yield

    async def test_join_new_room(self):
        await voice_rooms.join(1, "lobby")
        assert voice_rooms.participant_count("lobby") == 1
        assert voice_rooms.user_room[1] == "lobby"

    async def test_join_switches_room(self):
        await voice_rooms.join(1, "lobby")
        await voice_rooms.join(1, "music")
        assert voice_rooms.participant_count("lobby") == 0
        assert voice_rooms.participant_count("music") == 1

    async def test_leave(self):
        await voice_rooms.join(1, "lobby")
        await voice_rooms.leave(1)
        assert voice_rooms.participant_count("lobby") == 0
        assert 1 not in voice_rooms.user_room

    async def test_leave_not_in_room(self):
        await voice_rooms.leave(999)

    async def test_peers(self):
        await voice_rooms.join(1, "lobby")
        await voice_rooms.join(2, "lobby")
        peers = await voice_rooms.peers(1)
        assert 2 in peers
        assert 1 not in peers

    async def test_peers_not_in_room(self):
        peers = await voice_rooms.peers(999)
        assert peers == set()

    async def test_broadcast(self):
        await voice_rooms.join(1, "lobby")
        await voice_rooms.join(2, "lobby")
        with patch("services.voice_rooms.ws_manager.send_to_user", new=AsyncMock()) as mock_send:
            await voice_rooms.broadcast(1, {"type": "test"})
            mock_send.assert_called_once_with(2, {"type": "test"})

    async def test_broadcast_excludes_self(self):
        await voice_rooms.join(1, "lobby")
        with patch("services.voice_rooms.ws_manager.send_to_user", new=AsyncMock()) as mock_send:
            await voice_rooms.broadcast(1, {"type": "test"})
            mock_send.assert_not_called()
