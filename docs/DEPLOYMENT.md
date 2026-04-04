# Deployment

The app deploys as a single Docker container serving the web UI on port 8000.

## Local Docker Deployment

Build and run the production container:

```bash
# Build and start
docker compose up -d

# Check logs
docker compose logs -f

# Rebuild after code changes
docker compose up -d --build
```

Visit http://localhost:8000 to access the app.

## Environment Variables

Create a `.env` file (or set in your deployment platform):

```bash
# Required for AI features
CLAUDE_CODE_OAUTH_TOKEN=your_token_here

# Optional: enable password auth (recommended for public deployment)
AUTH_PASSWORD=your_password_here

# Optional: separate JWT signing key (recommended for production)
# If not set, defaults to a hash of AUTH_PASSWORD
# Generate with: python -c "import secrets; print(secrets.token_urlsafe(32))"
JWT_SECRET=

# Optional: allow cross-origin requests (comma-separated origins)
# Only needed if your frontend is served from a different domain
CORS_ORIGINS=
```

## Authentication

Set `AUTH_PASSWORD` to require a password for all access. Recommended for any public deployment.

When enabled:
- The app shows a login page on first visit
- After entering the correct password, a JWT token is issued (valid for 30 days) and stored in an HTTP-only cookie
- All `/api/*` endpoints require a valid Bearer token (except `/api/auth/login` and `/api/auth/status`)
- Static files are served without auth so the login page can load
- No username needed — just the password
- Changing `AUTH_PASSWORD` invalidates all existing tokens (JWT signing key derived from password)

When not set, the app is fully open with no login required.

## Persistent Data

The Docker volume at `/app/data` holds:
- `config.yaml` — Application configuration

Initialized from repo defaults on first run, persists across rebuilds.

## Hetzner Cloud + Dokploy Deployment

Dokploy is a self-hosted PaaS that handles Docker, SSL, deployments, and monitoring.

### 1. Create Server

- Go to [Hetzner Cloud Console](https://console.hetzner.cloud/)
- Click "Add Server"
- Select: **CX32** (4 vCPU, 8 GB RAM, 80 GB disk) or larger
- Choose **Ubuntu 24.04 LTS**
- Add your SSH key
- Click "Create & Buy Now"

### 2. Install Dokploy

```bash
ssh root@<your-server-ip>
curl -sSL https://dokploy.com/install.sh | sh
# Access Dokploy at: http://<your-server-ip>:3000
```

### 3. Deploy

1. Create a new project in Dokploy dashboard
2. Add application → Git source → your repo → branch `main` → Dockerfile build
3. Set environment variables (`CLAUDE_CODE_OAUTH_TOKEN`, `AUTH_PASSWORD`)
4. **Configure domain**:
   - Go to the **"Domains"** tab
   - Click **"Add Domain"**
   - Enter your domain (requires an A record at your registrar pointing to the VPS IP)
   - Enable **"Generate SSL Certificate"** for automatic HTTPS
   - Click **"Add"**
5. Click Deploy

### 4. Access

- Via domain: `https://your-domain.com`
- Via IP: `http://<your-server-ip>:8000`
