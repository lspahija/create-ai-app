# My App

AI-powered full-stack application.

## Project Conventions

- Python 3.12+, managed with `uv`
- Run commands via `just` (see Justfile)
- Config in YAML (config.yaml), validated with Pydantic
- FastAPI backend in `app/api/`
- React frontend in `web/`
- AI agent adapters in `app/adapters/` (provider-agnostic: Claude CLI, Claude SDK, extensible)

## Key Commands

- `just dev` — Start API + frontend dev servers in one terminal
- `just serve` — Start API server (port 8000)
- `just test` — Run tests
- `just health` — Check API availability
- `docker compose up -d` — Build and deploy as Docker container

## Architecture

FastAPI backend serves REST API + React SPA.
AI adapters (CLI subprocess or Agent SDK) handle AI tasks via a provider-agnostic protocol.
Background jobs run as async tasks with progress tracking and streaming output.
Optional password auth via AUTH_PASSWORD env var (JWT-based, 30-day tokens).

## Adding New Adapters

The `app/adapters/` directory uses a Protocol-based adapter pattern. To add a new AI provider:
1. Create a new file (e.g., `app/adapters/my_adapter.py`) implementing the `BaseAdapter` protocol
2. Register it in `app/adapters/factory.py`
3. Set `default_agent` in config.yaml to your adapter name
