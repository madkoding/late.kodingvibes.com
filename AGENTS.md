# late.kodingvibes.com — Global Context for LLM Agents

## Project
- **Repo root:** `.` — Solo React SPA (late-web-ui) + Icecast streaming infra
- **Domain:** https://late.kodingvibes.com
- **Github:** `git@github.com:madkoding/late.kodingvibes.com.git` (origin/main)
- **Local path:** `/root/late.kodingvibes.com`

## Infrastructure Running on This Host (production)

| Service | Port | Notes |
|---------|------|-------|
| Icecast | 8000 | Docker container, config at `infra/icecast/icecast.xml` |
| nginx (host) | 80/443 | Proxies SPA → Vite dev server `:5173`, proxies streams → Icecast `:8000` |
| Vite (systemd, inactive) | 5173 | Dev server for code review; prod serves from /var/www/html/ (nginx reads static files directly) |

### SomaFM Relays (18 channels)
- ffmpeg relays running via `scripts/soma_relay_one.sh` (started by `scripts/start_soma_relays.sh`)
- Metadata relay: `scripts/soma_metadata_relay.py` (polls SomaFM API → pushes to Icecast `/admin/metadata`)
- All 18 channels: groovesalad, dronezone, fluid, indiepop, u80s, vaporwaves, metal, dubstep, 7soul, beatblender, bootliquor, doomed, illstreet, lush, poptron, secretagent, suburbsofgoa, thetrip

### Icecast Admin
- Admin user: `admin`
- Admin password: `changeme`
- Config: `infra/icecast/icecast.xml` (bind-mounted in Docker)

### Chat-bridge (REST + WebSocket on :9100)
- **Docker image:** `chat-bridge:dev`, source at `services/chat-bridge/app.py`
- **Run command (preserves DB and restart policy):**
  ```bash
  bash /root/restart-chat-bridge.sh
  ```
  The env vars (SSO_BRIDGE_SECRET, SQLITE_PATH, ATTACHMENT_DIR) are persisted in `/root/.env.backup` — never generate a new random secret or the JWT validation breaks.
- **Restart script:** `/root/restart-chat-bridge.sh` — rebuilds image, reads env from `/root/.env.backup`, starts container.
- **Build image:** `docker build -t chat-bridge:dev services/chat-bridge/`
- SQLite lives at `/data/chat-bridge/chat.db` (bind mount so it survives container restarts).
- **JWT shape it accepts:** HS256, `aud: "late.kodingvibes.com"`, `iss: "kodingvibes.com"`, signed with `SSO_BRIDGE_SECRET`.
- **CRITICAL:** `SSO_BRIDGE_SECRET` MUST match the one in Vercel (kodingvibes project, prod env). If they drift, every exchange returns 401 and the front enters a redirect loop. To rotate: pick a new value, `vercel env rm SSO_BRIDGE_SECRET production --yes && vercel env add SSO_BRIDGE_SECRET production` in the kodingvibes repo, `vercel deploy --prod`, then update `/root/.env.backup` and restart the container.

### Nginx Config
- `/etc/nginx/sites-enabled/late.kodingvibes.com`
- Routes stream mount names (regex) → `127.0.0.1:8000` (Icecast)
- Routes `/status` → `127.0.0.1:8000` (Icecast status)
- Proxies SPA → `127.0.0.1:5173` (Vite dev server)
- Cache-Control: `immutable, 1 year` for `/assets/*` and `/fonts/*`
- Cache-Control: `1 day` for root static assets (favicon, og-image, icons)
- Cache-Control: `no-cache` for `index.html`

