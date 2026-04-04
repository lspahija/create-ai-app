"""Load and validate strategy YAML files."""

from __future__ import annotations

import logging
from pathlib import Path

import yaml
from pydantic import ValidationError

from app.config import PROJECT_ROOT
from app.strategies.models import Strategy

logger = logging.getLogger(__name__)

STRATEGIES_DIR = PROJECT_ROOT / "strategies"


def load_strategy(name: str, strategies_dir: Path = STRATEGIES_DIR) -> Strategy:
    """Load a single strategy by name.

    Looks for {name}.yaml in the strategies directory.
    Raises FileNotFoundError if missing, ValueError on validation failure.
    """
    path = strategies_dir / f"{name}.yaml"
    if not path.exists():
        raise FileNotFoundError(f"Strategy not found: {path}")
    with open(path) as f:
        data = yaml.safe_load(f) or {}
    data.setdefault("name", name)
    try:
        return Strategy(**data)
    except ValidationError as e:
        raise ValueError(f"Invalid strategy {name}: {e}") from e


def list_strategies(strategies_dir: Path = STRATEGIES_DIR) -> list[str]:
    """Return names of all available strategies (filenames without .yaml)."""
    if not strategies_dir.exists():
        return []
    return sorted(p.stem for p in strategies_dir.glob("*.yaml"))


def load_all_strategies(strategies_dir: Path = STRATEGIES_DIR) -> dict[str, Strategy]:
    """Load all strategy YAML files. Skips invalid files with a warning."""
    strategies = {}
    for name in list_strategies(strategies_dir):
        try:
            strategies[name] = load_strategy(name, strategies_dir)
        except (ValueError, FileNotFoundError) as e:
            logger.warning("Skipping strategy %s: %s", name, e)
    return strategies
