# Development

All development happens inside the devcontainer via the `devc` CLI (from [trailofbits/claude-code-devcontainer](https://github.com/trailofbits/claude-code-devcontainer)). Everything is pre-installed:
- Python 3.13, uv, Node 22, Claude CLI
- fzf, ripgrep, ast-grep, just, tmux
- Playwright + Chromium for MCP browser automation

## Prerequisites

Requires [Docker](https://docker.com/products/docker-desktop) (or [OrbStack](https://orbstack.dev/) / [Colima](https://github.com/abiosoft/colima)). First-time setup on the host:

```bash
# Install the devcontainer CLI (one-time)
npm install -g @devcontainers/cli

# Install devc to ~/.local/bin (one-time)
.devcontainer/install.sh self-install
# Ensure ~/.local/bin is on your PATH:
#   zsh:  echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc && source ~/.zshrc
#   bash: echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc && source ~/.bashrc
#   fish: fish_add_path ~/.local/bin
```

## Getting Started

```bash
# Start the devcontainer and open a shell
devc .
devc shell
claude             # First time: follow login prompts (auth persists across rebuilds)

# Inside the container:
just setup && just web-setup && just dev
```

## `devc` Commands

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

See [.devcontainer/README.md](../.devcontainer/README.md) for advanced topics (Docker-in-Docker, network isolation, file sharing, security model, troubleshooting).

## Adding Tools to the Container

- **CLI tools** (e.g. ripgrep, jq): Add to `.devcontainer/Dockerfile`, then `devc rebuild`
- **Dev features** (e.g. Docker, language runtimes): Add to `features` in `.devcontainer/devcontainer.json` — see [available features](https://containers.dev/features)
- **Project services** (e.g. Postgres, Redis): Use `docker compose` inside the container (Docker-in-Docker is enabled)

## Keeping the Devcontainer Up to Date

The `.devcontainer/` directory is managed as a [git subtree](https://www.atlassian.com/git/tutorials/git-subtree) from [trailofbits/claude-code-devcontainer](https://github.com/trailofbits/claude-code-devcontainer). To pull the latest upstream changes:

```bash
just devcontainer-update
```

This fetches from upstream and merges into `.devcontainer/`. If upstream changes conflict with local customizations, resolve conflicts normally and commit.

Local customizations over upstream:
- Docker-in-Docker support
- `just` command runner
- Playwright MCP with Chromium

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
