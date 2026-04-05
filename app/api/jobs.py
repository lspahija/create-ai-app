"""Background job registry, runners, and trigger endpoints."""

from __future__ import annotations

import asyncio
import json
import logging
import threading
import uuid
from dataclasses import asdict, dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from fastapi.responses import StreamingResponse

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
    started_at: str = ""
    completed_at: str | None = None
    error: str | None = None
    params: dict = field(default_factory=dict)
    progress: str = ""
    progress_pct: int = 0


_jobs: dict[str, JobStatus] = {}
_stream_buffers: dict[str, list[dict]] = {}
_lock = threading.Lock()

_background_tasks: set[asyncio.Task] = set()
_cancel_events: dict[str, asyncio.Event] = {}


async def shutdown() -> None:
    """Cancel all background tasks. Called from app lifespan."""
    for task in _background_tasks:
        task.cancel()
    await asyncio.gather(*_background_tasks, return_exceptions=True)


def _evict_old_jobs() -> None:
    """Drop oldest completed/failed jobs when over _MAX_JOBS. Caller holds _lock."""
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
    """Check if a job of the given type is running. Caller must hold _lock."""
    return any(
        j.job_type == job_type and j.status in ("pending", "running") for j in _jobs.values()
    )


def _make_progress_callback(job_id: str):
    def update(stage: str, pct: int = 0):
        with _lock:
            job = _jobs.get(job_id)
            if job:
                job.progress = stage
                job.progress_pct = pct

    return update


def _make_stream_callback(job_id: str):
    with _lock:
        _stream_buffers[job_id] = []

    def on_stream(block_type: str, text: str):
        with _lock:
            buf = _stream_buffers.get(job_id)
            if buf is not None and len(buf) < _MAX_STREAM_CHUNKS:
                buf.append({"type": block_type, "text": text})

    return on_stream


def _update_job(job_id: str, status: str, *, error: str | None = None) -> None:
    with _lock:
        job = _jobs[job_id]
        job.status = status
        if error is not None:
            job.error = error
        if status in ("completed", "failed"):
            job.completed_at = datetime.now(UTC).isoformat()


# ── Background runners ───────────────────────────────────────────────────


async def _run_strategy_job(job_id: str, params: dict) -> None:
    """Run an AI agent strategy."""
    from app.config import PROJECT_ROOT
    from app.strategies.executor import execute_strategy
    from app.strategies.loader import load_strategy

    _update_job(job_id, "running")
    progress = _make_progress_callback(job_id)
    on_stream = _make_stream_callback(job_id)
    progress("Loading strategy...", 5)

    try:
        strategy = load_strategy(params["strategy"])
        cwd = Path(params.get("cwd") or PROJECT_ROOT)
        variables = params.get("variables", {})

        cancel_event = asyncio.Event()
        with _lock:
            _cancel_events[job_id] = cancel_event

        progress("Executing strategy...", 10)
        await execute_strategy(
            strategy=strategy,
            variables=variables,
            cwd=cwd,
            on_stream=on_stream,
            on_progress=progress,
            cancel_event=cancel_event,
        )

        progress("Complete", 100)
        _update_job(job_id, "completed")
    except asyncio.CancelledError:
        _update_job(job_id, "failed", error="Job cancelled")
        raise
    except (FileNotFoundError, ValueError) as e:
        _update_job(job_id, "failed", error=str(e))
    except Exception as e:
        logger.exception("Strategy job %s failed", job_id)
        _update_job(job_id, "failed", error=str(e))
    finally:
        with _lock:
            _cancel_events.pop(job_id, None)


# ── Request models ───────────────────────────────────────────────────────


class StrategyJobRequest(BaseModel):
    strategy: str
    variables: dict[str, str] = {}


class DemoJobRequest(BaseModel):
    topic: str = "the meaning of life"


# ── Trigger endpoints ────────────────────────────────────────────────────


def _task_done(task: asyncio.Task) -> None:
    """Clean up task reference and log unhandled errors."""
    _background_tasks.discard(task)
    if not task.cancelled() and task.exception():
        logger.error("Background job failed: %s", task.exception())


def _submit_job(
    job_type: str,
    params: dict,
    target: Any,
    *,
    unique: bool = False,
) -> dict:
    """Create a job, start an async task, return {job_id, status}.

    The target coroutine receives (job_id, params).
    If unique=True, raises HTTPException(409) when a job of this type is already running.
    """
    job_id = uuid.uuid4().hex[:12]
    job = JobStatus(
        job_id=job_id,
        job_type=job_type,
        started_at=datetime.now(UTC).isoformat(),
        params=params,
    )
    with _lock:
        if unique and _has_running_job(job_type):
            raise HTTPException(409, f"A {job_type} job is already running")
        _jobs[job_id] = job
        _evict_old_jobs()

    task = asyncio.create_task(target(job_id, params))
    _background_tasks.add(task)
    task.add_done_callback(_task_done)
    return {"job_id": job_id, "status": "pending"}


@router.post("/api/demo-job", status_code=202)
async def trigger_demo_job(req: DemoJobRequest):
    return _submit_job(
        "strategy",
        {"strategy": "one-shot", "variables": {"topic": req.topic}},
        _run_strategy_job,
        unique=True,
    )


@router.post("/api/jobs", status_code=202)
async def trigger_strategy_job(req: StrategyJobRequest):
    return _submit_job("strategy", req.model_dump(), _run_strategy_job)


@router.get("/api/strategies")
async def get_strategies():
    from app.strategies.loader import load_all_strategies

    strategies = load_all_strategies()
    return [
        {"name": s.name, "description": s.description, "mode": s.execution.mode}
        for s in strategies.values()
    ]


@router.post("/api/jobs/{job_id}/cancel", status_code=200)
async def cancel_job(job_id: str):
    with _lock:
        event = _cancel_events.get(job_id)
        job = _jobs.get(job_id)
    if not job:
        raise HTTPException(404, f"Job not found: {job_id}")
    if job.status not in ("pending", "running"):
        raise HTTPException(409, f"Job is already {job.status}")
    if event:
        event.set()
    return {"job_id": job_id, "status": "cancelling"}


# ── Status endpoints ─────────────────────────────────────────────────────


@router.get("/api/jobs")
async def list_jobs():
    with _lock:
        jobs = sorted(_jobs.values(), key=lambda j: j.started_at, reverse=True)
        return [asdict(j) for j in jobs]


@router.get("/api/jobs/{job_id}")
async def get_job(job_id: str):
    with _lock:
        job = _jobs.get(job_id)
    if not job:
        raise HTTPException(404, f"Job not found: {job_id}")
    return asdict(job)


@router.get("/api/jobs/{job_id}/stream")
async def stream_job(job_id: str):
    """Stream job output as Server-Sent Events."""
    with _lock:
        if job_id not in _jobs:
            raise HTTPException(404, f"Job not found: {job_id}")

    async def generate():
        cursor = 0
        while True:
            with _lock:
                buf = _stream_buffers.get(job_id, [])
                chunks = buf[cursor:]
                cursor = len(buf)
                job = _jobs.get(job_id)
                done = job and job.status in ("completed", "failed")
            for chunk in chunks:
                yield f"data: {json.dumps(chunk)}\n\n"
            if done and not chunks:
                return
            await asyncio.sleep(0.3)

    return StreamingResponse(generate(), media_type="text/event-stream")
