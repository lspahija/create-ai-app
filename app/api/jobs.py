"""Background job registry, runners, and trigger endpoints."""

from __future__ import annotations

import logging
import threading
import uuid
from dataclasses import asdict, dataclass, field
from datetime import UTC, datetime

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter()

_MAX_JOBS = 50
_MAX_STREAM_CHUNKS = 5000

# ── Job state ────────────────────────────────────────────────────────────


@dataclass
class JobStatus:
    job_id: str
    job_type: str
    status: str = "pending"  # "pending" | "running" | "completed" | "failed"
    run_id: str | None = None
    started_at: str = ""
    completed_at: str | None = None
    error: str | None = None
    params: dict = field(default_factory=dict)
    progress: str = ""
    progress_pct: int = 0


_jobs: dict[str, JobStatus] = {}
_jobs_lock = threading.Lock()

_stream_buffers: dict[str, list[dict]] = {}
_stream_lock = threading.Lock()


def _evict_old_jobs() -> None:
    """Drop oldest completed/failed jobs when over _MAX_JOBS. Caller holds _jobs_lock."""
    if len(_jobs) <= _MAX_JOBS:
        return
    finished = sorted(
        ((k, j) for k, j in _jobs.items() if j.status in ("completed", "failed")),
        key=lambda kj: kj[1].started_at,
    )
    to_remove = len(_jobs) - _MAX_JOBS
    for key, _ in finished[:to_remove]:
        del _jobs[key]
        _stream_buffers.pop(key, None)


def _has_running_job(job_type: str) -> bool:
    """Check if a job of the given type is running. Caller must hold _jobs_lock."""
    return any(
        j.job_type == job_type and j.status in ("pending", "running") for j in _jobs.values()
    )


def _make_progress_callback(job_id: str):
    def update(stage: str, pct: int = 0):
        with _jobs_lock:
            job = _jobs.get(job_id)
            if job:
                job.progress = stage
                job.progress_pct = pct

    return update


def _make_stream_callback(job_id: str):
    with _stream_lock:
        _stream_buffers[job_id] = []

    def on_stream(block_type: str, text: str):
        with _stream_lock:
            buf = _stream_buffers.get(job_id)
            if buf is not None and len(buf) < _MAX_STREAM_CHUNKS:
                buf.append({"type": block_type, "text": text})

    return on_stream


def _complete_job(job_id: str, run_id: str) -> None:
    with _jobs_lock:
        _jobs[job_id].status = "completed"
        _jobs[job_id].run_id = run_id
        _jobs[job_id].completed_at = datetime.now(UTC).isoformat()


def _fail_job(job_id: str, error: str) -> None:
    with _jobs_lock:
        _jobs[job_id].status = "failed"
        _jobs[job_id].error = error
        _jobs[job_id].completed_at = datetime.now(UTC).isoformat()


def _start_job(job_id: str) -> None:
    with _jobs_lock:
        _jobs[job_id].status = "running"


# ── Background runners ───────────────────────────────────────────────────


def _run_demo_job(job_id: str, params: dict) -> None:
    """Run the AI adapter to think about a user-supplied topic."""
    from app.adapters import get_adapter, run_sync
    from app.api.helpers import PROJECT_ROOT
    from app.config import load_config

    _start_job(job_id)
    progress = _make_progress_callback(job_id)
    on_stream = _make_stream_callback(job_id)
    progress("Starting AI agent...", 10)

    try:
        config = load_config(PROJECT_ROOT / "config.yaml")
        adapter = get_adapter(config.default_agent)

        topic = params.get("topic", "the meaning of life")
        prompt = (
            "Think about the following topic and share your thoughts"
            f" in a few paragraphs:\n\n{topic}"
        )

        progress("Running...", 30)
        result = run_sync(
            adapter,
            prompt=prompt,
            cwd=PROJECT_ROOT,
            timeout=config.agent_timeout_seconds,
            max_turns=config.agent_max_turns,
            on_stream=on_stream,
        )

        progress("Complete", 100)
        _complete_job(job_id, result.output[:100] if result.output else "done")
    except Exception as e:
        logger.exception("Demo job %s failed", job_id)
        _fail_job(job_id, str(e))


# ── Request models ───────────────────────────────────────────────────────


class DemoJobRequest(BaseModel):
    topic: str = "the meaning of life"


# ── Trigger endpoints ────────────────────────────────────────────────────


def _submit_job(
    job_type: str,
    params: dict,
    target,
    extra_args: tuple = (),
    *,
    unique: bool = False,
) -> dict:
    """Create a job, start its thread, return {job_id, status}.

    If unique=True, raises HTTPException(409) when a job of this type is already running.
    """
    job_id = uuid.uuid4().hex[:12]
    job = JobStatus(
        job_id=job_id,
        job_type=job_type,
        started_at=datetime.now(UTC).isoformat(),
        params=params,
    )
    with _jobs_lock:
        if unique and _has_running_job(job_type):
            raise HTTPException(409, f"A {job_type} job is already running")
        _jobs[job_id] = job
        _evict_old_jobs()

    threading.Thread(target=target, args=(job_id, *extra_args), daemon=True).start()
    return {"job_id": job_id, "status": "pending"}


@router.post("/api/demo-job", status_code=202)
def trigger_demo_job(req: DemoJobRequest):
    params = req.model_dump()
    return _submit_job("demo", params, _run_demo_job, (params,), unique=True)


# ── Status endpoints ─────────────────────────────────────────────────────


@router.get("/api/jobs")
def list_jobs():
    with _jobs_lock:
        jobs = sorted(_jobs.values(), key=lambda j: j.started_at, reverse=True)
        return [asdict(j) for j in jobs]


@router.get("/api/jobs/{job_id}")
def get_job(job_id: str):
    with _jobs_lock:
        job = _jobs.get(job_id)
    if not job:
        raise HTTPException(404, f"Job not found: {job_id}")
    return asdict(job)


@router.get("/api/jobs/{job_id}/stream")
def get_job_stream(job_id: str, after: int = Query(0, ge=0)):
    with _stream_lock:
        buf = _stream_buffers.get(job_id)
        if buf is None:
            raise HTTPException(404, f"No stream data for job {job_id}")
        chunks = buf[after:]
        total = len(buf)
    return {"chunks": chunks, "next": total}
