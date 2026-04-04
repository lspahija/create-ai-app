// ── Jobs ─────────────────────────────────────────────────────────────────

export interface JobStatus {
  job_id: string;
  job_type: string;
  status: "pending" | "running" | "completed" | "failed";
  started_at: string;
  completed_at: string | null;
  progress: string;
  progress_pct: number;
}

export interface JobResponse {
  job_id: string;
  status: string;
}

export interface StreamChunk {
  type: string;
  text: string;
}

export interface StreamResponse {
  chunks: StreamChunk[];
  next: number;
}

// ── Demo ─────────────────────────────────────────────────────────────────

export interface DemoJobRequest {
  topic: string;
}
