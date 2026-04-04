import type {
  JobStatus,
  JobResponse,
  DemoJobRequest,
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
  return res.json() as Promise<T>;
}

const get = <T>(path: string) => request<T>("GET", path);
const post = <T>(path: string, body?: unknown) => request<T>("POST", path, body);

export const api = {
  health: () => get<{ status: string }>("/health"),

  // Jobs
  triggerDemoJob: (params: DemoJobRequest) => post<JobResponse>("/demo-job", params),
  jobs: () => get<JobStatus[]>("/jobs"),
  job: (jobId: string) => get<JobStatus>(`/jobs/${jobId}`),
};
