# late.kodingvibes.com

[![Version](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Fkodingvibes%2Flate.kodingvibes.com%2Fmain%2Flate-web-ui%2Fsrc%2Flib%2Fversion.ts&query=%24.APP_VERSION&label=app&color=%23111)]()
[![License](https://img.shields.io/badge/license-MIT-111?style=flat)]()
[![Icecast](https://img.shields.io/badge/icecast-2.4-111?style=flat)]()

Solo React SPA + Icecast streaming infra running 18 SomaFM radio channels.

## Stack

| Component | What | Port |
|-----------|------|------|
| **Icecast** | Audio streaming server (Docker) | `:8000` |
| **late-web-ui** | React + Vite + Tailwind v4 SPA | `:5173` (dev) |
| **Chat-bridge** | FastAPI + WebSocket IRC bridge (Docker) | `:9100` |
| **Nginx** | Reverse proxy: SPA + streams + status | `:80/443` |

## Quick Start

### Web UI (dev)
```bash
cd late-web-ui
npm install
npm run dev
```

### Build & deploy
```bash
cd late-web-ui && npm run build
rm -rf /var/www/html/assets /var/www/html/index.html
cp -r dist/. /var/www/html/ && nginx -s reload
```

### Start relays
```bash
bash scripts/start_soma_relays.sh           # 18 ffmpeg → Icecast
python3 scripts/soma_metadata_relay.py &    # SomaFM metadata → Icecast
```

### Chat-bridge
```bash
docker run -d --name chat-bridge --restart unless-stopped \
  -p 9100:9100 \
  -e SSO_BRIDGE_SECRET="$(openssl rand -hex 32)" \
  -e SQLITE_PATH=/data/chat-bridge/chat.db \
  -e ATTACHMENT_DIR=/var/lib/late-attachments \
  -v $(pwd)/services/chat-bridge:/app \
  -v /data/chat-bridge:/data/chat-bridge \
  -v /var/lib/late-attachments:/var/lib/late-attachments \
  chat-bridge:dev
```

## Channels

groovesalad · dronezone · fluid · indiepop · u80s · vaporwaves · metal · dubstep · 7soul · beatblender · bootliquor · doomed · illstreet · lush · poptron · secretagent · suburbsofgoa · thetrip

## Structure

```
├── late-web-ui/          React SPA (Icecast player + IRC client)
│   ├── src/pages/         Icecast.tsx, Irc.tsx
│   └── public/            Icons, locales, fonts
├── scripts/               Relay management
│   ├── soma_relay_one.sh  Single ffmpeg relay
│   ├── start_soma_relays.sh  All 18 relays
│   └── soma_metadata_relay.py  SomaFM → Icecast metadata
├── infra/icecast/         Icecast config
├── services/
│   └── chat-bridge/       FastAPI + WebSocket IRC bridge
└── AGENTS.md              LLM context
```

## Commands

| Action | Command |
|--------|---------|
| Restart Icecast | `docker restart icecast` |
| Restart relays | `bash scripts/start_soma_relays.sh` |
| Restart metadata | `pkill -f soma_metadata_relay; python3 scripts/soma_metadata_relay.py &` |
| Check status | `curl -s http://127.0.0.1:8000/status-json.xsl \| python3 -m json.tool` |
| Check metadata | `curl -s http://127.0.0.1:8000/status-json.xsl \| python3 -c "import json,sys;d=json.load(sys.stdin);[print(s.get('listenurl','').split('/')[-1],repr(s.get('title',''))) for s in (d['icestats']['source'] if isinstance(d['icestats']['source'],list) else [d['icestats']['source']])]"` |
| Lint | `cd late-web-ui && npm run lint` |

## License

MIT
