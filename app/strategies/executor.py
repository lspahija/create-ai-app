"""Execute a strategy using the adapter layer."""

from __future__ import annotations

import asyncio
import logging
import re
from collections.abc import Callable
from pathlib import Path

from app.adapters import get_adapter
from app.adapters.base import AgentResult
from app.strategies.models import PromptConfig, Strategy
from app.strategies.templates import render_prompt

logger = logging.getLogger(__name__)

_SELF_ASSESS_SUFFIX = """

## Self-Assessment (required)

At the very end of your response, include exactly one of these markers on its own line:

[RESULT: SUCCESS] — you made meaningful progress toward the objective
[RESULT: FAILED] — you were unable to make meaningful progress, or your changes should be discarded

This assessment is used by the loop orchestrator to track progress across iterations."""

_RESULT_MARKER_RE = re.compile(r"\[RESULT:\s*(SUCCESS|FAILED)\]", re.IGNORECASE)


def _parse_self_assessment(output: str) -> bool | None:
    """Parse the last self-assessment marker from agent output.

    Returns True for SUCCESS, False for FAILED, None if no marker found.
    Uses the last match since the agent may discuss markers earlier in output.
    """
    matches = list(_RESULT_MARKER_RE.finditer(output))
    if not matches:
        return None
    return matches[-1].group(1).upper() == "SUCCESS"


async def execute_strategy(
    strategy: Strategy,
    variables: dict[str, str],
    cwd: Path,
    on_stream: Callable[[str, str], None] | None = None,
    on_progress: Callable[[str, int], None] | None = None,
    cancel_event: asyncio.Event | None = None,
    on_iteration_result: Callable[[int, AgentResult], None] | None = None,
) -> AgentResult:
    """Execute a strategy according to its execution policy."""
    mode = strategy.execution.mode
    if mode == "one-shot":
        return await _run_once(strategy, variables, cwd, on_stream, on_progress)
    elif mode == "loop":
        return await _run_loop(
            strategy, variables, cwd, on_stream, on_progress, cancel_event, on_iteration_result
        )
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
    on_iteration_result: Callable[[int, AgentResult], None] | None = None,
) -> AgentResult:
    """Repeatedly run the agent on an interval with failure handling and cumulative notes."""
    policy = strategy.execution
    iteration = 0
    last_result: AgentResult | None = None
    consecutive_failures = 0
    notes: list[str] = []

    # When self-assessment is enabled, append instructions to the task prompt
    if policy.self_assess:
        loop_strategy = strategy.model_copy(
            update={
                "prompt": PromptConfig(
                    system=strategy.prompt.system,
                    task=strategy.prompt.task + _SELF_ASSESS_SUFFIX,
                )
            }
        )
    else:
        loop_strategy = strategy

    while True:
        iteration += 1
        if policy.max_iterations and iteration > policy.max_iterations:
            break
        if cancel_event and cancel_event.is_set():
            break

        if on_progress:
            on_progress(f"Loop iteration {iteration}", 0)

        loop_vars = dict(variables)
        if policy.carry_context and notes:
            loop_vars["notes"] = "Notes from previous iterations:\n\n" + "\n".join(notes)
            loop_vars.setdefault("previous_result", loop_vars["notes"])
        elif policy.carry_context:
            loop_vars.setdefault("notes", "")
            loop_vars.setdefault("previous_result", "")

        last_result = await _run_once(loop_strategy, loop_vars, cwd, on_stream, on_progress)

        # Override exit-code-based success with agent's self-assessment
        if policy.self_assess:
            assessed = _parse_self_assessment(last_result.output or "")
            if assessed is not None:
                last_result.metadata["self_assessed"] = True
                last_result.exit_code = 0 if assessed else 1
                last_result.timed_out = False
            else:
                logger.debug(
                    "Iteration %d: no self-assessment marker, using exit code",
                    iteration,
                )

        # Build cumulative note from this iteration
        status = "success" if last_result.success else "FAILED"
        summary = (last_result.output or last_result.error or "no output")[:200].split("\n")[0]
        notes.append(f"- Iteration {iteration} ({status}): {summary}")

        if last_result.success:
            consecutive_failures = 0
        else:
            consecutive_failures += 1
            logger.warning(
                "Loop iteration %d failed (consecutive: %d)", iteration, consecutive_failures
            )

        if on_iteration_result:
            on_iteration_result(iteration, last_result)

        if cancel_event and cancel_event.is_set():
            break

        # Abort on too many consecutive failures
        if (
            policy.max_consecutive_failures
            and consecutive_failures >= policy.max_consecutive_failures
        ):
            logger.warning("Aborting loop after %d consecutive failures", consecutive_failures)
            if on_progress:
                on_progress(f"Aborted: {consecutive_failures} consecutive failures", 100)
            break

        if not policy.max_iterations or iteration < policy.max_iterations:
            # Exponential backoff on failure, capped at 8x interval
            if consecutive_failures > 0:
                wait = min(
                    policy.interval * (2 ** (consecutive_failures - 1)),
                    policy.interval * 8,
                )
            else:
                wait = policy.interval

            try:
                if cancel_event:
                    await asyncio.wait_for(cancel_event.wait(), timeout=wait)
                    break
                else:
                    await asyncio.sleep(wait)
            except TimeoutError:
                pass

    return last_result or AgentResult(error="No iterations completed")
