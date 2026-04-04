# Automated Dependency Updates with Renovate

## Context

The project has no automated dependency update mechanism. Dependencies across 6 ecosystems (Python/uv, npm, Docker, GitHub Actions, devcontainer features, devcontainer tools) must be updated manually. Renovate is the best fit because it has native `uv` support, custom regex managers for Dockerfile ARG versions, and superior grouping/automerge capabilities.

## Files to Create/Modify

### 1. Create `/renovate.json`

Renovate configuration with:
- **Schedule**: Weekly (Monday mornings), 3-day minimum release age
- **Grouping**: Minor/patch updates grouped per ecosystem (one PR each for Python, npm, Docker, GitHub Actions, devcontainer tools). Major updates get individual PRs.
- **Automerge**: Minor/patch auto-squash-merge when CI passes. Major updates require manual review.
- **Managers**: Native `uv`, `npm`, `dockerfile`, `github-actions`, `devcontainer` + custom regex manager for Dockerfile ARG-pinned tool versions
- **Security**: Pin GitHub Actions to full SHAs via `pinDigests`

### 2. Modify `.devcontainer/Dockerfile`

Add `# renovate:` annotation comments above each pinned ARG so the custom regex manager can track them:

- Before `ARG GIT_DELTA_VERSION=0.18.2`: `# renovate: datasource=github-releases depName=dandavison/delta`
- Before `ARG FZF_VERSION=0.70.0`: `# renovate: datasource=github-releases depName=junegunn/fzf`
- Before `ARG JUST_VERSION=1.40.0`: `# renovate: datasource=github-releases depName=casey/just`
- Before `ARG ZSH_IN_DOCKER_VERSION=1.2.1`: `# renovate: datasource=github-releases depName=deluan/zsh-in-docker`

### 3. Modify `Dockerfile`

Add annotation before `ARG UV_VERSION=0.10.0`:
```
# renovate: datasource=docker depName=ghcr.io/astral-sh/uv
```

### 4. Install the Renovate GitHub App

Go to https://github.com/apps/renovate and install it on the repository. On first run, Renovate opens an onboarding PR previewing its behavior — merge that to activate.

## What Gets Covered

| Ecosystem | Renovate Manager | Files Updated |
|---|---|---|
| Python / uv | `uv` (native) | `pyproject.toml`, `uv.lock` |
| npm | `npm` (native) | `web/package.json`, `web/package-lock.json` |
| Docker images | `dockerfile` (native) | `Dockerfile`, `.devcontainer/Dockerfile` |
| GitHub Actions | `github-actions` (native) | `.github/workflows/ci.yml` |
| Devcontainer features | `devcontainer` (native) | `.devcontainer/devcontainer.json` |
| Devcontainer tools | custom regex | `.devcontainer/Dockerfile` (ARG versions) |
| Production UV image | custom regex | `Dockerfile` (UV_VERSION ARG) |

## Expected PR Volume

- **0-2 grouped PRs/week** for minor/patch (automerged if CI passes)
- **Occasional individual PRs** for major bumps (manual review)

## Verification

1. After creating the config, validate JSON syntax: `python -m json.tool renovate.json`
2. Install the Renovate GitHub App on the repo
3. Renovate will open an onboarding PR — review it to confirm all managers are detected
4. After merging the onboarding PR, Renovate will open grouped update PRs on the configured schedule
5. Verify automerge works by checking that a minor/patch PR with passing CI gets merged automatically
