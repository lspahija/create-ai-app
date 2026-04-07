import { useState, useEffect } from "react";
import { Brain, Terminal, ArrowRight, ArrowDown } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAutoScroll } from "@/hooks/use-auto-scroll";
import type { StreamChunk } from "@/api/types";

interface ThinkingViewerProps {
  jobId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ThinkingViewer({ jobId, open, onOpenChange }: ThinkingViewerProps) {
  // key={jobId} remounts inner component, resetting all state when job changes
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ThinkingViewerContent key={jobId} jobId={jobId} open={open} />
    </Dialog>
  );
}

export function ThinkingViewerContent({ jobId, open }: { jobId: string | null; open: boolean }) {
  const [chunks, setChunks] = useState<StreamChunk[]>([]);
  const { scrollContainerRef, bottomRef, showScrollButton, scrollToBottom } =
    useAutoScroll([chunks]);

  // Stream chunks via SSE
  useEffect(() => {
    if (!jobId || !open) return;

    const es = new EventSource(`/api/jobs/${jobId}/stream`);
    es.onmessage = (e) => {
      const chunk = JSON.parse(e.data) as StreamChunk;
      setChunks((prev) => [...prev, chunk]);
    };

    return () => es.close();
  }, [jobId, open]);

  // Group consecutive chunks of the same type for display
  const sections = groupChunks(chunks);

  return (
    <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Brain className="size-4" />
          AI Thinking
        </DialogTitle>
      </DialogHeader>
      <div className="relative flex-1 min-h-0 flex flex-col">
        <div
          ref={scrollContainerRef}
          className="flex-1 min-h-0 overflow-y-auto space-y-3"
          data-testid="thinking-scroll-container"
        >
          {sections.length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Waiting for AI to start thinking...
            </p>
          )}
          {sections.map((section, i) => (
            <div key={i} data-testid="thinking-section">
              {section.type === "thinking" ? (
                <div className="bg-muted/50 rounded-lg p-3 border border-dashed">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Thinking</p>
                  <p className="text-sm whitespace-pre-wrap">{section.text}</p>
                </div>
              ) : section.type === "tool_use" ? (
                <div className="bg-blue-500/5 rounded-lg p-3 border border-blue-500/20">
                  <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1 flex items-center gap-1">
                    <ArrowRight className="size-3" />
                    Tool Call
                  </p>
                  <pre className="text-xs whitespace-pre-wrap font-mono bg-background/50 rounded p-2 mt-1 overflow-x-auto">{section.text}</pre>
                </div>
              ) : section.type === "tool_result" ? (
                <div className="bg-green-500/5 rounded-lg p-3 border border-green-500/20">
                  <p className="text-xs font-medium text-green-600 dark:text-green-400 mb-1 flex items-center gap-1">
                    <Terminal className="size-3" />
                    Tool Result
                  </p>
                  <pre className="text-xs whitespace-pre-wrap font-mono bg-background/50 rounded p-2 mt-1 overflow-x-auto max-h-60 overflow-y-auto">{section.text}</pre>
                </div>
              ) : (
                <div className="rounded-lg p-3">
                  <p className="text-xs font-medium text-muted-foreground mb-1">Response</p>
                  <p className="text-sm whitespace-pre-wrap">{section.text}</p>
                </div>
              )}
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
        {showScrollButton && (
          <Button
            variant="secondary"
            size="icon-sm"
            className="absolute bottom-3 right-3 rounded-full shadow-md z-10 opacity-80 hover:opacity-100 transition-opacity"
            onClick={scrollToBottom}
            aria-label="Scroll to bottom"
            data-testid="scroll-to-bottom-btn"
          >
            <ArrowDown className="size-3.5" />
          </Button>
        )}
      </div>
    </DialogContent>
  );
}

/** Group consecutive chunks of the same type into sections. */
function groupChunks(chunks: StreamChunk[]): { type: string; text: string }[] {
  const sections: { type: string; text: string }[] = [];
  for (const chunk of chunks) {
    const last = sections[sections.length - 1];
    if (last && last.type === chunk.type) {
      last.text += chunk.text;
    } else {
      sections.push({ type: chunk.type, text: chunk.text });
    }
  }
  return sections;
}
