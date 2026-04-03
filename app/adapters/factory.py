"""Factory for selecting an agent adapter by name."""

from __future__ import annotations

from app.adapters.base import BaseAdapter


def get_adapter(agent_type: str = "claude-cli") -> BaseAdapter:
    """Return an adapter instance for the given agent type.

    Supported values:
        "claude-cli"  → ClaudeCliAdapter (subprocess)
        "claude-sdk"  → ClaudeSdkAdapter (Agent SDK library)
    """
    if agent_type == "claude-cli":
        from app.adapters.claude_cli_adapter import ClaudeCliAdapter

        return ClaudeCliAdapter()

    if agent_type == "claude-sdk":
        from app.adapters.claude_sdk_adapter import ClaudeSdkAdapter

        return ClaudeSdkAdapter()

    raise ValueError(f"Unknown agent type: {agent_type!r}. Supported: 'claude-cli', 'claude-sdk'")
