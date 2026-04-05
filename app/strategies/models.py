"""Pydantic models for strategy YAML schema."""

from __future__ import annotations

from pydantic import BaseModel, Field


class PromptConfig(BaseModel):
    """Prompt templates with $variable substitution support."""

    system: str = ""
    task: str


class ExecutionPolicy(BaseModel):
    """How the strategy executes over time."""

    mode: str = "one-shot"  # "one-shot" | "loop"
    interval: int = 300  # loop: seconds between runs
    max_iterations: int = 0  # loop: 0 = infinite
    carry_context: bool = False  # loop: inject $previous_result


class Strategy(BaseModel):
    """Complete specification for how an AI agent approaches a task.

    Each strategy is self-contained — all agent configuration lives here,
    not in a separate config file.
    """

    name: str
    description: str = ""
    prompt: PromptConfig
    agent: str = "claude-cli"
    model: str | None = None
    max_turns: int | None = None
    timeout: int = 900
    options: dict[str, str] = Field(default_factory=dict)
    execution: ExecutionPolicy = Field(default_factory=ExecutionPolicy)
