import tempfile
from pathlib import Path

import pytest

from app.strategies.loader import list_strategies, load_all_strategies, load_strategy
from app.strategies.models import ExecutionPolicy, PromptConfig, Strategy
from app.strategies.templates import render_prompt


# ── Models ──────────────────────────────────────────────────────────────


def test_minimal_strategy():
    s = Strategy(name="test", prompt=PromptConfig(task="Do something"))
    assert s.agent == "claude-cli"
    assert s.model is None
    assert s.max_turns is None
    assert s.timeout == 900
    assert s.options == {}
    assert s.execution.mode == "one-shot"


def test_strategy_with_all_fields():
    s = Strategy(
        name="full",
        description="A full strategy",
        prompt=PromptConfig(system="Be helpful", task="Do $thing"),
        agent="claude-sdk",
        model="claude-opus-4-6",
        max_turns=100,
        timeout=3600,
        options={"effort": "max", "temperature": 0.7},
        execution=ExecutionPolicy(mode="loop", interval=60, max_iterations=5, carry_context=True),
    )
    assert s.agent == "claude-sdk"
    assert s.options["temperature"] == 0.7  # preserved as float, not coerced to str
    assert s.execution.carry_context is True


def test_invalid_execution_mode():
    with pytest.raises(Exception):  # Pydantic ValidationError
        Strategy(
            name="bad",
            prompt=PromptConfig(task="Do something"),
            execution=ExecutionPolicy(mode="oneshot"),
        )


# ── Loader ──────────────────────────────────────────────────────────────


def test_load_strategy_from_yaml(tmp_path):
    yaml_content = "prompt:\n  task: Hello $name\ntimeout: 60\n"
    (tmp_path / "test.yaml").write_text(yaml_content)
    s = load_strategy("test", strategies_dir=tmp_path)
    assert s.name == "test"
    assert s.timeout == 60
    assert "$name" in s.prompt.task


def test_load_strategy_missing():
    with pytest.raises(FileNotFoundError):
        load_strategy("nonexistent", strategies_dir=Path("/tmp/empty"))


def test_load_strategy_invalid(tmp_path):
    (tmp_path / "bad.yaml").write_text("prompt: not_a_dict\n")
    with pytest.raises(ValueError, match="Invalid strategy"):
        load_strategy("bad", strategies_dir=tmp_path)


def test_list_strategies():
    from app.config import PROJECT_ROOT

    names = list_strategies(PROJECT_ROOT / "strategies")
    assert "one-shot" in names
    assert "loop" in names


def test_load_all_strategies():
    from app.config import PROJECT_ROOT

    strategies = load_all_strategies(PROJECT_ROOT / "strategies")
    assert "one-shot" in strategies
    assert "loop" in strategies
    assert strategies["loop"].execution.mode == "loop"


# ── Templates ───────────────────────────────────────────────────────────


def test_render_prompt_basic():
    config = PromptConfig(task="Hello $name")
    result = render_prompt(config, {"name": "world"})
    assert result == "Hello world"


def test_render_prompt_with_system():
    config = PromptConfig(system="You are $role", task="Do $thing")
    result = render_prompt(config, {"role": "helpful", "thing": "stuff"})
    assert result == "You are helpful\n\nDo stuff"


def test_render_prompt_no_system():
    config = PromptConfig(task="Just the task")
    result = render_prompt(config, {})
    assert result == "Just the task"


def test_render_prompt_missing_variable():
    config = PromptConfig(task="Hello $name, your id is $id")
    result = render_prompt(config, {"name": "world"})
    assert "Hello world" in result
    assert "$id" in result  # safe_substitute leaves unmatched vars
