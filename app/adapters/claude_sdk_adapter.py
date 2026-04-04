"""Claude Agent SDK adapter — uses the SDK library directly."""

from __future__ import annotations

import asyncio
import json
import time
from collections.abc import Callable
from pathlib import Path

from app.adapters.base import AgentResult, format_tool_result_content


class ClaudeSdkAdapter:
    """Runs Claude via the Agent SDK (programmatic, no subprocess)."""

    async def run(
        self,
        prompt: str,
        cwd: Path,
        timeout: int = 900,
        max_turns: int = 30,
        model: str | None = None,
        effort: str | None = None,
        on_stream: Callable[[str, str], None] | None = None,
    ) -> AgentResult:
        from claude_agent_sdk import (
            AssistantMessage,
            ClaudeAgentOptions,
            ResultMessage,
            TextBlock,
            ThinkingBlock,
            ToolResultBlock,
            ToolUseBlock,
            query,
        )

        options = ClaudeAgentOptions(
            permission_mode="bypassPermissions",
            max_turns=max_turns,
            cwd=str(cwd),
        )
        if model:
            options.model = model
        if effort:
            options.effort = effort

        result = AgentResult()
        start = time.monotonic()

        try:
            async with asyncio.timeout(timeout):
                async for message in query(prompt=prompt, options=options):
                    if isinstance(message, AssistantMessage):
                        if on_stream:
                            for block in message.content:
                                if isinstance(block, ThinkingBlock):
                                    on_stream("thinking", block.thinking)
                                elif isinstance(block, TextBlock):
                                    on_stream("text", block.text)
                                elif isinstance(block, ToolUseBlock):
                                    inp_str = json.dumps(block.input, indent=2)
                                    on_stream("tool_use", f"{block.name}\n{inp_str}")
                                elif isinstance(block, ToolResultBlock):
                                    on_stream(
                                        "tool_result",
                                        format_tool_result_content(block.content),
                                    )

                    elif isinstance(message, ResultMessage):
                        result.output = message.result or ""
                        result.exit_code = 1 if message.is_error else 0
                        result.metadata["cost_usd"] = message.total_cost_usd
                        result.metadata["num_turns"] = message.num_turns
                        result.metadata["session_id"] = message.session_id
                        result.metadata["subtype"] = message.subtype
                        result.metadata["duration_api_ms"] = message.duration_api_ms
                        if message.subtype == "error_max_turns":
                            result.metadata["max_turns_hit"] = True

        except TimeoutError:
            result.timed_out = True
            result.exit_code = -1
            result.error = f"Agent timed out after {timeout}s"
        except KeyboardInterrupt:
            result.exit_code = -2
            result.error = "Interrupted by user"
            result.metadata["interrupted"] = True

        result.duration_seconds = time.monotonic() - start
        return result

    async def health_check(self) -> bool:
        try:
            from claude_agent_sdk import query  # noqa: F401

            return True
        except ImportError:
            return False
