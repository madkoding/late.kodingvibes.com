# late.kodingvibes.com — Global Context for LLM Agents

## Project
- **Repo root:** `.` — React shell (late-web-ui) + 2 microfront repos (radio, chat) + Icecast streaming infra
- **Domain:** https://late.kodingvibes.com
- **Github:** `git@github.com:kodingvibes/late.kodingvibes.com.git` (origin/main)
- **Local paths:**
  - Shell:    `/root/late.kodingvibes.com`
  - Radio:    `/root/late-micro-radio`
  - Chat:     `/root/late-micro-chat`

## Topology (v1.30.0+)

```
late.kodingvibes.com/                (this repo, the shell)
├── late-web-ui/                    React shell (header, nav, MiniPlayer, Home)
├── scripts/                        Build scripts (radio/chat/vendor + soma relays)
├── infra/icecast/                  Icecast config
└── services/chat-bridge/           chat-bridge (FastAPI, port 9100)

/root/late-micro-radio/              Repo independiente (Fase 2+: la radio completa)
   vite lib → /var/www/html/micro/radio/vX.Y.Z/entry.js + style.css

/root/late-micro-chat/               Repo independiente (Fase 3+: el chat completo)
   vite lib → /var/www/html/micro/chat/vX.Y.Z/entry.js + style.css

/var/www/html/vendor/vendor.js       React+ReactDOM bundleado (compartido shell+micros)
```

## Infrastructure Running on This Host (production)

| Service | Port | Notes |
|---------|------|-------|
| Icecast | 8000 | Docker container, config at `infra/icecast/icecast.xml` |
| nginx (host) | 80/443 | Static files + proxies streams → Icecast `:8000`, chat-bridge `:9100` |
| Vite (systemd, inactive) | 5173 | Dev server (inactive in prod; prod serves `/var/www/html/` static) |
| chat-bridge (Docker) | 9100 | REST + WebSocket. JWT verified via `SSO_BRIDGE_SECRET` (must match Vercel prod env). |
| late-deployd (systemd) | 9200 | GitHub webhook receiver. Exposed at `https://late.kodingvibes.com/deploy-webhook`. Auto-pulls + deploys on push to `main` for the managed repos. |
| late-micro-radio | (CDN) | Bundle ESM en `/micro/radio/vX.Y.Z/entry.js`. Posee `<audio>`, `AudioContext`, `AnalyserNode`. |
| late-micro-chat | (CDN) | Bundle ESM en `/micro/chat/vX.Y.Z/entry.js`. Posee voice rooms + WebSocket. |

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
- **Role system** (see `core/db.py` migrations + `core/auth.py::is_global_admin`):
  - `users.global_role` (column added on startup migration): `'super_admin'` | `'admin'` | `'user'` (default). Affects the whole platform, not a single channel.
  - `channel_members.role` (per-channel): `'admin'` | `'mod'` | `NULL`. Unchanged. Moderator (mod) still only works inside the channel where it's set.
  - `list_channels` returns `my_role='admin'` for any user whose `global_role IN ('super_admin','admin')`, on every channel — joined or not. Per-channel admin role is overridden by global admin in the response.
  - Admin actions (delete channel, change role, mute, move channel category) check `is_global_admin(session)` first; if false, fall back to the per-channel admin/mod check. PATCH `/api/chat/channels/{id}` and DELETE `/api/chat/channels/{id}` are gated.
  - Bootstrap: on first startup after the migration, `users.id = 1` is set to `super_admin` (idempotent). That's the original chat creator.

### Nginx Config
- `/etc/nginx/sites-enabled/late.kodingvibes.com`
- Routes stream mount names (regex) → `127.0.0.1:8000` (Icecast)
- Routes `/status` → `127.0.0.1:8000` (Icecast status)
- Routes `/api/chat/` → `127.0.0.1:9100` (chat-bridge)
- Serves static files from `/var/www/html/` (shell, micros, vendor, icons, fonts)
- Cache-Control: `immutable, 1 year` for `/assets/*`, `/fonts/*`, `/micro/*`, `/vendor/*`
- Cache-Control: `1 day` for root static assets (favicon, og-image, icons)
- Cache-Control: `no-cache` for `index.html`

## Web UI (React) — Three Pieces

