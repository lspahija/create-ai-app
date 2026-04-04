"""Shared types for AI agent adapters."""

from __future__ import annotations

import json
from collections.abc import Callable
from dataclasses import dataclass, field
from pathlib import Path
from typing import Protocol


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

    def set_envelope(self, envelope: dict) -> None:
        """Populate metadata from a result envelope (shared by CLI and SDK adapters)."""
        self.output = envelope.get("result", self.output)
        self.metadata["cost_usd"] = envelope.get("total_cost_usd") or envelope.get("cost_usd")
        self.metadata["num_turns"] = envelope.get("num_turns")
        self.metadata["session_id"] = envelope.get("session_id")
        self.metadata["duration_api_ms"] = envelope.get("duration_api_ms")
        subtype = envelope.get("subtype", "")
        self.metadata["subtype"] = subtype
        if subtype == "error_max_turns":
            self.metadata["max_turns_hit"] = True
        elif envelope.get("is_error"):
            self.error = self.output
            self.exit_code = 1


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

    async def health_check(self) -> bool: ...


def format_tool_result_content(content) -> str:
    """Normalize tool_result content (may be list-of-dicts) to a plain string."""
    if isinstance(content, list):
        parts = [p.get("text", json.dumps(p)) if isinstance(p, dict) else str(p) for p in content]
        return "\n".join(parts)
    return str(content or "")
