import pytest
from fastapi.testclient import TestClient

from app.api import app


@pytest.fixture()
def client():
    with TestClient(app) as c:
        yield c


def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    data = r.json()
    assert data["status"] in ("ok", "degraded")
    assert "adapter" in data
    assert "adapter_healthy" in data


def test_auth_status(client):
    r = client.get("/api/auth/status")
    assert r.status_code == 200
    data = r.json()
    assert "auth_required" in data


def test_jobs_empty(client):
    r = client.get("/api/jobs")
    assert r.status_code == 200
    assert r.json() == []
