import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Brain } from "lucide-react";
import { api } from "@/api/client";
import { INPUT_CLS } from "@/lib/utils";
import { ThinkingViewer } from "@/components/thinking-viewer";

export function Home() {
  const [topic, setTopic] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  const [showThinking, setShowThinking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleRun() {
    setError("");
    setSubmitting(true);
    try {
      const res = await api.triggerDemoJob({ topic: topic || "the meaning of life" });
      setJobId(res.job_id);
      setShowThinking(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to start job");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Welcome</h2>
        <p className="text-muted-foreground mt-1">
          This is a starter template with an AI agent adapter, background jobs with streaming, and optional auth.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Brain className="size-4" />
            Run AI Job
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <input
            type="text"
            placeholder="Enter a topic (or leave blank for default)"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className={INPUT_CLS}
          />
          <Button onClick={handleRun} disabled={submitting} className="w-full">
            {submitting ? "Starting..." : "Run"}
          </Button>
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
        </CardContent>
      </Card>

      <ThinkingViewer
        jobId={jobId}
        open={showThinking}
        onOpenChange={setShowThinking}
      />
    </div>
  );
}
