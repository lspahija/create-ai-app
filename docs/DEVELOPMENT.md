# Development

## Prerequisites

### DevContainer (recommended)

Open this project in VS Code with the Dev Containers extension. Everything is pre-installed:
- Python 3.13, uv, Node 22, Claude CLI
- fzf, ripgrep, ast-grep, just, tmux
- Playwright + Chromium for MCP browser automation

#### Terminal-based setup with `devc`

The `.devcontainer/` includes a CLI helper called `devc` for managing devcontainers from the terminal. First-time setup:

```bash
# Install devc to ~/.local/bin (one-time)
.devcontainer/install.sh self-install

# Start the devcontainer and open a shell
devc .
devc shell
```

Common commands:

| Command | Description |
|---------|-------------|
| `devc .` | Install template & start container |
| `devc up` | Start container |
| `devc shell` | Open zsh shell in container |
| `devc exec <cmd>` | Run command in container |
| `devc rebuild` | Rebuild container (preserves volumes) |
| `devc down` | Stop container |
| `devc destroy` | Remove container, volumes, image |
| `devc upgrade` | Upgrade Claude Code inside container |
| `devc mount <path>` | Add a bind mount |
| `devc sync` | Sync Claude sessions to host |

For headless/CI usage, set `CLAUDE_CODE_OAUTH_TOKEN` in the environment before starting the container.

#### Keeping the devcontainer up to date

The `.devcontainer/` directory is managed as a [git subtree](https://www.atlassian.com/git/tutorials/git-subtree) from [trailofbits/claude-code-devcontainer](https://github.com/trailofbits/claude-code-devcontainer). To pull the latest upstream changes:

```bash
just devcontainer-update
```

This fetches from upstream and merges into `.devcontainer/`. If upstream changes conflict with local customizations, resolve conflicts normally and commit.

Local customizations over upstream:
- Docker-in-Docker support
- `just` command runner
- Playwright MCP with Chromium

### Manual Setup

- Python 3.12+ (via [uv](https://docs.astral.sh/uv/))
- Node 22+ (via [fnm](https://github.com/Schniz/fnm) or nvm)
- [just](https://github.com/casey/just) command runner
- [Claude CLI](https://docs.anthropic.com/en/docs/claude-code) (for AI features)

## Getting Started

```bash
# Install Python dependencies
just setup

# Install frontend dependencies
just web-setup

# Start both servers (API on :8000, frontend on :5173)
just dev
```

## Development Workflow

### Backend

The FastAPI server runs with hot reload:
```bash
just serve
```

Add endpoints in `app/api/routes.py`. Add background jobs in `app/api/jobs.py`.

### Frontend

The Vite dev server proxies `/api` to the backend:
```bash
just web-dev
```

Add shadcn components:
```bash
cd web && npx shadcn add <component>
```

### Testing

```bash
just test            # Run all tests
just test -v         # Verbose output
just test -k test_health  # Run specific test
```

### Production Build

```bash
just dashboard       # Build frontend + start server on port 8000
```

Or with Docker:
```bash
docker compose up -d --build
```