### 1. Shell (`late-web-ui`, this repo)
- **Source:** `late-web-ui/src/` — currently: header, nav, `Home.tsx`, `MiniPlayer.tsx` (consume `window.RadioEngine`).
- **Routes:** `/` (Home), `/icecast` (renders `<div id="micro-radio-root" />`), `/irc` (renders `<div id="micro-chat-root" />`).
- **Served by:** nginx directly from `/var/www/html/`. `vite-spa.service` is **inactive** in production.
- **CRITICAL — build after EVERY frontend change:** see **Deploy checklist** below. Do not copy to `/var/www/html/` manually; the server-side auto-deploy handles that.
- **Typecheck only (faster sanity check before build):** `cd late-web-ui && npm run lint`
- **Versioning:** bump `APP_VERSION` in `late-web-ui/src/lib/version.ts` for EVERY change (feature or fix). It renders as a pill next to the site name in the header, so a hard-reload after deploy tells you at a glance whether the new bundle is live. Current: **v1.37.0**.
- **Dependencies:** `react`, `react-dom`, `react-router-dom`, `lucide-react`. The shell does NOT need `marked`, `dompurify`, `zustand`, `msw` — those live in the micros now.

### 2. late-micro-radio (`/root/late-micro-radio`, separate repo)
- **Stack:** Vite + React 18 + Tailwind 4, `build.lib` ESM with React externalized (resolved at runtime via the import map).
- **Owns:** `<audio>` element, `AudioContext`, `AnalyserNode`. Singleton lives in `window.RadioEngine`.
- **Mounts in:** `<div id="micro-radio-root">` (placed by the shell on `/icecast`).
- **Streams list:** 18 SomaFM channels in `src/data/streams.ts`.
- **UI:** `src/pages/Icecast/IcecastPage.tsx` with `MountCard` + `useIcecastStatus` (polls `/status-json.xsl` for listeners + metadata).
- **Metadata push:** `IcecastPage` calls `window.RadioEngine.setTrack({artist, title, raw})` on every status tick so the shell's MiniPlayer updates mid-play.
- **Build:** `bash scripts/build-micro-radio.sh` (rebuilds, rsyncs to `/var/www/html/micro/radio/vX.Y.Z/`). Current: **v0.1.0**.
- **Deploy checklist (after radio change):**
  1. Bump `version` in `/root/late-micro-radio/package.json`.
  2. Update `MICRO_RADIO_VERSION` constant in `late-web-ui/vite.config.ts` (the microfrontsPlugin).
  3. `bash scripts/build-micro-radio.sh` — bundle goes to `/var/www/html/micro/radio/vX.Y.Z/`.
  4. `cd late-web-ui && npm run build` — shell re-emits the new `<script src>`.

### 3. late-micro-chat (`/root/late-micro-chat`, separate repo)
- **Stack:** Vite + React 18 + Tailwind 4, lib ESM.
- **Owns:** chat-bridge WebSocket client, voice rooms (uses `window.RadioEngine.getAnalyser()` for visualizers).
- **Mounts in:** `<div id="micro-chat-root">` (placed by the shell on `/irc`).
- **UI:** `src/pages/Irc/IrcPage.tsx` + 30+ components in `src/components/irc/`. WebRTC voice rooms in `src/voice/`. Domain types in `src/lib/chat/`.
- **Build:** `bash scripts/build-micro-chat.sh`. Current: **v0.1.0**.
- **Deploy checklist (after chat change):** same pattern as radio.

### Shared React vendor
- `scripts/extract-vendor.sh` bundles React + ReactDOM + react-dom/client into a single `/var/www/html/vendor/vendor.js` (~200KB).
- `late-web-ui/index.html` registers an import map that points `react`, `react/jsx-runtime`, `react-dom`, `react-dom/client` → `/vendor/vendor.js`.
- The shell + both micros all resolve React through the import map. **One React instance in the page** — no broken hooks / refs across microfronts.

## Versioning (microfronts)
- Each micro has its own `version` field in `package.json`.
- The build scripts create versioned directories plus a `latest` symlink and a `latest.json` marker (`/micro/radio/latest.json`, `/micro/chat/latest.json`).
- The shell's `vite.config.ts` reads those `latest.json` files at build time and emits URLs like `/micro/radio/latest/entry.js?v=0.2.3`. The query string is a **cache-bust token**; nginx ignores it when serving the file. Safari (and other browsers with aggressive immutable caches) treat the changed query as a new URL and fetch the fresh bundle instead of reusing the old `entry.js` cached with `max-age=31536000, immutable`.
- Because the query string changes on every shell rebuild that picks up a new micro version, the shell must be rebuilt after any micro deploy (see checklist). The `latest` symlink lets the server swap the underlying file without touching `index.html`.

