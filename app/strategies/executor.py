"""Execute a strategy using the adapter layer."""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Callable
from pathlib import Path

from app.adapters import get_adapter
from app.adapters.base import AgentResult
from app.strategies.models import Strategy
from app.strategies.templates import render_prompt

logger = logging.getLogger(__name__)


async def execute_strategy(
    strategy: Strategy,
    variables: dict[str, str],
    cwd: Path,
    on_stream: Callable[[str, str], None] | None = None,
    on_progress: Callable[[str, int], None] | None = None,
    cancel_event: asyncio.Event | None = None,
) -> AgentResult:
    """Execute a strategy according to its execution policy."""
    mode = strategy.execution.mode
    if mode == "one-shot":
        return await _run_once(strategy, variables, cwd, on_stream, on_progress)
    elif mode == "loop":
        return await _run_loop(strategy, variables, cwd, on_stream, on_progress, cancel_event)
    else:
        raise ValueError(f"Unknown execution mode: {mode!r}")


async def _run_once(
    strategy: Strategy,
    variables: dict[str, str],
    cwd: Path,
    on_stream: Callable[[str, str], None] | None,
    on_progress: Callable[[str, int], None] | None,
) -> AgentResult:
    """Single adapter.run() call."""
    adapter = get_adapter(strategy.agent)
    prompt = render_prompt(strategy.prompt, variables)

    if on_progress:
        on_progress("Running agent...", 30)

    result = await adapter.run(
        prompt=prompt,
        cwd=cwd,
        timeout=strategy.timeout,
        max_turns=strategy.max_turns,
        model=strategy.model,
        options=strategy.options or None,
        on_stream=on_stream,
    )

    if on_progress:
        on_progress("Complete", 100)

    return result


async def _run_loop(
    strategy: Strategy,
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
            loop_vars["previous_result"] = f"Previous run output:\n\n{last_result.output}"
        elif policy.carry_context:
            loop_vars.setdefault("previous_result", "")

        last_result = await _run_once(strategy, loop_vars, cwd, on_stream, on_progress)

        if cancel_event and cancel_event.is_set():
            break

        if not policy.max_iterations or iteration < policy.max_iterations:
            try:
                if cancel_event:
                    await asyncio.wait_for(cancel_event.wait(), timeout=policy.interval)
                    break
                else:
                    await asyncio.sleep(policy.interval)
            except TimeoutError:
                pass

    return last_result or AgentResult(error="No iterations completed")
