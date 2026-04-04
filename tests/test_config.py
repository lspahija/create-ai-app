from app.config import Config, load_config


def test_default_config():
    config = Config()
    assert config.default_agent == "claude-cli"
    assert config.agent_model == "claude-opus-4-6"
    assert config.agent_effort == "max"
    assert config.agent_max_turns == 30
    assert config.agent_timeout_seconds == 900


def test_load_missing_file():
    config = load_config("/nonexistent.yaml")
    assert isinstance(config, Config)
    assert config.default_agent == "claude-cli"
