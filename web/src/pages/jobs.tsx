import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Eye, XCircle, Loader2, Check, AlertTriangle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/api/client";
import { useElapsed } from "@/hooks/use-elapsed";
import { ThinkingViewer } from "@/components/thinking-viewer";
import { toast } from "sonner";
import type { JobStatus } from "@/api/types";

const STATUS_CONFIG: Record<string, { icon: typeof Check; color: string; label: string }> = {
  pending: { icon: Clock, color: "text-yellow-500", label: "Pending" },
  running: { icon: Loader2, color: "text-blue-500", label: "Running" },
  completed: { icon: Check, color: "text-green-500", label: "Completed" },
  failed: { icon: AlertTriangle, color: "text-red-500", label: "Failed" },
};

function JobRow({
  job,
  onView,
  onCancel,
}: {
  job: JobStatus;
  onView: () => void;
  onCancel: () => void;
}) {
  const isActive = job.status === "pending" || job.status === "running";
  const elapsed = useElapsed(job.started_at, isActive);
  const cfg = STATUS_CONFIG[job.status] ?? STATUS_CONFIG.pending;
  const Icon = cfg.icon;

  return (
    <div className="flex items-center gap-4 py-3 px-4">
      <Icon
        className={`size-4 shrink-0 ${cfg.color} ${job.status === "running" ? "animate-spin" : ""}`}
      />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{job.params?.strategy ?? job.job_type}</span>
          <Badge variant="outline" className="text-xs">
            {cfg.label}
          </Badge>
        </div>
        {job.progress && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{job.progress}</p>
        )}
        {job.error && (
          <p className="text-xs text-red-500 mt-0.5 truncate">{job.error}</p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {isActive && (
          <div className="flex items-center gap-2">
            <div className="w-20 bg-muted rounded-full h-1.5">
              <div
                className="h-1.5 rounded-full bg-primary transition-all duration-500"
                style={{ width: `${Math.max(job.progress_pct, 2)}%` }}
              />
            </div>
            {elapsed && (
              <span className="text-xs text-muted-foreground tabular-nums w-12 text-right">
                {elapsed}
              </span>
            )}
          </div>
        )}
        {!isActive && job.completed_at && (
          <span className="text-xs text-muted-foreground tabular-nums">
            {new Date(job.completed_at).toLocaleTimeString()}
          </span>
        )}
        <Button variant="ghost" size="icon" className="size-7" onClick={onView} title="View output">
          <Eye className="size-3.5" />
        </Button>
        {isActive && (
          <Button
            variant="ghost"
            size="icon"
            className="size-7 text-destructive hover:text-destructive"
            onClick={onCancel}
            title="Cancel job"
          >
            <XCircle className="size-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}

export function JobsPage() {
  const { data: jobs, isLoading } = useQuery({
    queryKey: ["jobs"],
    queryFn: api.jobs,
    staleTime: 1_000,
    refetchInterval: 3_000,
  });

  const [viewJobId, setViewJobId] = useState<string | null>(null);

  async function handleCancel(jobId: string) {
    try {
      await api.cancelJob(jobId);
      toast.success("Job cancellation requested");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to cancel job");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Jobs</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Monitor and manage running jobs
        </p>
      </div>

      {isLoading && (
        <p className="text-sm text-muted-foreground">Loading jobs...</p>
      )}

      {jobs && jobs.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No jobs yet. Run a strategy to get started.
          </CardContent>
        </Card>
      )}

      {jobs && jobs.length > 0 && (
        <Card>
          <CardContent className="p-0 divide-y">
            {jobs.map((job) => (
              <JobRow
                key={job.job_id}
                job={job}
                onView={() => setViewJobId(job.job_id)}
                onCancel={() => handleCancel(job.job_id)}
              />
            ))}
          </CardContent>
        </Card>
      )}

      <ThinkingViewer
        jobId={viewJobId}
        open={!!viewJobId}
        onOpenChange={(open) => !open && setViewJobId(null)}
      />
    </div>
  );
}
