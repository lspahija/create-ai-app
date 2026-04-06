"""FastAPI backend."""

from __future__ import annotations

import logging
import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.api.auth import router as auth_router
from app.api.auth import verify_auth
from app.api.jobs import router as jobs_router
from app.api.jobs import shutdown as _shutdown_jobs
from app.api.settings import router as settings_router
from app.api.strategies import router as strategies_router
from app.config import PROJECT_ROOT

logger = logging.getLogger(__name__)


# ── Lifespan ─────────────────────────────────────────────────────────────


@asynccontextmanager
async def _lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Initialize logging and load .env on startup."""
    from app.log import setup_logging

    setup_logging()
    load_dotenv(PROJECT_ROOT / ".env", override=False)
    yield
    await _shutdown_jobs()


app = FastAPI(
    title="My App",
    version="0.1.0",
    lifespan=_lifespan,
    dependencies=[Depends(verify_auth)],
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


@app.get("/api/health")
async def health():
    from app.adapters import get_adapter
    from app.config import load_config

    config = load_config(PROJECT_ROOT / "config.yaml")
    adapter = get_adapter(config.default_agent)
    adapter_ok = await adapter.health_check()

    return {
        "status": "ok" if adapter_ok else "degraded",
        "adapter": config.default_agent,
        "adapter_healthy": adapter_ok,
    }


# ── Register routes ──────────────────────────────────────────────────────

app.include_router(auth_router)
app.include_router(jobs_router)
app.include_router(strategies_router)
app.include_router(settings_router)

# ── Static files (production) ────────────────────────────────────────────

_static_dir = PROJECT_ROOT / "web" / "dist"
if _static_dir.exists():
    _index_html = (_static_dir / "index.html").read_text()
    app.mount("/assets", StaticFiles(directory=str(_static_dir / "assets")), name="assets")
    _static_dir_resolved = _static_dir.resolve()

    @app.get("/{path:path}")
    async def spa_fallback(path: str):
        from fastapi.responses import FileResponse, HTMLResponse

        file_path = (_static_dir / path).resolve()
        if file_path.is_file() and str(file_path).startswith(str(_static_dir_resolved)):
            return FileResponse(file_path)
        return HTMLResponse(_index_html)
