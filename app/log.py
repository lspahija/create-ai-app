"""Logging configuration."""

import logging
from logging.handlers import RotatingFileHandler
from pathlib import Path

LOG_DIR = Path("logs")
LOG_FILE = LOG_DIR / "app.log"


def setup_logging(verbose: bool = False) -> None:
    """Configure root logger with console and rotating file output."""
    root = logging.getLogger()
    root.setLevel(logging.DEBUG)

    # Console: show INFO+ (or DEBUG if verbose)
    console = logging.StreamHandler()
    console.setLevel(logging.DEBUG if verbose else logging.INFO)
    console.setFormatter(
        logging.Formatter(
            "%(asctime)s %(levelname)s %(name)s: %(message)s",
            datefmt="%H:%M:%S",
        )
    )
    root.addHandler(console)

    # File: capture everything at DEBUG level
    LOG_DIR.mkdir(exist_ok=True)
    file_handler = RotatingFileHandler(
        LOG_FILE,
        maxBytes=2 * 1024 * 1024,
        backupCount=5,
    )
    file_handler.setLevel(logging.DEBUG)
    file_handler.setFormatter(
        logging.Formatter(
            "%(asctime)s %(levelname)-7s %(name)s: %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )
    )
    root.addHandler(file_handler)

    # Suppress noisy third-party debug logs
    for name in ("httpcore", "httpx", "urllib3"):
        logging.getLogger(name).setLevel(logging.WARNING)
