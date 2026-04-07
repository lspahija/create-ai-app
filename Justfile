# Default: list available commands
default:
    @just --list

# Install Python dependencies
setup:
    uv sync

# Run tests
test *args:
    uv run --group dev --extra web python -m pytest {{args}}

# Lint Python code
lint:
    uv run --group dev ruff check app/ tests/
    uv run --group dev ruff format --check app/ tests/

# Auto-format Python code
fmt:
    uv run --group dev ruff check --fix app/ tests/
    uv run --group dev ruff format app/ tests/

# Local dev: API + frontend in one terminal (Ctrl+C stops both)
dev:
    #!/usr/bin/env bash
    trap 'kill 0' EXIT
    uv run --extra web uvicorn app.api:app \
      --host 0.0.0.0 --reload --reload-dir app --port 8000 &
    cd web && npm run dev

# Start API server
serve *args:
    uv run --extra web uvicorn app.api:app --reload --reload-dir app --port 8000 {{args}}

# Frontend dev server
web-dev:
    cd web && npm run dev

# Install frontend deps
web-setup:
    cd web && npm install

# Build frontend for production
web-build:
    cd web && npm run build

# Build frontend + serve on single port
dashboard:
    just web-build && just serve

# Check API availability
health:
    curl -sf http://localhost:8000/api/health && echo " OK" || echo " FAIL"

# Run Playwright E2E tests for the frontend
test-e2e:
    cd web && npx playwright test

# Pull latest devcontainer updates from upstream
devcontainer-update:
    git fetch upstream-devcontainer
    git subtree pull --prefix=.devcontainer upstream-devcontainer main --squash -m "Update devcontainer from upstream"
