"""FastAPI backend."""

from __future__ import annotations

import hashlib
import logging
import os
import secrets
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone

import jwt
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from app.api.helpers import PROJECT_ROOT

logger = logging.getLogger(__name__)

# ── Optional Auth (JWT) ───────────────────────────────────────────────────

_AUTH_PASSWORD = os.environ.get("AUTH_PASSWORD", "")
_JWT_SECRET = hashlib.sha256(_AUTH_PASSWORD.encode()).hexdigest() if _AUTH_PASSWORD else ""
_JWT_EXPIRY_DAYS = 30


def _verify_auth(request: Request) -> None:
    """Enforce JWT auth when AUTH_PASSWORD env var is set."""
    if not request.url.path.startswith("/api"):
        return
    if request.url.path.startswith("/api/auth/"):
        return
    if not _AUTH_PASSWORD:
        return
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication required")
    token = auth_header[7:]
    try:
        jwt.decode(token, _JWT_SECRET, algorithms=["HS256"])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")


# ── Lifespan ─────────────────────────────────────────────────────────────

@asynccontextmanager
async def _lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Initialize logging and load .env on startup."""
    from app.log import setup_logging
    setup_logging()
    env_path = PROJECT_ROOT / ".env"
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, _, value = line.partition("=")
            os.environ.setdefault(key.strip(), value.strip())
    yield


app = FastAPI(
    title="My App",
    version="0.1.0",
    lifespan=_lifespan,
    dependencies=[Depends(_verify_auth)],
)


# ── Auth endpoints (public) ──────────────────────────────────────────────


class _LoginRequest(BaseModel):
    password: str


@app.post("/api/auth/login")
def auth_login(req: _LoginRequest):
    if not _AUTH_PASSWORD:
        return {"token": ""}
    if not secrets.compare_digest(req.password.encode(), _AUTH_PASSWORD.encode()):
        raise HTTPException(status_code=401, detail="Invalid password")
    token = jwt.encode(
        {"exp": datetime.now(timezone.utc) + timedelta(days=_JWT_EXPIRY_DAYS)},
        _JWT_SECRET,
        algorithm="HS256",
    )
    return {"token": token}


@app.get("/api/auth/status")
def auth_status():
    return {"auth_required": bool(_AUTH_PASSWORD)}


@app.get("/api/health")
def health():
    return {"status": "ok"}


# ── Register routes ──────────────────────────────────────────────────────

from app.api.jobs import router as jobs_router  # noqa: E402

app.include_router(jobs_router)

# ── Static files (production) ────────────────────────────────────────────

_static_dir = PROJECT_ROOT / "web" / "dist"
if _static_dir.exists():
    _index_html = (_static_dir / "index.html").read_text()
    app.mount("/assets", StaticFiles(directory=str(_static_dir / "assets")), name="assets")
    _static_dir_resolved = _static_dir.resolve()

    @app.get("/{path:path}")
    def spa_fallback(path: str):
        from fastapi.responses import FileResponse, HTMLResponse
        file_path = (_static_dir / path).resolve()
        if file_path.is_file() and str(file_path).startswith(str(_static_dir_resolved)):
            return FileResponse(file_path)
        return HTMLResponse(_index_html)
