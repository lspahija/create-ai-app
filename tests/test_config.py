from app.config import Config, load_config


def test_default_config():
    config = Config()
    assert config.default_agent == "claude-cli"


def test_load_missing_file():
    config = load_config("/nonexistent.yaml")
    assert isinstance(config, Config)
    assert config.default_agent == "claude-cli"
