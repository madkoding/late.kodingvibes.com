#!/usr/bin/env python3
"""Poll SomaFM songs API and update icecast StreamTitle metadata.

Mount names now match the real SomaFM channel id they relay, so the
mapping is 1:1. The "dnb" mount is not present because SomaFM does not
offer a drum & bass channel.
"""
import asyncio
import base64
import json
import sys
import urllib.parse
import urllib.request

ICECAST_HOST = "127.0.0.1"
ICECAST_PORT = 8000
ICECAST_USER = "admin"
ICECAST_PASSWORD = "changeme"
ICECAST_VHOST = "late.kodingvibes.com"
MOUNTS = {
    "groovesalad": "groovesalad",
    "dronezone":   "dronezone",
    "fluid":       "fluid",
    "indiepop":    "indiepop",
    "u80s":        "u80s",
    "vaporwaves":  "vaporwaves",
    "metal":       "metal",
    "dubstep":     "dubstep",
    "7soul":       "7soul",
    "beatblender": "beatblender",
    "bootliquor":  "bootliquor",
    "doomed":      "doomed",
    "illstreet":   "illstreet",
    "lush":        "lush",
    "poptron":     "poptron",
    "secretagent": "secretagent",
    "suburbsofgoa":"suburbsofgoa",
    "thetrip":     "thetrip",
}

POLL_INTERVAL = 30  # seconds


def fetch_song(channel):
    url = "https://somafm.com/songs/" + channel + ".json"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "late.sh-meta/1.0"})
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read())
            songs = data.get("songs", [])
            if songs:
                s = songs[0]
                artist = (s.get("artist") or "").strip()
                title = (s.get("title") or "").strip()
                if artist and title:
                    return artist + " - " + title
                if title:
                    return title
    except Exception as e:
        print("[" + channel + "] fetch error: " + repr(e), flush=True)
    return None


def push_metadata(mount, song):
    import http.client
    song_enc = urllib.parse.quote(song, safe="")
    path = "/admin/metadata?mount=/" + mount + "&mode=updinfo&song=" + song_enc
    auth_raw = (ICECAST_USER + ":" + ICECAST_PASSWORD).encode("utf-8")
    auth = base64.b64encode(auth_raw).decode("ascii")
    try:
        conn = http.client.HTTPConnection(ICECAST_HOST, ICECAST_PORT, timeout=5)
        conn.request("GET", path, headers={
            "Authorization": "Basic " + auth,
            "Host": "late.kodingvibes.com:8000",
            "User-Agent": "late.sh-meta-relay/1.0",
        })
        resp = conn.getresponse()
        body = resp.read()[:200]
        conn.close()
        return resp.status, body
    except Exception as e:
        return None, repr(e)


async def poll_loop(mount, channel):
    last = None
    while True:
        song = await asyncio.get_event_loop().run_in_executor(None, fetch_song, channel)
        if song and song != last:
            status, body = await asyncio.get_event_loop().run_in_executor(None, push_metadata, mount, song)
            if status == 200:
                print("[" + mount + "] metadata updated: " + song, flush=True)
                last = song
            else:
                print("[" + mount + "] push failed: status=" + str(status) + " body=" + repr(body), flush=True)
        await asyncio.sleep(POLL_INTERVAL)


async def main():
    await asyncio.gather(*[poll_loop(m, c) for m, c in MOUNTS.items()])


if __name__ == "__main__":
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        loop.run_until_complete(main())
    except KeyboardInterrupt:
        pass
    finally:
        loop.close()
