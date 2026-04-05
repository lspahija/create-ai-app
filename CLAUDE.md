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

Strategies are YAML files in `strategies/` that fully define how an AI agent approaches a task. Every job uses a strategy — there is no separate agent config.

### Strategy YAML Reference

```yaml
# All keys except prompt.task are optional — defaults shown below.

name: my-strategy              # auto-derived from filename if omitted
description: What this does    # shown in GET /api/strategies

prompt:
  system: ""                   # optional role/context prepended to task
  task: |                      # REQUIRED — the actual work prompt
    Do something with $variable
    # Use $name or ${name} for variable substitution.
    # Variables are passed via the API at runtime.

agent: claude-cli              # which adapter (claude-cli, claude-sdk, etc.)
model: null                    # model name, or null = adapter default
max_turns: null                # max agent turns, or null = adapter default
timeout: 900                   # seconds before timeout

options: {}                    # provider-specific key-value pairs
                               # e.g. { effort: max } for Claude

execution:
  mode: one-shot               # one-shot | loop
  interval: 300                # loop: seconds between runs
  max_iterations: 0            # loop: 0 = infinite
  carry_context: false         # loop: inject $previous_result variable
```

### API

- `POST /api/jobs {"strategy": "one-shot", "variables": {"topic": "..."}}` — run a strategy
- `GET /api/strategies` — list available strategies
- `POST /api/jobs/{id}/cancel` — cancel a running job (useful for loop mode)
- `GET /api/jobs/{id}/stream` — SSE stream of agent output

### Adding a strategy

Create `strategies/my-strategy.yaml` — only `prompt.task` is required, everything else has defaults.

Code: `app/strategies/` — models, loader, executor, templates.

## Adding New Adapters

The `app/adapters/` directory uses a Protocol-based adapter pattern. To add a new AI provider:
1. Create `app/adapters/my_adapter.py` implementing `BaseAdapter` protocol
2. Add a branch in `app/adapters/factory.py`
3. Set `agent: my-adapter` in your strategy YAML files
