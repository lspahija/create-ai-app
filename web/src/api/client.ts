import type {
  JobStatus,
  JobResponse,
  Strategy,
  StrategyCreateRequest,
  StrategyUpdateRequest,
  LaunchJobRequest,
  SettingsResponse,
} from "./types";

const BASE = "/api";

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const headers: Record<string, string> = {};
  if (body != null) {
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
    credentials: "include",
    signal: AbortSignal.timeout(60_000),
  });

  if (res.status === 401) {
    window.location.reload();
    throw new Error("Authentication required");
  }

  if (!res.ok) {
    throw new Error(`API error ${res.status}: ${await res.text()}`);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

const get = <T>(path: string) => request<T>("GET", path);
const post = <T>(path: string, body?: unknown) => request<T>("POST", path, body);
const put = <T>(path: string, body?: unknown) => request<T>("PUT", path, body);
const del = <T>(path: string) => request<T>("DELETE", path);

export const api = {
  health: () => get<{ status: string }>("/health"),

  // Strategies
  strategies: () => get<Strategy[]>("/strategies"),
  strategy: (name: string) => get<Strategy>(`/strategies/${name}`),
  createStrategy: (data: StrategyCreateRequest) => post<Strategy>("/strategies", data),
  updateStrategy: (name: string, data: StrategyUpdateRequest) => put<Strategy>(`/strategies/${name}`, data),
  deleteStrategy: (name: string) => del<void>(`/strategies/${name}`),

  // Jobs
  launchJob: (data: LaunchJobRequest) => post<JobResponse>("/jobs", data),
  jobs: () => get<JobStatus[]>("/jobs"),
  job: (jobId: string) => get<JobStatus>(`/jobs/${jobId}`),
  cancelJob: (jobId: string) => post<{ job_id: string; status: string }>(`/jobs/${jobId}/cancel`),

  // Settings
  settings: () => get<SettingsResponse>("/settings"),
  setOAuthToken: (token: string) => put<{ ok: boolean }>("/settings/oauth-token", { token }),
  clearOAuthToken: () => del<{ ok: boolean }>("/settings/oauth-token"),
};
