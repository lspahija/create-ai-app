# Development

## Prerequisites

### DevContainer (recommended)

Open this project in VS Code with the Dev Containers extension. Everything is pre-installed:
- Python 3.13, uv, Node 22, Claude CLI
- fzf, ripgrep, ast-grep, just, tmux
- Playwright + Chromium for MCP browser automation

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
