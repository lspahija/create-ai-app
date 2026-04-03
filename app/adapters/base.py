"""Shared types for AI agent adapters."""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from pathlib import Path
from typing import Callable, Protocol


@dataclass
class AgentResult:
    """Result from running an agent."""

    output: str = ""
    exit_code: int = 0
    duration_seconds: float = 0.0
    timed_out: bool = False
    error: str = ""
    metadata: dict = field(default_factory=dict)

    @property
    def success(self) -> bool:
        return self.exit_code == 0 and not self.timed_out


class BaseAdapter(Protocol):
    """Interface that all agent adapters must implement."""

    async def run(
        self,
        prompt: str,
        cwd: Path,
        timeout: int = 900,
        max_turns: int = 30,
        model: str | None = None,
        effort: str | None = None,
        on_stream: Callable[[str, str], None] | None = None,
    ) -> AgentResult: ...

    def health_check(self) -> bool: ...


def run_sync(adapter: BaseAdapter, **kwargs) -> AgentResult:
    """Convenience wrapper to call an async adapter from sync code."""
    return asyncio.run(adapter.run(**kwargs))
