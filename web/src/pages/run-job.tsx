import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Play, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useStrategy } from "@/hooks/use-strategies";
import { api } from "@/api/client";
import { ResultViewer } from "@/components/result-viewer";
import { toast } from "sonner";

export function RunJobPage() {
  const { name } = useParams<{ name: string }>();
  const navigate = useNavigate();
  const { data: strategy, isLoading } = useStrategy(name);

  const [variables, setVariables] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [showViewer, setShowViewer] = useState(false);

  // Filter out internal variables like previous_result
  const userVariables = (strategy?.variables ?? []).filter((v) => v !== "previous_result");

  async function handleRun() {
    if (!name) return;
    setSubmitting(true);
    try {
      const res = await api.launchJob({ strategy: name, variables });
      setJobId(res.job_id);
      setShowViewer(true);
      toast.success("Job launched");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to launch job");
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">Loading strategy...</p>;
  }

  if (!strategy) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground mb-4">Strategy not found</p>
        <Button asChild variant="outline">
          <Link to="/">Back to strategies</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Run: {name}</h2>
          {strategy.description && (
            <p className="text-sm text-muted-foreground">{strategy.description}</p>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        <Badge variant="secondary">{strategy.execution.mode}</Badge>
        <Badge variant="outline">{strategy.agent}</Badge>
        {strategy.model && <Badge variant="outline">{strategy.model}</Badge>}
      </div>

      {userVariables.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Variables</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {userVariables.map((v) => (
              <div key={v} className="space-y-1.5">
                <Label htmlFor={`var-${v}`}>
                  <code className="text-sm">${v}</code>
                </Label>
                <Input
                  id={`var-${v}`}
                  placeholder={`Enter value for $${v}`}
                  value={variables[v] ?? ""}
                  onChange={(e) => setVariables((prev) => ({ ...prev, [v]: e.target.value }))}
                />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {userVariables.length === 0 && (
        <Card>
          <CardContent className="py-6 text-center text-sm text-muted-foreground">
            This strategy has no variables to configure
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => navigate("/")}>
          Cancel
        </Button>
        <Button onClick={handleRun} disabled={submitting}>
          <Play className="size-4 mr-1.5" />
          {submitting ? "Launching..." : "Launch Job"}
        </Button>
      </div>

      <ResultViewer jobId={jobId} open={showViewer} onOpenChange={setShowViewer} />
    </div>
  );
}