### Update notice and content-cache cleanup
- The shell's `UpdateNotice` polls `/version.json`, `/micro/radio/latest.json`, and `/micro/chat/latest.json` every 30 s.
- When a newer version is detected, it shows a toast; after a short grace period, or immediately when the user clicks **Actualizar**, it calls `applyUpdate()`:
  1. Deletes every entry in the browser's `CacheStorage` (application caches), **only** for late assets — never touches `localStorage` auth tokens or other site data.
  2. Removes `late.seen` (the UpdateNotice own version marker).
  3. Calls `location.reload()` so the browser fetches the latest `index.html`, `vendor/vendor.js`, `entry.js`, and CSS with no stale cached bundles.
- The auto-deploy on the server is now responsible for swapping the `latest` symlink and updating `latest.json`; the front only needs to clear its own content caches and reload.
- Safari/iOS historically keeps immutable HTTP-cache entries even after `caches.delete()`, so the `?v=` query string in `index.html` is the primary defense; the CacheStorage wipe is the secondary defense for PWA/offline caches.

## Deploy checklist (mandatory after EVERY change, no exceptions)
1. Bump the relevant version: `APP_VERSION` (shell) or `version` (micro package.json).
2. `bash scripts/extract-vendor.sh` if React/ReactDOM versions bumped (uncommon).
3. `bash scripts/build-micro-{radio,chat}.sh` for each micro that changed.
4. `cd late-web-ui && npm run build`
5. If chat-bridge changed: `bash /root/restart-chat-bridge.sh`
6. If Icecast config changed: `docker restart icecast`
7. If relay scripts changed: `bash scripts/start_soma_relays.sh` and/or restart metadata relay

## Commands (run from repo root)
## Auto-deploy (late-deployd)

Pushing to `main` on the managed repos triggers an automatic deploy on this host:

| Repo | Local path | Deploy action |
|------|------------|---------------|
| `kodingvibes/late.kodingvibes.com` | `/root/late.kodingvibes.com` | `git pull` → `extract-vendor.sh` → build shell → copy to `/var/www/html/` → restart chat-bridge Docker if `services/chat-bridge/` changed → `nginx -s reload`. |
| `kodingvibes/late-micro-radio` | `/root/late-micro-radio` | `git pull` → `scripts/build-micro-radio.sh` (versioned to `/var/www/html/micro/radio/...`). |
| `kodingvibes/late-micro-chat` | `/root/late-micro-chat` | `git pull` → `scripts/build-micro-chat.sh` (versioned to `/var/www/html/micro/chat/...`). |

Webhook endpoint: `https://late.kodingvibes.com/deploy-webhook`  
Health/logs: `https://late.kodingvibes.com/deploy-health`, `https://late.kodingvibes.com/deploy-logs`  
Service: `late-deployd.service` (systemd) running `services/deployd/main.py` on `127.0.0.1:9200`.  
Secret: `/root/.deployd.env` (`GITHUB_WEBHOOK_SECRET`).  
Logs: `/var/log/late-deployd/`.

Deploys are asynchronous (returns HTTP 202) so GitHub does not retry while a build runs. A per-repo lock prevents concurrent deploys of the same repo.

## Commands (run from repo root)
- **Manual deploy radio (fallback):** `bash scripts/build-micro-radio.sh`
- **Manual deploy chat (fallback):** `bash scripts/build-micro-chat.sh`
- **Manual deploy shell (fallback):** `cd late-web-ui && npm run build && rm -rf /var/www/html/assets /var/www/html/index.html && cp -r dist/. /var/www/html/ && nginx -s reload`
  - Only use this if the server-side auto-deploy is broken. Normally `npm run build` is enough because the deploy webhook copies the bundle.
