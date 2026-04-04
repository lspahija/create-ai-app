# Architecture

## Overview

The application is a full-stack web app with an AI agent integration layer.

```
Browser → React SPA → FastAPI Backend → AI Adapter → Claude CLI / SDK
```

## Backend (`app/`)

### API Layer (`app/api/`)

- **`__init__.py`** — FastAPI app creation, JWT auth middleware, .env loading, SPA static file serving
- **`jobs.py`** — Background job registry with threading, progress callbacks, streaming output
- **`helpers.py`** — Shared utilities (PROJECT_ROOT)

### AI Adapters (`app/adapters/`)

Provider-agnostic adapter pattern using Python's Protocol:

- **`base.py`** — `BaseAdapter` protocol and `AgentResult` dataclass
- **`factory.py`** — `get_adapter(name)` factory function
- **`claude_cli_adapter.py`** — Runs Claude CLI as subprocess with JSON/streaming output
- **`claude_sdk_adapter.py`** — Uses Claude Agent SDK library directly (in-process)

To add a new adapter (e.g., OpenAI Codex):
1. Create `app/adapters/codex_adapter.py` implementing `BaseAdapter`
2. Add a branch to `factory.py`
3. Set `default_agent: codex` in config.yaml

### Configuration (`app/config.py`)

YAML config loaded into Pydantic models. Add your own config fields here.

### Logging (`app/log.py`)

Rotating file handler (2MB, 5 backups) + console. Third-party loggers suppressed to WARNING.

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
- Frontend stores token in localStorage

## Background Jobs

In-memory job registry with threading:
- Jobs tracked by ID with status, progress, and streaming output
- Stream buffer captures AI thinking/text/tool-use blocks
- Frontend polls `/api/jobs/{id}/stream` for real-time updates
- Max 50 jobs in memory; oldest completed jobs evicted

## Production Deployment

Multi-stage Docker build:
1. Node 22 builds React frontend
2. Ubuntu 24.04 + uv + Python 3.13 + Claude CLI runtime
3. Persistent volume at `/app/data` for config
4. Entrypoint initializes volume on first run
