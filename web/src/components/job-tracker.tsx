import { useState, useEffect } from "react";
import { Loader2, Check } from "lucide-react";
import { useJobs } from "@/hooks/use-queries";
import { useElapsed } from "@/hooks/use-elapsed";
import type { JobStatus } from "@/api/types";

const JOB_LABELS: Record<string, string> = {
  demo: "AI Job",
};

function JobRow({ job }: { job: JobStatus }) {
  const isActive = job.status === "pending" || job.status === "running";
  const elapsed = useElapsed(job.started_at, isActive);
  const progressText = job.progress || (job.status === "pending" ? "Starting..." : "Running...");

  return (
    <div className="flex items-center gap-3 text-sm">
      <div className="flex items-center gap-1.5 min-w-0">
        {isActive ? (
          <Loader2 className="size-3.5 animate-spin text-primary shrink-0" />
        ) : (
          <Check className="size-3.5 text-green-500 shrink-0" />
        )}
        <span className="font-medium whitespace-nowrap">
          {JOB_LABELS[job.job_type] ?? job.job_type}
        </span>
        <span className="text-muted-foreground truncate">{progressText}</span>
      </div>
      {isActive && (
        <div className="flex items-center gap-2 ml-auto shrink-0">
          <div className="w-24 bg-muted rounded-full h-1.5">
            <div
              className="h-1.5 rounded-full bg-primary transition-all duration-500"
              style={{ width: `${Math.max(job.progress_pct, 2)}%` }}
            />
          </div>
          {elapsed && (
            <span className="text-xs text-muted-foreground tabular-nums">{elapsed}</span>
          )}
        </div>
      )}
      {!isActive && (
        <span className="text-xs text-green-500 ml-auto">Done</span>
      )}
    </div>
  );
}

export function JobTracker() {
  const { data: jobs } = useJobs();
  const [now, setNow] = useState(() => Date.now());

  const activeJobs = jobs?.filter(
    (j) => j.status === "pending" || j.status === "running",
  ) ?? [];

  const hasCompleted = (jobs ?? []).some(
    (j) => j.status === "completed" && j.completed_at,
  );

  // Tick to expire recently completed jobs from display
  useEffect(() => {
    if (!hasCompleted) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [hasCompleted]);

  const completedJobs = (jobs ?? []).filter(
    (j) => j.status === "completed" && j.completed_at &&
      now - new Date(j.completed_at!).getTime() < 5000,
  );

  const visible = [...activeJobs, ...completedJobs];

  if (visible.length === 0) return null;

  return (
    <div className="border-b bg-muted/30 px-6 py-2 space-y-1">
      {visible.map((job) => (
        <JobRow key={job.job_id} job={job} />
      ))}
    </div>
  );
}
