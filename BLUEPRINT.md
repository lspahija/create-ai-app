# Blueprint

Opinionated stack and conventions for this project. When setting up a new project, follow these same choices.

## Stack

- **Python 3.12+** managed with **uv** — one tool for deps, venvs, and Python versions. Lock everything with `uv.lock`. Use `pyproject.toml` for all config (deps, ruff, pytest). Use optional extras to separate concerns (e.g., `web` for FastAPI, `sdk` for AI libraries).
- **FastAPI** for the backend — async handlers, Pydantic models at API boundaries, lifespan hooks for startup/shutdown.
- **React 19** for the frontend with **Vite**, **TailwindCSS 4**, and **shadcn/ui** (copy-paste components via `npx shadcn add`, not a package dependency).
- **just** as the single command entry point — `just` with no args lists all commands. Covers setup, dev, test, lint, format, build, deploy. `just dev` starts both backend and frontend.
- **Devcontainer** as the canonical dev environment — everything pre-installed, zero manual setup. See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for the full setup.
- **Simple JWT auth** — optional, toggled by a single `AUTH_PASSWORD` env var. Unset = open access, set = password required. Same image for dev and prod.
- **Docker** — single multi-stage Dockerfile, single container, single port. Frontend built in a Node stage, served as static files by FastAPI. No nginx, no reverse proxy, no separate frontend deployment.
- **Deploy to Hetzner with Dokploy** — self-hosted PaaS with automatic SSL. See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).
- **GitHub Actions CI** — four parallel jobs: lint (ruff), test (pytest), frontend (eslint + tsc), docker build. Fast, isolated feedback.

## Principles

**Async everywhere.** All application code is async. When integrating something synchronous (a subprocess, a blocking SDK call), wrap it at the boundary — the sync adapter is the anti-corruption layer, not the app. Internal code never blocks the event loop.

**Dataclass for data, Pydantic at boundaries.** Internal structures (results, job status) are `@dataclass`. Pydantic `BaseModel` is for where external data enters: config files, HTTP requests. Don't validate data you created yourself.

**Config in YAML, secrets in env vars.** Application settings (model, timeouts, feature flags) go in `config.yaml` — committed, with defaults for every field. Secrets (`AUTH_PASSWORD`, API tokens) go in environment variables — never committed.

**Protocol over ABC.** Define interfaces with `typing.Protocol` (structural typing). Implementations don't inherit from anything — they just have the right methods. Keeps things composable and test-friendly.
