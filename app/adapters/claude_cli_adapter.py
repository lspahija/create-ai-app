"""Claude Code CLI adapter — runs claude as a subprocess."""

from __future__ import annotations

import asyncio
import json
import logging
import shutil
import subprocess
import time
from collections.abc import Callable
from pathlib import Path

from app.adapters.base import AgentResult, format_tool_result_content

logger = logging.getLogger(__name__)


class ClaudeCliAdapter:
    """Runs Claude Code CLI as a subprocess."""

    @staticmethod
    def _parse_envelope(result: AgentResult, envelope: dict) -> None:
        """Extract metadata from a CLI result envelope into an AgentResult."""
        result.output = envelope.get("result", "")
        result.metadata["cost_usd"] = envelope.get("total_cost_usd")
        result.metadata["num_turns"] = envelope.get("num_turns")
        result.metadata["session_id"] = envelope.get("session_id")
        result.metadata["subtype"] = envelope.get("subtype")
        result.metadata["duration_api_ms"] = envelope.get("duration_api_ms")
        subtype = envelope.get("subtype", "")
        if subtype == "error_max_turns":
            result.metadata["max_turns_hit"] = True
        elif envelope.get("is_error"):
            result.error = result.output
            result.exit_code = 1

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
        """Run claude and unwrap the JSON envelope.

        Args:
            on_stream: Optional callback(block_type, text) called for each
                       content block as it arrives. block_type is "thinking"
                       or "text".
        """
        if on_stream:
            return await asyncio.to_thread(
                self._run_streaming,
                prompt,
                cwd,
                timeout,
                max_turns,
                model,
                effort,
                on_stream,
            )

        cmd = self._build_cmd(prompt, max_turns, model, effort, output_format="json")
        result = await asyncio.to_thread(self._run_subprocess, cmd, cwd, timeout)
        result.metadata["raw_stdout"] = result.output
        try:
            envelope = json.loads(result.output)
            if isinstance(envelope, dict) and envelope.get("type") == "result":
                self._parse_envelope(result, envelope)
        except (json.JSONDecodeError, ValueError):
            logger.warning("Failed to parse CLI JSON output for prompt: %.80s", prompt)
        return result

    @staticmethod
    def _build_cmd(
        prompt: str,
        max_turns: int,
        model: str | None,
        effort: str | None,
        *,
        output_format: str = "json",
    ) -> list[str]:
        """Build the claude CLI command."""
        cmd = [
            "claude",
            "-p",
            prompt,
            "--output-format",
            output_format,
            "--max-turns",
            str(max_turns),
            "--dangerously-skip-permissions",
        ]
        if output_format == "stream-json":
            cmd.append("--verbose")
        if model:
            cmd.extend(["--model", model])
        if effort:
            cmd.extend(["--effort", effort])
        return cmd

    def _run_streaming(
        self,
        prompt: str,
        cwd: Path,
        timeout: int,
        max_turns: int,
        model: str | None,
        effort: str | None,
        on_stream: Callable[[str, str], None],
    ) -> AgentResult:
        """Run claude with stream-json output, calling on_stream for each block."""
        cmd = self._build_cmd(prompt, max_turns, model, effort, output_format="stream-json")

        start = time.monotonic()
        result = AgentResult()

        try:
            proc = subprocess.Popen(
                cmd,
                cwd=str(cwd),
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
            )
        except FileNotFoundError:
            result.exit_code = -1
            result.duration_seconds = time.monotonic() - start
            result.error = f"Command not found: {cmd[0]}"
            return result

        envelope_data: dict = {}

        try:
            deadline = start + timeout
            for line in iter(proc.stdout.readline, ""):
                if time.monotonic() > deadline:
                    proc.kill()
                    proc.wait()
                    result.timed_out = True
                    result.exit_code = -1
                    result.error = f"Agent timed out after {timeout}s"
                    break

                line = line.strip()
                if not line:
                    continue

                try:
                    obj = json.loads(line)
                except (json.JSONDecodeError, ValueError):
                    continue

                msg_type = obj.get("type")

                if msg_type in ("assistant", "user"):
                    content = obj.get("message", {}).get("content", [])
                    if not isinstance(content, list):
                        content = [content] if content else []
                    for block in content:
                        if isinstance(block, str):
                            on_stream("text", block)
                            continue
                        block_type = block.get("type", "")
                        if block_type == "thinking":
                            on_stream("thinking", block.get("thinking", ""))
                        elif block_type == "text":
                            on_stream("text", block.get("text", ""))
                        elif block_type in ("tool_use", "server_tool_use"):
                            name = block.get("name", "unknown")
                            inp = block.get("input", {})
                            inp_str = (
                                json.dumps(inp, indent=2) if isinstance(inp, dict) else str(inp)
                            )
                            on_stream("tool_use", f"{name}\n{inp_str}")
                        elif block_type == "tool_result":
                            content = block.get("content", "")
                            on_stream("tool_result", format_tool_result_content(content))

                elif msg_type == "result":
                    envelope_data = obj

            proc.wait(timeout=5)
        except KeyboardInterrupt:
            result.exit_code = -2
            result.error = "Interrupted by user"
            result.metadata["interrupted"] = True
            result.duration_seconds = time.monotonic() - start
            return result
        finally:
            if proc.poll() is None:
                proc.terminate()
                try:
                    proc.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    proc.kill()

        result.duration_seconds = time.monotonic() - start
        result.exit_code = proc.returncode or 0

        # Read any stderr
        stderr = proc.stderr.read() if proc.stderr else ""
        if stderr:
            result.error = stderr

        # Parse envelope from the result message
        if envelope_data:
            self._parse_envelope(result, envelope_data)

        return result

    def health_check(self) -> bool:
        if shutil.which("claude") is None:
            return False
        try:
            proc = subprocess.run(
                ["claude", "--version"],
                capture_output=True,
                text=True,
                timeout=10,
            )
            return proc.returncode == 0
        except (subprocess.TimeoutExpired, FileNotFoundError):
            return False

    def _run_subprocess(
        self,
        cmd: list[str],
        cwd: Path,
        timeout: int = 900,
    ) -> AgentResult:
        """Execute a subprocess with timeout and timing."""
        start = time.monotonic()
        try:
            proc = subprocess.run(
                cmd,
                cwd=str(cwd),
                capture_output=True,
                text=True,
                timeout=timeout,
            )
            return AgentResult(
                output=proc.stdout,
                exit_code=proc.returncode,
                duration_seconds=time.monotonic() - start,
                error=proc.stderr,
            )
        except subprocess.TimeoutExpired as e:
            return AgentResult(
                output=e.stdout or "",
                exit_code=-1,
                duration_seconds=time.monotonic() - start,
                timed_out=True,
                error=f"Agent timed out after {timeout}s\n{e.stderr or ''}".strip(),
            )
        except FileNotFoundError:
            return AgentResult(
                exit_code=-1,
                duration_seconds=time.monotonic() - start,
                error=f"Command not found: {cmd[0]}",
            )