### Removed / Disabled
- **late-ssh** (Rust API, port 4001): killed, code removed.
- **late-core, late-cli, late-web, late-nethack:** all removed from repo.
- **Postgres, Registry, Liquidsoap, LiveKit:** Docker containers stopped and removed.
- **Web pages:** Dashboard, Play, Gallery, Profiles, Connect — removed from React router. Only `/icecast` and `/irc` remain.
- **sso-bridge** (`services/sso-bridge/`): IRC-era token issuer (aud: late.sh), code deleted.
- **Ergo IRC stack** (`infra/irc/`, `var-lib-ergo/`, `scripts/irc_bootstrap.py`): dead, deleted.
- **infra K8s docs** (`infra/README.md`, `.env.example`, `.gitignore`): deleted.
- **late-web-ui:prod** Docker image: removed (82MB). Prod serves static files via nginx.
- **sso-bridge:latest** Docker image: removed (212MB).

## Web UI (React)
- **Source:** `late-web-ui/src/pages/Icecast.tsx` (and `Irc.tsx` for the chat-bridge client)
- **Served by:** nginx (host) directly from `/var/www/html/`. The `vite-spa.service` is **inactive** in production — HMR is NOT available.
- **CRITICAL — build + copy after EVERY frontend change, no exceptions:**
  ```bash
  cd late-web-ui
  npm run build
  rm -rf /var/www/html/assets /var/www/html/index.html
  cp -r dist/. /var/www/html/
  nginx -s reload
  ```
  We removed the Docker indirection — the host already has node 20+ and `node_modules` is checked into the workflow.
- **Typecheck only (faster sanity check before build):** `cd late-web-ui && npm run lint`
- **Versioning:** bump `APP_VERSION` in `late-web-ui/src/lib/version.ts` for every user-visible change (feature or fix). It renders as a pill next to the site name in the header, so a hard-reload after deploy tells you at a glance whether the new bundle is live. Current: **v1.6.2**.
- **Channels:** 18 entries in `SOURCE_LABELS` constant, each with emoji/color/accent
- **Metadata:** Fetched directly from `/status-json.xsl` (Icecast status via nginx proxy), parses `title` field as "Artist - Track"
- **Audio playback:** Uses `<audio>` element pointing to `https://late.kodingvibes.com/{mount}`
- **Spectrum analyzer:** Web Audio API with AnalyserNode on fftSize=64, drawn on canvas
- **Icons:** Coffee cup favicon/icon set (coffee.svg, favicon.ico, android-chrome-*.png, apple-touch-icon.png)

## Commands (run from repo root)
- **Rebuild web UI (mandatory after any frontend change):** `cd late-web-ui && npm run build && rm -rf /var/www/html/assets /var/www/html/index.html && cp -r dist/. /var/www/html/ && nginx -s reload`
- **Typecheck only (faster, no build):** `cd late-web-ui && npm run lint`
- Restart icecast: `docker restart icecast`
- Restart ffmpeg relays: `bash scripts/start_soma_relays.sh`
- Restart metadata relay: `pkill -f soma_metadata_relay; python3 scripts/soma_metadata_relay.py > /tmp/soma_metadata_relay.log 2>&1 &`
- Check Icecast status: `curl -s http://127.0.0.1:8000/status-json.xsl | python3 -m json.tool`
- Check all 18 channels have metadata: `curl -s http://127.0.0.1:8000/status-json.xsl | python3 -c "import json,sys;d=json.load(sys.stdin);[print(s.get('listenurl','').split('/')[-1],repr(s.get('title',''))) for s in (d['icestats']['source'] if isinstance(d['icestats']['source'],list) else [d['icestats']['source']])]"`

## Repo Structure
```
./
├── late-web-ui/          ← React SPA (Icecast player)
│   ├── src/pages/Icecast.tsx
│   └── public/           ← Icons, locales, fonts
├── scripts/              ← Relay scripts (3 files)
│   ├── soma_relay_one.sh
│   ├── start_soma_relays.sh
│   └── soma_metadata_relay.py
├── infra/icecast/        ← Icecast config
│   └── icecast.xml
├── services/             ← Chat-bridge
│   └── chat-bridge/
│       └── app.py
├── .git/
└── .gitignore
```
