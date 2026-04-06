"""Prompt template rendering using string.Template."""

from __future__ import annotations

import re
from string import Template

from app.strategies.models import PromptConfig

_VAR_RE = re.compile(r"\$(?:(\w+)|\{(\w+)\})")


def extract_variables(prompt_config: PromptConfig) -> list[str]:
    """Extract $variable names from system and task templates."""
    found: set[str] = set()
    for text in [prompt_config.system, prompt_config.task]:
        for m in _VAR_RE.finditer(text):
            found.add(m.group(1) or m.group(2))
    return sorted(found)


def render_prompt(prompt_config: PromptConfig, variables: dict[str, str]) -> str:
    """Render a full prompt from a PromptConfig and variable dict.

    System prompt (if set) is prepended, separated by a blank line.
    Variables use $name or ${name} syntax via string.Template.safe_substitute.
    """
    parts = []
    if prompt_config.system:
        parts.append(Template(prompt_config.system).safe_substitute(variables))
    parts.append(Template(prompt_config.task).safe_substitute(variables))
    return "\n\n".join(parts)
