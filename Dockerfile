# Production Dockerfile
# Multi-stage: build frontend, then runtime with Python + Claude CLI

# Global ARG — must be before any FROM to be usable in FROM lines
ARG UV_VERSION=0.10.0

# ── Stage 1: Build frontend ────────────────────────────────────────────────
FROM node:22-slim AS frontend
WORKDIR /build
COPY web/package.json web/package-lock.json web/.npmrc ./
RUN npm ci
COPY web/ ./
RUN npm run build

# ── Stage 2: Runtime ───────────────────────────────────────────────────────
FROM ghcr.io/astral-sh/uv:${UV_VERSION} AS uv
FROM mcr.microsoft.com/devcontainers/base:ubuntu-24.04

SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# Install bubblewrap (Claude Code sandbox) + minimal tools
RUN apt-get update && apt-get install -y --no-install-recommends \
  bubblewrap socat jq \
  && apt-get clean && rm -rf /var/lib/apt/lists/*

COPY --from=uv /uv /usr/local/bin/uv

# Create app user and dirs
RUN mkdir -p /app/data /home/vscode/.claude && \
  chown -R vscode:vscode /app /home/vscode/.claude

USER vscode
ENV PATH="/home/vscode/.local/bin:$PATH"

# Install Python 3.13
RUN uv python install 3.13 --default

# Install Claude Code CLI
RUN curl -fsSL https://claude.ai/install.sh | bash

WORKDIR /app

# Install Python deps
COPY --chown=vscode pyproject.toml uv.lock* ./
RUN uv sync --extra web --no-dev --no-install-project 2>/dev/null || uv sync --extra web --no-install-project

# Copy application source
COPY --chown=vscode app/ app/
COPY --chown=vscode config.yaml ./
COPY --chown=vscode .devcontainer/post_install.py /opt/post_install.py

# Copy built frontend
COPY --from=frontend /build/dist web/dist/

# On first run, copy config to /app/data (persistent volume).
COPY --chown=vscode <<'EOF' /opt/entrypoint.sh
#!/bin/bash
set -e

# Initialize persistent data dir with config defaults if empty
[ -f /app/data/config.yaml ] || cp /app/config.yaml /app/data/config.yaml
ln -sf /app/data/config.yaml /app/config.yaml

# Claude Code setup
uv run python /opt/post_install.py 2>/dev/null || true

exec uv run uvicorn app.api:app --host 0.0.0.0 --port 8000
EOF
RUN chmod +x /opt/entrypoint.sh

ENV CLAUDE_CONFIG_DIR="/home/vscode/.claude"

EXPOSE 8000

CMD ["/opt/entrypoint.sh"]
