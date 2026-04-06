# create-ai-app

A production-ready starter template for AI-powered full-stack applications.

## What's Included

- **DevContainer** — Claude Code, Python 3.13, Node 22, Playwright MCP, fzf, just, ast-grep
- **FastAPI backend** — JWT auth, background jobs with streaming, health endpoint
- **React 19 frontend** — TailwindCSS 4, shadcn/ui, dark mode, job tracker with live streaming
- **AI adapter pattern** — Provider-agnostic protocol (Claude CLI + Agent SDK included, extensible)
- **Docker deployment** — Multi-stage production build with persistent volume
- **Dokploy guide** — Deploy to Hetzner Cloud with automatic SSL

See [BLUEPRINT.md](BLUEPRINT.md) for the design principles behind these choices.

## Quick Start

All development happens inside the devcontainer. See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for setup, commands, and workflow.

Run `just` inside the container to list all available commands.

## Create a New Project

Clone the template, then rewire remotes so you can pull upstream improvements later:

```bash
git clone https://github.com/lspahija/create-ai-app.git my-project
cd my-project
git remote rename origin upstream
git remote add origin git@github.com:youruser/my-project.git
git push -u origin main
```

To pull template updates into your project:

```bash
git fetch upstream && git merge upstream/main
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
    __init__.py       # FastAPI app, JWT auth, health endpoint, SPA serving
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
agent_model: claude-opus-4-6
agent_effort: max
agent_max_turns: 30
agent_timeout_seconds: 900
```

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for environment variables, Docker deployment, and Hetzner Cloud + Dokploy setup.

## Customizing

1. **Rename the project** — Update `name` in `pyproject.toml`, titles in `web/index.html`, `App.tsx`, `login-page.tsx`, and `CLAUDE.md`
2. **Add API endpoints** — Create a new router in `app/api/` and include it in `app/api/__init__.py`
3. **Add background jobs** — Follow the pattern in `app/api/jobs.py`
4. **Add frontend pages** — Create components in `web/src/pages/`, add routes in `App.tsx`
5. **Add AI adapters** — Implement `BaseAdapter` protocol in `app/adapters/`
6. **Add shadcn components** — Run `npx shadcn add <component>` in the `web/` directory
