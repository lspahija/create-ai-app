"""Settings endpoints for OAuth token and configuration."""

from __future__ import annotations

import os

from fastapi import APIRouter
from pydantic import BaseModel

from app.config import PROJECT_ROOT

router = APIRouter()

_ENV_FILE = PROJECT_ROOT / ".env"


class SetTokenRequest(BaseModel):
    token: str


def _update_env_file(key: str, value: str | None) -> None:
    """Set or remove a key in the .env file."""
    lines: list[str] = []
    if _ENV_FILE.exists():
        lines = _ENV_FILE.read_text().splitlines(keepends=True)

    new_lines: list[str] = []
    found = False
    for line in lines:
        stripped = line.strip()
        if stripped.startswith(f"{key}=") or stripped.startswith(f"{key} ="):
            found = True
            if value is not None:
                new_lines.append(f"{key}={value}\n")
        else:
            new_lines.append(line if line.endswith("\n") else line + "\n")

    if not found and value is not None:
        new_lines.append(f"{key}={value}\n")

    _ENV_FILE.write_text("".join(new_lines))


@router.get("/api/settings")
async def get_settings():
    return {
        "oauth_token_set": bool(os.environ.get("CLAUDE_CODE_OAUTH_TOKEN")),
        "default_agent": os.environ.get("DEFAULT_AGENT", "claude-cli"),
    }


@router.put("/api/settings/oauth-token")
async def set_oauth_token(req: SetTokenRequest):
    os.environ["CLAUDE_CODE_OAUTH_TOKEN"] = req.token
    _update_env_file("CLAUDE_CODE_OAUTH_TOKEN", req.token)
    return {"ok": True}


@router.delete("/api/settings/oauth-token")
async def clear_oauth_token():
    os.environ.pop("CLAUDE_CODE_OAUTH_TOKEN", None)
    _update_env_file("CLAUDE_CODE_OAUTH_TOKEN", None)
    return {"ok": True}
