"""Execute a strategy using the adapter layer."""

from __future__ import annotations

import asyncio
import json
import logging
import os
from collections.abc import Callable
from pathlib import Path

from app.adapters import get_adapter
from app.adapters.base import AgentResult
from app.config import Config
from app.strategies.models import Strategy
from app.strategies.templates import render_prompt

logger = logging.getLogger(__name__)


def _resolve_config(strategy: Strategy, global_config: Config) -> dict:
    """Merge strategy agent overrides onto global config. Returns adapter kwargs."""
    ov = strategy.agent
    return {
        "agent_type": ov.agent_type or global_config.default_agent,
        "model": ov.model or global_config.agent_model,
        "effort": ov.effort or global_config.agent_effort,
        "max_turns": ov.max_turns or global_config.agent_max_turns,
        "timeout": ov.timeout or global_config.agent_timeout_seconds,
    }


def _build_env(strategy: Strategy) -> dict[str, str]:
    """Build environment variable dict for the agent process."""
    env = dict(strategy.env)
    if strategy.team:
        env["CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS"] = "1"
    return env


def _write_subagent_settings(strategy: Strategy, cwd: Path) -> Path | None:
    """Write subagent definitions to .claude/settings.local.json if needed.

    Uses settings.local.json (typically gitignored) to avoid clobbering
    the project's own settings.json.
    """
    if not strategy.subagents:
        return None

    claude_dir = cwd / ".claude"
    claude_dir.mkdir(exist_ok=True)
    settings_path = claude_dir / "settings.local.json"

    existing = {}
    if settings_path.exists():
        with open(settings_path) as f:
            existing = json.load(f)

    subagents = []
    for sa in strategy.subagents:
        entry: dict = {"name": sa.name, "description": sa.description}
        if sa.model:
            entry["model"] = sa.model
        if sa.prompt:
            entry["prompt"] = sa.prompt
        if sa.tools:
            entry["tools"] = sa.tools
        subagents.append(entry)

    existing["subagents"] = subagents
    with open(settings_path, "w") as f:
        json.dump(existing, f, indent=2)

    return settings_path


class _EnvScope:
    """Context manager that sets env vars and restores originals on exit."""

    def __init__(self, env_vars: dict[str, str]):
        self._env_vars = env_vars
        self._originals: dict[str, str | None] = {}

    def __enter__(self):
        for key, value in self._env_vars.items():
            self._originals[key] = os.environ.get(key)
            os.environ[key] = value
        return self

    def __exit__(self, *exc):
        for key, original in self._originals.items():
            if original is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = original


async def execute_strategy(
    strategy: Strategy,
    global_config: Config,
    variables: dict[str, str],
    cwd: Path,
    on_stream: Callable[[str, str], None] | None = None,
    on_progress: Callable[[str, int], None] | None = None,
    cancel_event: asyncio.Event | None = None,
) -> AgentResult:
    """Execute a strategy according to its execution policy."""
    mode = strategy.execution.mode
    if mode == "one-shot":
        return await _run_once(strategy, global_config, variables, cwd, on_stream, on_progress)
    elif mode == "loop":
        return await _run_loop(
            strategy, global_config, variables, cwd, on_stream, on_progress, cancel_event
        )
    else:
        raise ValueError(f"Unknown execution mode: {mode!r}")


async def _run_once(
    strategy: Strategy,
    global_config: Config,
    variables: dict[str, str],
    cwd: Path,
    on_stream: Callable[[str, str], None] | None,
    on_progress: Callable[[str, int], None] | None,
) -> AgentResult:
    """Single adapter.run() call."""
    resolved = _resolve_config(strategy, global_config)
    adapter = get_adapter(resolved["agent_type"])
    prompt = render_prompt(strategy.prompt, variables)

    _write_subagent_settings(strategy, cwd)

    if on_progress:
        on_progress("Running agent...", 30)

    with _EnvScope(_build_env(strategy)):
        result = await adapter.run(
            prompt=prompt,
            cwd=cwd,
            timeout=resolved["timeout"],
            max_turns=resolved["max_turns"],
            model=resolved["model"],
            effort=resolved["effort"],
            on_stream=on_stream,
        )

    if on_progress:
        on_progress("Complete", 100)

    return result


async def _run_loop(
    strategy: Strategy,
    global_config: Config,
    variables: dict[str, str],
    cwd: Path,
    on_stream: Callable[[str, str], None] | None,
    on_progress: Callable[[str, int], None] | None,
    cancel_event: asyncio.Event | None,
) -> AgentResult:
    """Repeatedly run the agent on an interval."""
    policy = strategy.execution
    iteration = 0
    last_result: AgentResult | None = None

    while True:
        iteration += 1
        if policy.max_iterations and iteration > policy.max_iterations:
            break
        if cancel_event and cancel_event.is_set():
            break

        if on_progress:
            on_progress(f"Loop iteration {iteration}", 0)

        loop_vars = dict(variables)
        if policy.carry_context and last_result and last_result.output:
            loop_vars["previous_result"] = (
                f"Previous run output:\n\n{last_result.output}"
            )
        elif policy.carry_context:
            loop_vars.setdefault("previous_result", "")

        last_result = await _run_once(
            strategy, global_config, loop_vars, cwd, on_stream, on_progress
        )

        if cancel_event and cancel_event.is_set():
            break

        # Sleep between iterations (interruptible via cancel_event)
        if not policy.max_iterations or iteration < policy.max_iterations:
            try:
                if cancel_event:
                    await asyncio.wait_for(
                        cancel_event.wait(), timeout=policy.interval
                    )
                    break
                else:
                    await asyncio.sleep(policy.interval)
            except TimeoutError:
                pass  # Normal: interval elapsed, event wasn't set

    return last_result or AgentResult(error="No iterations completed")
