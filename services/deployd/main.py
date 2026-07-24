#!/usr/bin/env python3
"""
late-deployd: GitHub webhook receiver that auto-deploys repos on push to main.

Endpoints:
  POST /deploy-webhook  -> receive GitHub push events (returns 202, deploys async)
  GET  /health          -> health check
  GET  /logs            -> list recent deploy logs

Environment (from /root/.deployd.env):
  GITHUB_WEBHOOK_SECRET  -> HMAC secret shared with GitHub webhooks
  LOG_DIR                -> where deploy logs are written
"""

import hashlib
import hmac
import json
import logging
import os
import subprocess
import sys
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, Header, HTTPException, Request

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
REPOS = {
    "late.kodingvibes.com": {
        "path": "/root/late.kodingvibes.com",
        "branch": "main",
        "deploy": "shell_and_backend",
    },
    "late-micro-radio": {
        "path": "/root/late-micro-radio",
        "branch": "main",
        "deploy": "micro_radio",
    },
    "late-micro-chat": {
        "path": "/root/late-micro-chat",
        "branch": "main",
        "deploy": "micro_chat",
    },
}

LOG_DIR = Path(os.environ.get("LOG_DIR", "/var/log/late-deployd"))
SECRET = os.environ.get("GITHUB_WEBHOOK_SECRET", "").encode()

APP = FastAPI(title="late-deployd")

