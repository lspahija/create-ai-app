"""App configuration."""

from __future__ import annotations

import logging
from pathlib import Path

import yaml
from pydantic import BaseModel

logger = logging.getLogger(__name__)

PROJECT_ROOT = Path(__file__).parent.parent


class Config(BaseModel):
    default_agent: str = "claude-cli"  # "claude-cli" (subprocess) or "claude-sdk" (Agent SDK)
    agent_model: str = "claude-opus-4-6"
    agent_effort: str = "max"
    agent_max_turns: int = 30
    agent_timeout_seconds: int = 900


def load_config(path: str | Path = "config.yaml") -> Config:
    path = Path(path)
    if not path.exists():
        logger.warning("Config file not found: %s — using defaults", path)
        return Config()
    with open(path) as f:
        data = yaml.safe_load(f) or {}
    return Config(**data)
