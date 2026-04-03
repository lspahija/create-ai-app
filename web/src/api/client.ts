import type {
  JobStatus,
  JobResponse,
  StreamResponse,
  DemoJobRequest,
} from "./types";

const BASE = "/api";

function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem("auth_token");
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const headers: Record<string, string> = {
    ...getAuthHeader(),
  };
  if (body != null) {
    headers["Content-Type"] = "application/json";
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 60_000);
  let res: Response;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: body != null ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeoutId);
  }

  if (res.status === 401) {
    localStorage.removeItem("auth_token");
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
  jobStream: (jobId: string, after: number) =>
    get<StreamResponse>(`/jobs/${jobId}/stream?after=${after}`),
};
