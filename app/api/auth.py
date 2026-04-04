"""JWT authentication — optional, enabled when AUTH_PASSWORD is set."""

from __future__ import annotations

import hashlib
import os
import secrets
from datetime import UTC, datetime, timedelta

import jwt
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

_AUTH_PASSWORD = os.environ.get("AUTH_PASSWORD", "")
_JWT_SECRET = os.environ.get(
    "JWT_SECRET", hashlib.sha256(_AUTH_PASSWORD.encode()).hexdigest() if _AUTH_PASSWORD else ""
)
_JWT_EXPIRY_DAYS = 30

router = APIRouter()


async def verify_auth(request: Request) -> None:
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


class _LoginRequest(BaseModel):
    password: str


@router.post("/api/auth/login")
async def auth_login(req: _LoginRequest):
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


@router.get("/api/auth/status")
async def auth_status():
    return {"auth_required": bool(_AUTH_PASSWORD)}
