# My App

> See [BLUEPRINT.md](BLUEPRINT.md) for the principles behind these choices — use it to replicate this setup in other projects.

AI-powered full-stack application.

## Project Conventions

- Python 3.13+, managed with `uv`
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
Strategies (YAML in `strategies/`) are the first-class unit — every job uses one. No separate agent config.
Background jobs run as async tasks with progress tracking and streaming output.
Optional password auth via AUTH_PASSWORD env var (JWT-based, 30-day tokens).

## Strategies

YAML files in `strategies/` — the first-class unit for agent config. Every job uses one. See [docs/STRATEGIES.md](docs/STRATEGIES.md) for the full human-readable reference.

```yaml
# Only prompt.task is required. Defaults shown.
name: my-strategy              # auto-derived from filename
description: ""                # shown in GET /api/strategies
prompt:
  system: ""                   # optional role/context
  task: ...                    # REQUIRED — $variable substitution
agent: claude-cli              # which adapter
model: null                    # null = adapter default
max_turns: null                # null = adapter default
timeout: 900                   # seconds
options: {}                    # provider-specific (e.g. effort: max)
execution:
  mode: one-shot               # one-shot | loop
  interval: 300                # loop: seconds between runs
  max_iterations: 0            # loop: 0 = infinite
  carry_context: false         # loop: inject $previous_result
```

API: `POST /api/jobs {"strategy": "name", "variables": {...}}`
List: `GET /api/strategies`
Cancel: `POST /api/jobs/{id}/cancel`
Stream: `GET /api/jobs/{id}/stream`

Code: `app/strategies/` — models, loader, executor, templates.

## Adding New Adapters

The `app/adapters/` directory uses a Protocol-based adapter pattern. To add a new AI provider:
1. Create `app/adapters/my_adapter.py` implementing `BaseAdapter` protocol
2. Add a branch in `app/adapters/factory.py`
3. Set `agent: my-adapter` in your strategy YAML files
