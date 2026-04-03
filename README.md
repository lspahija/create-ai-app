# create-ai-app

A production-ready starter template for AI-powered full-stack applications.

## What's Included

- **DevContainer** — Claude Code, Python 3.13, Node 22, Playwright MCP, fzf, just, ast-grep
- **FastAPI backend** — JWT auth, background jobs with streaming, health endpoint
- **React 19 frontend** — TailwindCSS 4, shadcn/ui, dark mode, job tracker with live streaming
- **AI adapter pattern** — Provider-agnostic protocol (Claude CLI + Agent SDK included, extensible)
- **Docker deployment** — Multi-stage production build with persistent volume
- **Dokploy guide** — Deploy to Hetzner Cloud with automatic SSL

## Quick Start

### With DevContainer (recommended)

1. Clone this repo
2. Open in VS Code with the Dev Containers extension (or use GitHub Codespaces)
3. The DevContainer builds automatically with all dependencies

#### Terminal-based setup with `devc`

The devcontainer includes a CLI helper called `devc` (from [trailofbits/claude-code-devcontainer](https://github.com/trailofbits/claude-code-devcontainer)). First-time setup:

```bash
# Install devc to ~/.local/bin (one-time)
.devcontainer/install.sh self-install

# Start the devcontainer and open a shell
devc .
devc shell
```

Common `devc` commands:

```bash
devc up            # Start container
devc shell         # Open zsh shell in container
devc exec <cmd>    # Run a command in the container
devc rebuild       # Rebuild (preserves volumes)
devc down          # Stop container
devc destroy       # Remove container, volumes, image
devc upgrade       # Upgrade Claude Code inside container
```

### Manual Setup

```bash
# Install Python dependencies
just setup

# Install frontend dependencies
just web-setup

# Start development (API + frontend)
just dev
```

Visit http://localhost:5173 (frontend dev server proxies API calls to port 8000).

## Available Commands

```bash
just                      # List all commands
just dev                  # API + frontend dev servers
just serve                # API server only (port 8000)
just test                 # Run tests
just health               # Check API health
just dashboard            # Build frontend + serve on single port
just web-dev              # Frontend dev server only
just web-build            # Build frontend for production
just devcontainer-update  # Pull latest devcontainer updates from upstream
```

## Project Structure

```
app/
  adapters/           # AI agent adapters (provider-agnostic)
    base.py           # Protocol + AgentResult dataclass
    factory.py        # get_adapter() factory
    claude_cli_adapter.py   # Claude CLI subprocess adapter
    claude_sdk_adapter.py   # Claude Agent SDK adapter
  api/
    __init__.py       # FastAPI app, JWT auth, SPA serving
    routes.py         # Your API endpoints (starts with /api/health)
    jobs.py           # Background job system with streaming
    helpers.py        # Shared utilities
  config.py           # Pydantic config models
  log.py              # Structured logging (rotating file + console)
web/                  # React 19 + Vite + TailwindCSS 4 + shadcn/ui
tests/                # pytest test suite
docs/                 # Architecture, development, deployment guides
```

## Configuration

**config.yaml** — AI agent settings:
```yaml
default_agent: claude-cli   # or "claude-sdk"
agent_max_turns: 30
agent_timeout_seconds: 900
```

**Environment variables** (`.env` or deployment platform):
```bash
CLAUDE_CODE_OAUTH_TOKEN=    # Required for AI features
AUTH_PASSWORD=              # Optional: enables password auth
```

## Docker Deployment

```bash
docker compose up -d        # Build and start
docker compose logs -f      # Check logs
docker compose up -d --build  # Rebuild after changes
```

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for Hetzner Cloud + Dokploy deployment.

## Customizing

1. **Rename the project** — Update `name` in `pyproject.toml`, titles in `web/index.html`, `App.tsx`, `login-page.tsx`, and `CLAUDE.md`
2. **Add API endpoints** — Add routes to `app/api/routes.py`
3. **Add background jobs** — Follow the pattern in `app/api/jobs.py`
4. **Add frontend pages** — Create components in `web/src/pages/`, add routes in `App.tsx`
5. **Add AI adapters** — Implement `BaseAdapter` protocol in `app/adapters/`
6. **Add shadcn components** — Run `npx shadcn add <component>` in the `web/` directory
