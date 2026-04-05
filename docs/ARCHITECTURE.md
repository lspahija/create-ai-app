# Architecture

## Overview

The application is a full-stack web app with an AI agent integration layer.

```
Browser → React SPA → FastAPI Backend → Strategy → AI Adapter → Claude / Codex / Gemini
```

## Backend (`app/`)

### API Layer (`app/api/`)

- **`__init__.py`** — FastAPI app creation, CORS, health endpoint, SPA static file serving
- **`auth.py`** — JWT auth middleware and login/status endpoints
- **`jobs.py`** — Background job registry with threading, progress callbacks, streaming output

### AI Adapters (`app/adapters/`)

Provider-agnostic adapter pattern using Python's Protocol:

- **`base.py`** — `BaseAdapter` protocol and `AgentResult` dataclass
- **`factory.py`** — `get_adapter(name)` factory function
- **`claude_cli_adapter.py`** — Runs Claude CLI as subprocess with JSON/streaming output
- **`claude_sdk_adapter.py`** — Uses Claude Agent SDK library directly (in-process)

To add a new adapter (e.g., OpenAI Codex):
1. Create `app/adapters/codex_adapter.py` implementing `BaseAdapter`
2. Add a branch to `factory.py`
3. Set `agent: codex` in your strategy YAML files

### Strategies (`app/strategies/`)

The first-class unit for agent configuration. Every job uses a strategy. No separate agent config file.

```
API request → Strategy (YAML) → Executor → Adapter → AI provider
```

- **`models.py`** — Pydantic models: `Strategy`, `PromptConfig`, `ExecutionPolicy`
- **`loader.py`** — Discovers and validates YAML files from `strategies/` directory
- **`templates.py`** — Renders prompt templates with `$variable` substitution
- **`executor.py`** — Executes strategies via adapter (one-shot or loop mode)

Each strategy is self-contained: prompt, adapter, model, limits, and provider-specific options. See `CLAUDE.md` for the full YAML schema reference.

To add a strategy: create `strategies/my-strategy.yaml` — only `prompt.task` is required.

### Configuration (`app/config.py`)

Minimal YAML config for infrastructure settings. Agent config lives in strategies.

### Logging (`app/log.py`)

Rotating file handler (2MB, 5 backups) + console.

## Frontend (`web/`)

- **React 19** with TypeScript
- **Vite 8** bundler with `/api` proxy to backend
- **TailwindCSS 4** + shadcn/ui components
- **TanStack React Query** for data fetching
- **React Router v7** for routing

Key components:
- `auth-provider.tsx` — JWT auth context with login page
- `job-tracker.tsx` — Progress bar for active background jobs
- `thinking-viewer.tsx` — Streams AI thinking/tool-use blocks in real-time

## Authentication

Optional password auth via `AUTH_PASSWORD` env var:
- JWT tokens (HS256, 30-day expiry)
- Secret derived from password hash
- Applied as FastAPI dependency on all `/api/*` routes (except `/api/auth/*`)
- JWT stored in HTTP-only cookie

## Background Jobs

In-memory job registry with threading:
- Jobs tracked by ID with status, progress, and streaming output
- Stream buffer captures AI thinking/text/tool-use blocks
- Frontend connects via SSE (`EventSource`) for real-time updates
- Max 50 jobs in memory; oldest completed jobs evicted

## Production Deployment

Multi-stage Docker build:
1. Node 22 builds React frontend
2. Ubuntu 24.04 + uv + Python 3.13 + Claude CLI runtime
3. Persistent volume at `/app/data` for config
4. Entrypoint initializes volume on first run
