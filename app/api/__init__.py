"""FastAPI backend."""

from __future__ import annotations

import hashlib
import logging
import os
import secrets
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import UTC, datetime, timedelta

import jwt
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from app.api.helpers import PROJECT_ROOT

logger = logging.getLogger(__name__)

# ── Optional Auth (JWT) ───────────────────────────────────────────────────

_AUTH_PASSWORD = os.environ.get("AUTH_PASSWORD", "")
_JWT_SECRET = os.environ.get(
    "JWT_SECRET", hashlib.sha256(_AUTH_PASSWORD.encode()).hexdigest() if _AUTH_PASSWORD else ""
)
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
        raise HTTPException(status_code=401, detail="Token expired") from None
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token") from None


# ── Lifespan ─────────────────────────────────────────────────────────────


@asynccontextmanager
async def _lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Initialize logging and load .env on startup."""
    from app.log import setup_logging

    setup_logging()
    load_dotenv(PROJECT_ROOT / ".env", override=False)
    yield


app = FastAPI(
    title="My App",
    version="0.1.0",
    lifespan=_lifespan,
    dependencies=[Depends(_verify_auth)],
)

_CORS_ORIGINS = [o.strip() for o in os.environ.get("CORS_ORIGINS", "").split(",") if o.strip()]
if _CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=_CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
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
        {"exp": datetime.now(UTC) + timedelta(days=_JWT_EXPIRY_DAYS)},
        _JWT_SECRET,
        algorithm="HS256",
    )
    return {"token": token}


@app.get("/api/auth/status")
def auth_status():
    return {"auth_required": bool(_AUTH_PASSWORD)}


@app.get("/api/health")
def health():
    from app.adapters import get_adapter
    from app.config import load_config

    config = load_config(PROJECT_ROOT / "config.yaml")
    adapter = get_adapter(config.default_agent)
    adapter_ok = adapter.health_check()

    return {
        "status": "ok" if adapter_ok else "degraded",
        "adapter": config.default_agent,
        "adapter_healthy": adapter_ok,
    }


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
