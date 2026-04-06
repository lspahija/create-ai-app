// ── Strategies ───────────────────────────────────────────────────────────

export interface PromptConfig {
  system: string;
  task: string;
}

export interface ExecutionPolicy {
  mode: "one-shot" | "loop";
  interval: number;
  max_iterations: number;
  carry_context: boolean;
}

export interface Strategy {
  name: string;
  description: string;
  prompt: PromptConfig;
  agent: string;
  model: string | null;
  max_turns: number | null;
  timeout: number;
  options: Record<string, unknown>;
  execution: ExecutionPolicy;
  variables: string[];
}

export interface StrategyCreateRequest {
  name: string;
  description?: string;
  prompt: PromptConfig;
  agent?: string;
  model?: string | null;
  max_turns?: number | null;
  timeout?: number;
  options?: Record<string, unknown>;
  execution?: Partial<ExecutionPolicy>;
}

export type StrategyUpdateRequest = Omit<StrategyCreateRequest, "name">;

// ── Jobs ─────────────────────────────────────────────────────────────────

export interface JobStatus {
  job_id: string;
  job_type: string;
  status: "pending" | "running" | "completed" | "failed";
  started_at: string;
  completed_at: string | null;
  error: string | null;
  params: { strategy: string; variables: Record<string, string> };
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

export interface LaunchJobRequest {
  strategy: string;
  variables: Record<string, string>;
}

// ── Settings ─────────────────────────────────────────────────────────────

export interface SettingsResponse {
  oauth_token_set: boolean;
  default_agent: string;
}
