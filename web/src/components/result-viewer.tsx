import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Markdown from "react-markdown";
import { FileText, Brain, Clock, Coins, RotateCw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ThinkingViewerContent } from "@/components/thinking-viewer";
import { api } from "@/api/client";

interface ResultViewerProps {
  jobId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ResultViewer({ jobId, open, onOpenChange }: ResultViewerProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ResultViewerContent key={jobId} jobId={jobId} open={open} />
    </Dialog>
  );
}

function ResultViewerContent({ jobId, open }: { jobId: string | null; open: boolean }) {
  const [selectedIteration, setSelectedIteration] = useState<string>("latest");

  const { data: job } = useQuery({
    queryKey: ["job", jobId],
    queryFn: () => api.job(jobId!),
    enabled: !!jobId && open,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "completed" || status === "failed" ? false : 3000;
    },
  });

  const isRunning = job?.status === "running" || job?.status === "pending";
  const hasIterations = (job?.iteration_results?.length ?? 0) > 0;

  // Determine which result text to show
  let displayResult: string | null = null;
  let displayMetadata: Record<string, unknown> = {};

  if (hasIterations && selectedIteration !== "latest") {
    const iter = job!.iteration_results.find(
      (r) => String(r.iteration) === selectedIteration
    );
    if (iter) {
      displayResult = iter.output || null;
      displayMetadata = iter.metadata;
    }
  } else {
    displayResult = job?.result ?? null;
    displayMetadata = job?.result_metadata ?? {};
  }

  return (
    <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <FileText className="size-4" />
          Job Output
        </DialogTitle>
      </DialogHeader>
      <Tabs defaultValue="result" className="flex-1 min-h-0 flex flex-col">
        <TabsList>
          <TabsTrigger value="result">
            <FileText className="size-3.5" />
            Result
          </TabsTrigger>
          <TabsTrigger value="thinking">
            <Brain className="size-3.5" />
            Thinking
          </TabsTrigger>
        </TabsList>

        <TabsContent value="result" className="flex-1 min-h-0 overflow-y-auto">
          {/* Iteration selector for loop jobs */}
          {hasIterations && (
            <div className="flex items-center gap-2 mb-3">
              <RotateCw className="size-3.5 text-muted-foreground" />
              <Select value={selectedIteration} onValueChange={setSelectedIteration}>
                <SelectTrigger className="w-48 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="latest">Latest result</SelectItem>
                  {[...job!.iteration_results].reverse().map((iter) => (
                    <SelectItem key={iter.iteration} value={String(iter.iteration)}>
                      Iteration {iter.iteration} {iter.success ? "(success)" : "(failed)"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground">
                {job!.iteration_results.length} iteration{job!.iteration_results.length !== 1 ? "s" : ""}
              </span>
            </div>
          )}

          {/* Result content */}
          {displayResult ? (
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <Markdown>{displayResult}</Markdown>
            </div>
          ) : isRunning ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Waiting for result...
            </p>
          ) : (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No result produced.
            </p>
          )}

          {/* Metadata chips */}
          {Object.keys(displayMetadata).length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t">
              {displayMetadata.cost_usd != null && (
                <Badge variant="secondary" className="text-xs font-normal gap-1">
                  <Coins className="size-3" />
                  ${Number(displayMetadata.cost_usd).toFixed(4)}
                </Badge>
              )}
              {displayMetadata.num_turns != null && (
                <Badge variant="secondary" className="text-xs font-normal gap-1">
                  <RotateCw className="size-3" />
                  {String(displayMetadata.num_turns)} turns
                </Badge>
              )}
              {displayMetadata.duration_seconds != null && (
                <Badge variant="secondary" className="text-xs font-normal gap-1">
                  <Clock className="size-3" />
                  {Number(displayMetadata.duration_seconds).toFixed(1)}s
                </Badge>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="thinking" className="flex-1 min-h-0">
          <ThinkingViewerContent jobId={jobId} open={true} />
        </TabsContent>
      </Tabs>
    </DialogContent>
  );
}
