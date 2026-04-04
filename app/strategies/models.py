"""Pydantic models for strategy YAML schema."""

from __future__ import annotations

from pydantic import BaseModel, Field


class PromptConfig(BaseModel):
    """Prompt templates with $variable substitution support."""

    system: str = ""
    task: str


class SubagentConfig(BaseModel):
    """A Claude Code native subagent definition."""

    name: str
    description: str
    model: str = ""
    prompt: str = ""
    tools: list[str] = Field(default_factory=list)


class TeamConfig(BaseModel):
    """Claude Code experimental agent team configuration."""

    enabled: bool = True
    size: int = 2
    lead_prompt: str = ""


class AgentOverrides(BaseModel):
    """Override global config.yaml agent settings per-strategy.

    Zero-values ("" or 0) mean "not set, use global default".
    """

    agent_type: str = ""
    model: str = ""
    effort: str = ""
    max_turns: int = 0
    timeout: int = 0


class ExecutionPolicy(BaseModel):
    """How the strategy executes over time."""

    mode: str = "one-shot"  # "one-shot" | "loop"
    interval: int = 300  # loop: seconds between runs
    max_iterations: int = 0  # loop: 0 = infinite
    carry_context: bool = False  # loop: inject $previous_result


class Strategy(BaseModel):
    """Complete specification for how an AI agent approaches a task."""

    name: str
    description: str = ""
    prompt: PromptConfig
    agent: AgentOverrides = Field(default_factory=AgentOverrides)
    execution: ExecutionPolicy = Field(default_factory=ExecutionPolicy)
    subagents: list[SubagentConfig] = Field(default_factory=list)
    team: TeamConfig | None = None
    env: dict[str, str] = Field(default_factory=dict)