- **Rebuild vendor:** `bash scripts/extract-vendor.sh`
- **Typecheck shell:** `cd late-web-ui && npm run lint`
- **Restart deployd:** `systemctl restart late-deployd`
- **View deployd logs:** `journalctl -u late-deployd -f`
- **Restart icecast:** `docker restart icecast`
- **Restart ffmpeg relays:** `bash scripts/start_soma_relays.sh`
- **Restart metadata relay:** `pkill -f soma_metadata_relay; python3 scripts/soma_metadata_relay.py > /tmp/soma_metadata_relay.log 2>&1 &`
- **Check Icecast status:** `curl -s http://127.0.0.1:8000/status-json.xsl | python3 -m json.tool`
- **Check all 18 channels have metadata:** `curl -s http://127.0.0.1:8000/status-json.xsl | python3 -c "import json,sys;d=json.load(sys.stdin);[print(s.get('listenurl','').split('/')[-1],repr(s.get('title',''))) for s in (d['icestats']['source'] if isinstance(d['icestats']['source'],list) else [d['icestats']['source']])]"`

## Removed / Disabled
- **late-ssh** (Rust API, port 4001): killed, code removed.
- **late-core, late-cli, late-web, late-nethack:** all removed from repo.
- **Postgres, Registry, Liquidsoap, LiveKit:** Docker containers stopped and removed.
- **Web pages:** Dashboard, Play, Gallery, Profiles, Connect — removed from React router. Only `/`, `/icecast`, and `/irc` remain.
- **sso-bridge** (`services/sso-bridge/`): IRC-era token issuer (aud: late.sh), code deleted.
- **Ergo IRC stack** (`infra/irc/`, `var-lib-ergo/`, `scripts/irc_bootstrap.py`): dead, deleted.
- **infra K8s docs** (`infra/README.md`, `.env.example`, `.gitignore`): deleted.
- **late-web-ui:prod** Docker image: removed (82MB). Prod serves static files via nginx.
- **sso-bridge:latest** Docker image: removed (212MB).
- **late-ssh assets** (`late-ssh/assets/nonograms/.number-loom-validation/`): dead.

## Migration Plan (DONE — v1.34.0)

- **Fase 0 (DONE, v1.30.0):** created the two repos with placeholder UIs, vendor + import map, end-to-end tested in playwright. The shell renders empty `<div id="micro-*-root">` slots on `/icecast` and `/irc`; the micros auto-mount via a `MutationObserver` watching for the slot.
- **Fase 1 (DONE, v1.31.0):** refactored `MiniPlayer.tsx` to consume `window.RadioEngine` via `useSyncExternalStore`. Dropped the legacy `AudioProvider` and `TrackMetadataSync` from the shell. Added `lib/radio-engine.ts` with `FALLBACK_STREAMS` so the shell renders before the micro loads.
- **Fase 2 (DONE, v1.32.0):** moved the real Icecast UI (`pages/Icecast/`, `streams.ts`, `RadioEngine.ts`, persistence, etc.) into `late-micro-radio` (v0.1.0). The shell's `pages/Icecast.tsx` is now a 5-line slot. Added `setTrack` to `RadioEngine` for mid-play metadata updates.
- **Fase 3 (DONE, v1.33.0):** moved the chat (`pages/Irc/`, `components/irc/*`, voice chain, `lib/chat`, `lib/irc`, `lib/{chat-notifs,emoji,image-prep,notification-sound}.ts`) into `late-micro-chat` (v0.1.0). The chat consumes `window.RadioEngine.getAnalyser()` for voice-room visualizers. Replaced the legacy `useAudio()` hook with a direct `window.RadioEngine` shim inside the IrcPage.
- **Fase 4 (DONE, v1.34.0):** cleaned the shell — `package.json` loses `marked`, `dompurify`, `msw`, `zustand`. Dropped `lib/chat`, `lib/irc`, `voice/`, `components/irc/`, `audio/{AudioProvider,TrackMetadataSync,persistence,presets,voiceChain,audio-engine}.ts`, `hooks/useAudioLevel.ts`. Removed the dev proxy for `/status-json.xsl` (now consumed by the micro). Removed `index.html` import map (micros externalize React via Vite, share the `/vendor/vendor.js`).
- **Fase 5 (DONE, v1.35.0):** `latest.json` + stable `/micro/{radio,chat}/latest/` URLs enable dynamic micro upgrades without shell redeploy. The front's `UpdateNotice` polls the three version markers and clears content caches before reloading.
