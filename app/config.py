"""App configuration."""

from __future__ import annotations

import logging
from pathlib import Path

import yaml
from pydantic import BaseModel

logger = logging.getLogger(__name__)

PROJECT_ROOT = Path(__file__).parent.parent


class Config(BaseModel):
    default_agent: str = "claude-cli"  # used by health check


def load_config(path: str | Path = "config.yaml") -> Config:
    path = Path(path)
    if not path.exists():
        logger.warning("Config file not found: %s — using defaults", path)
        return Config()
    with open(path) as f:
        data = yaml.safe_load(f) or {}
    return Config(**data)
