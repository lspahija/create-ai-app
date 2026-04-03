"""Pydantic models for config.yaml."""

from __future__ import annotations

import logging
from pathlib import Path

import yaml
from pydantic import BaseModel

logger = logging.getLogger(__name__)


class Config(BaseModel):
    default_agent: str = "claude-cli"  # "claude-cli" (subprocess) or "claude-sdk" (Agent SDK)
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
