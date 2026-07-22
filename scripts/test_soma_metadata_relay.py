#!/usr/bin/env python3
"""Tests for soma_metadata_relay.py"""
import json
import unittest
from unittest.mock import patch, MagicMock
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import soma_metadata_relay as relay


class TestFetchSong(unittest.TestCase):
    @patch("urllib.request.urlopen")
    def test_fetch_artist_and_title(self, mock_urlopen):
        mock_resp = MagicMock()
        mock_resp.read.return_value = json.dumps({
            "songs": [{"artist": "Artist", "title": "Track"}]
        }).encode()
        mock_urlopen.return_value.__enter__.return_value = mock_resp
        result = relay.fetch_song("groovesalad")
        self.assertEqual(result, "Artist - Track")

    @patch("urllib.request.urlopen")
    def test_fetch_title_only(self, mock_urlopen):
        mock_resp = MagicMock()
        mock_resp.read.return_value = json.dumps({
            "songs": [{"title": "Only Track"}]
        }).encode()
        mock_urlopen.return_value.__enter__.return_value = mock_resp
        result = relay.fetch_song("dronezone")
        self.assertEqual(result, "Only Track")

    @patch("urllib.request.urlopen")
    def test_fetch_empty_songs(self, mock_urlopen):
        mock_resp = MagicMock()
        mock_resp.read.return_value = json.dumps({"songs": []}).encode()
        mock_urlopen.return_value.__enter__.return_value = mock_resp
        result = relay.fetch_song("fluid")
        self.assertIsNone(result)

    @patch("urllib.request.urlopen")
    def test_fetch_no_songs_key(self, mock_urlopen):
        mock_resp = MagicMock()
        mock_resp.read.return_value = json.dumps({}).encode()
        mock_urlopen.return_value.__enter__.return_value = mock_resp
        result = relay.fetch_song("indiepop")
        self.assertIsNone(result)

    @patch("urllib.request.urlopen", side_effect=Exception("timeout"))
    def test_fetch_error(self, mock_urlopen):
        result = relay.fetch_song("metal")
        self.assertIsNone(result)


class TestPushMetadata(unittest.TestCase):
    @patch("http.client.HTTPConnection")
    def test_push_success(self, mock_conn_class):
        mock_conn = MagicMock()
        mock_resp = MagicMock()
        mock_resp.status = 200
        mock_resp.read.return_value = b"OK"
        mock_conn.getresponse.return_value = mock_resp
        mock_conn_class.return_value = mock_conn
        status, body = relay.push_metadata("groovesalad", "Artist - Track")
        self.assertEqual(status, 200)
        self.assertEqual(body, b"OK")

    @patch("http.client.HTTPConnection")
    def test_push_failure(self, mock_conn_class):
        mock_conn = MagicMock()
        mock_resp = MagicMock()
        mock_resp.status = 500
        mock_resp.read.return_value = b"Error"
        mock_conn.getresponse.return_value = mock_resp
        mock_conn_class.return_value = mock_conn
        status, body = relay.push_metadata("groovesalad", "Artist - Track")
        self.assertEqual(status, 500)

    @patch("http.client.HTTPConnection", side_effect=Exception("connection refused"))
    def test_push_exception(self, mock_conn_class):
        status, body = relay.push_metadata("groovesalad", "Artist - Track")
        self.assertIsNone(status)
        self.assertIsNotNone(body)


class TestPollLoop(unittest.TestCase):
    @patch("soma_metadata_relay.fetch_song", return_value="Artist - Track")
    @patch("soma_metadata_relay.push_metadata", return_value=(200, b"OK"))
    @patch("soma_metadata_relay.asyncio.sleep")
    def test_poll_updates_metadata(self, mock_sleep, mock_push, mock_fetch):
        import asyncio
        mock_sleep.side_effect = asyncio.CancelledError()
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        with self.assertRaises(asyncio.CancelledError):
            loop.run_until_complete(relay.poll_loop("groovesalad", "groovesalad"))
        loop.close()
        mock_push.assert_called_once()

    @patch("soma_metadata_relay.fetch_song", return_value=None)
    @patch("soma_metadata_relay.push_metadata")
    @patch("soma_metadata_relay.asyncio.sleep")
    def test_poll_no_metadata_skips_push(self, mock_sleep, mock_push, mock_fetch):
        import asyncio
        mock_sleep.side_effect = asyncio.CancelledError()
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        with self.assertRaises(asyncio.CancelledError):
            loop.run_until_complete(relay.poll_loop("groovesalad", "groovesalad"))
        loop.close()
        mock_push.assert_not_called()


class TestMounts(unittest.TestCase):
    def test_mounts_count(self):
        self.assertEqual(len(relay.MOUNTS), 18)

    def test_mounts_have_expected_keys(self):
        expected = {
            "groovesalad", "dronezone", "fluid", "indiepop", "u80s",
            "vaporwaves", "metal", "dubstep", "7soul", "beatblender",
            "bootliquor", "doomed", "illstreet", "lush", "poptron",
            "secretagent", "suburbsofgoa", "thetrip",
        }
        self.assertEqual(set(relay.MOUNTS.keys()), expected)


if __name__ == "__main__":
    unittest.main()