LOG_DIR.mkdir(parents=True, exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("deployd")

# One lock per repo so concurrent pushes on the same repo queue instead of race.
LOCKS: dict[str, threading.Lock] = {name: threading.Lock() for name in REPOS}


def _env() -> dict:
    """Environment with Node from nvm available to all subprocesses."""
    return {"PATH": "/root/.nvm/versions/node/v24.18.0/bin:" + os.environ.get("PATH", "")}


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def verify_signature(body: bytes, signature: Optional[str]) -> bool:
    if not SECRET:
        logger.error("GITHUB_WEBHOOK_SECRET not configured")
        return False
    if not signature:
        return False
    prefix = "sha256="
    if not signature.startswith(prefix):
        return False
    expected = signature[len(prefix):].encode()
    digest = hmac.new(SECRET, body, hashlib.sha256).hexdigest().encode()
    return hmac.compare_digest(digest, expected)


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def write_deploy_log(repo_name: str, lines: list[str]) -> Path:
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    log_file = LOG_DIR / f"{repo_name}-{stamp}.log"
    log_file.write_text("\n".join(lines), encoding="utf-8")
    logger.info("deploy log written to %s", log_file)
    return log_file


def run(cmd: list[str], cwd: Optional[str] = None, extra_env: Optional[dict] = None) -> tuple[int, str, str]:
    env = {**os.environ, **_env(), **(extra_env or {})}
    proc = subprocess.run(cmd, cwd=cwd, env=env, capture_output=True, text=True)
    return proc.returncode, proc.stdout, proc.stderr


def git_pull(repo_path: str) -> tuple[int, list[str]]:
    log: list[str] = [f"[{now_iso()}] git pull --ff-only in {repo_path}"]
    rc, out, err = run(["git", "pull", "--ff-only"], cwd=repo_path)
    log.append(out.rstrip())
    if err:
        log.append(f"stderr: {err.rstrip()}")
    log.append(f"exit code: {rc}")
    return rc, log


def paths_changed(repo_path: str, prefixes: list[str]) -> bool:
    """Check whether the latest pull touched any of the given path prefixes."""
    ranges = ["HEAD@{1}..HEAD", "HEAD~1..HEAD"]
    prefix_filter = "|".join(f"^{p}" for p in prefixes)
    for rng in ranges:
        rc, out, err = run(
            ["bash", "-c", f"git diff --name-only {rng} | grep -qE '{prefix_filter}'"],
            cwd=repo_path,
        )
        if rc == 0:
            return True
        if "HEAD@{1}" in rng and "unknown revision" in (err or ""):
            continue
        break
    return False


def chat_bridge_changed(repo_path: str) -> bool:
    return paths_changed(repo_path, ["services/chat-bridge/"])


def deployd_changed(repo_path: str) -> bool:
    return paths_changed(repo_path, ["services/deployd/"])


def deploy_shell_and_backend(repo_path: str, log: list[str]) -> int:
    log.append(f"[{now_iso()}] extract vendor")
    rc, out, err = run(["bash", f"{repo_path}/scripts/extract-vendor.sh"])
    log.append(out.rstrip())
    if err:
        log.append(f"stderr: {err.rstrip()}")
    if rc != 0:
        log.append(f"vendor extract failed: {rc}")
        return rc

    log.append(f"[{now_iso()}] build shell")
    ui_dir = f"{repo_path}/late-web-ui"
    rc, out, err = run(["bash", "-c", "npm run build"], cwd=ui_dir)
    log.append(out.rstrip())
    if err:
        log.append(f"stderr: {err.rstrip()}")
    if rc != 0:
        log.append(f"shell build failed: {rc}")
        return rc

    log.append(f"[{now_iso()}] copy dist to /var/www/html")
    rc, out, err = run(
        ["bash", "-c", "rm -rf /var/www/html/assets /var/www/html/index.html && cp -r dist/. /var/www/html/"],
        cwd=ui_dir,
    )
    log.append(out.rstrip())
    if err:
        log.append(f"stderr: {err.rstrip()}")
    if rc != 0:
        log.append(f"copy failed: {rc}")
        return rc

    if chat_bridge_changed(repo_path):
        log.append(f"[{now_iso()}] chat-bridge changed; restarting container")
        rrc, rout, rerr = run(["bash", "/root/restart-chat-bridge.sh"])
        log.append(rout.rstrip())
        if rerr:
            log.append(f"stderr: {rerr.rstrip()}")
        if rrc != 0:
            log.append(f"chat-bridge restart failed: {rrc}")
            return rrc
    else:
        log.append(f"[{now_iso()}] chat-bridge not changed; skipping container restart")

    log.append(f"[{now_iso()}] reload nginx")
    rc, out, err = run(["nginx", "-s", "reload"])
    log.append(out.rstrip())
    if err:
        log.append(f"stderr: {err.rstrip()}")
    if rc != 0:
        log.append(f"nginx reload failed: {rc}")
        return rc

    if deployd_changed(repo_path):
        log.append("[{now_iso()}] deployd code changed; scheduling self-restart")
        run(["systemctl", "restart", "late-deployd"])

    return 0


def deploy_micro_radio(repo_path: str, log: list[str]) -> int:
    log.append(f"[{now_iso()}] build micro radio")
    rc, out, err = run(["bash", f"/root/late.kodingvibes.com/scripts/build-micro-radio.sh"])
    log.append(out.rstrip())
    if err:
        log.append(f"stderr: {err.rstrip()}")
    return rc


def deploy_micro_chat(repo_path: str, log: list[str]) -> int:
    log.append(f"[{now_iso()}] build micro chat")
    rc, out, err = run(["bash", f"/root/late.kodingvibes.com/scripts/build-micro-chat.sh"])
    log.append(out.rstrip())
    if err:
        log.append(f"stderr: {err.rstrip()}")
    return rc


DEPLOYERS = {
    "shell_and_backend": deploy_shell_and_backend,
    "micro_radio": deploy_micro_radio,
    "micro_chat": deploy_micro_chat,
}


def run_deploy(repo_name: str, config: dict, after: str, delivery: Optional[str]) -> None:
    with LOCKS[repo_name]:
        logger.info("[%s] start deploy for %s @ %s", delivery, repo_name, after)
        rc, log = git_pull(config["path"])
        if rc != 0:
            log.append(f"[{now_iso()}] git pull failed, aborting")
            write_deploy_log(repo_name, log)
            logger.error("[%s] git pull failed for %s", delivery, repo_name)
            return

        deploy_fn = DEPLOYERS[config["deploy"]]
        rc = deploy_fn(config["path"], log)
        log.append(f"[{now_iso()}] deploy finished with code {rc}")
        write_deploy_log(repo_name, log)
        if rc == 0:
            logger.info("[%s] deploy succeeded for %s", delivery, repo_name)
        else:
            logger.error("[%s] deploy failed for %s", delivery, repo_name)


# ---------------------------------------------------------------------------
# HTTP handlers
# ---------------------------------------------------------------------------
@APP.get("/health")
async def health() -> dict:
    return {"ok": True, "time": now_iso(), "repos": list(REPOS.keys())}


@APP.get("/logs")
async def logs(limit: int = 10) -> list:
    files = sorted(LOG_DIR.glob("*.log"), key=lambda p: p.stat().st_mtime, reverse=True)[:limit]
    return [
        {
            "name": f.name,
            "mtime": datetime.fromtimestamp(f.stat().st_mtime, tz=timezone.utc).isoformat(),
            "size": f.stat().st_size,
        }
        for f in files
    ]


@APP.post("/deploy-webhook")
async def deploy_webhook(
    request: Request,
    background: bool = True,
    x_hub_signature_256: Optional[str] = Header(default=None),
    x_github_event: Optional[str] = Header(default=None),
    x_github_delivery: Optional[str] = Header(default=None),
) -> dict:
    body = await request.body()

    if not verify_signature(body, x_hub_signature_256):
        logger.warning("invalid or missing signature; delivery=%s", x_github_delivery)
        raise HTTPException(status_code=401, detail="invalid signature")

    if x_github_event != "push":
        logger.info("ignored event: %s", x_github_event)
        return {"ok": True, "ignored": True, "event": x_github_event}

    payload = json.loads(body.decode("utf-8"))
    repo_full = payload.get("repository", {}).get("full_name", "")
    ref = payload.get("ref", "")
    after = payload.get("after", "")[:12]

    repo_name = repo_full.split("/")[-1]
    config = REPOS.get(repo_name)
    if not config:
        logger.info("repo not managed: %s", repo_full)
        return {"ok": True, "ignored": True, "repo": repo_full}

    expected_ref = f"refs/heads/{config['branch']}"
    if ref != expected_ref:
        logger.info("ignored ref for %s: %s", repo_name, ref)
        return {"ok": True, "ignored": True, "ref": ref}

    logger.info("accepted deploy %s @ %s (%s)", repo_name, after, x_github_delivery)

    # Run deploy asynchronously so GitHub gets a 202 immediately.
    thread = threading.Thread(
        target=run_deploy,
        args=(repo_name, config, after, x_github_delivery),
        daemon=True,
    )
    thread.start()

    return {
        "ok": True,
        "accepted": True,
        "repo": repo_name,
        "ref": ref,
        "after": after,
    }
