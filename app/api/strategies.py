"""Strategy CRUD endpoints."""

from __future__ import annotations

import re
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.strategies.models import ExecutionPolicy, PromptConfig

router = APIRouter()

_NAME_RE = re.compile(r"^[a-z0-9][a-z0-9-]*$")


# ── Request / response models ──────────────────────────────────────────


class _StrategyBody(BaseModel):
    description: str = ""
    prompt: PromptConfig
    agent: str = "claude-cli"
    model: str | None = None
    max_turns: int | None = None
    timeout: int = 900
    options: dict[str, Any] = Field(default_factory=dict)
    execution: ExecutionPolicy = Field(default_factory=ExecutionPolicy)


class StrategyCreateRequest(_StrategyBody):
    name: str


class StrategyUpdateRequest(_StrategyBody):
    pass


class StrategyResponse(BaseModel):
    name: str
    description: str
    prompt: PromptConfig
    agent: str
    model: str | None
    max_turns: int | None
    timeout: int
    options: dict[str, Any]
    execution: ExecutionPolicy
    variables: list[str]


# ── Helpers ─────────────────────────────────────────────────────────────


def _strategy_response(s: Any) -> dict:
    from app.strategies.templates import extract_variables

    return StrategyResponse(
        **s.model_dump(),
        variables=extract_variables(s.prompt),
    ).model_dump()


def _validate_name(name: str) -> None:
    if not _NAME_RE.match(name):
        raise HTTPException(
            422,
            "Strategy name must be lowercase alphanumeric with hyphens (e.g. 'my-strategy')",
        )


# ── Endpoints ───────────────────────────────────────────────────────────


@router.get("/api/strategies")
async def list_strategies():
    from app.strategies.loader import load_all_strategies

    strategies = load_all_strategies()
    return [_strategy_response(s) for s in strategies.values()]


@router.get("/api/strategies/{name}")
async def get_strategy(name: str):
    from app.strategies.loader import load_strategy

    try:
        s = load_strategy(name)
    except FileNotFoundError:
        raise HTTPException(404, f"Strategy not found: {name}") from None
    return _strategy_response(s)


@router.post("/api/strategies", status_code=201)
async def create_strategy(req: StrategyCreateRequest):
    from app.strategies.loader import STRATEGIES_DIR, save_strategy
    from app.strategies.models import Strategy

    _validate_name(req.name)
    path = STRATEGIES_DIR / f"{req.name}.yaml"
    if path.exists():
        raise HTTPException(409, f"Strategy already exists: {req.name}")

    strategy = Strategy(name=req.name, **req.model_dump(exclude={"name"}))
    save_strategy(strategy)
    return _strategy_response(strategy)


@router.put("/api/strategies/{name}")
async def update_strategy(name: str, req: StrategyUpdateRequest):
    from app.strategies.loader import STRATEGIES_DIR, save_strategy
    from app.strategies.models import Strategy

    path = STRATEGIES_DIR / f"{name}.yaml"
    if not path.exists():
        raise HTTPException(404, f"Strategy not found: {name}")

    strategy = Strategy(name=name, **req.model_dump())
    save_strategy(strategy)
    return _strategy_response(strategy)


@router.delete("/api/strategies/{name}", status_code=204)
async def delete_strategy_endpoint(name: str):
    from app.strategies.loader import delete_strategy

    try:
        delete_strategy(name)
    except FileNotFoundError:
        raise HTTPException(404, f"Strategy not found: {name}") from None
