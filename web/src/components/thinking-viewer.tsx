import { useState, useEffect, useRef } from "react";
import { Brain, Terminal, ArrowRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api } from "@/api/client";
import type { StreamChunk } from "@/api/types";

interface ThinkingViewerProps {
  jobId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ThinkingViewer({ jobId, open, onOpenChange }: ThinkingViewerProps) {
  const [chunks, setChunks] = useState<StreamChunk[]>([]);
  const [polling, setPolling] = useState(true);
  const cursorRef = useRef(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Reset when job changes
  useEffect(() => {
    setChunks([]);
    cursorRef.current = 0;
    setPolling(true);
  }, [jobId]);

  // Poll for new chunks from live job stream
  useEffect(() => {
    if (!jobId || !open || !polling) return;

    let cancelled = false;

    const poll = async () => {
      try {
        const data = await api.jobStream(jobId, cursorRef.current);
        if (cancelled) return;
        if (data.chunks.length > 0) {
          setChunks((prev) => [...prev, ...data.chunks]);
          cursorRef.current = data.next;
        }
      } catch {
        // Stream not available yet
      }
    };

    poll();
    const id = setInterval(poll, 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [jobId, open, polling]);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chunks]);

  // Group consecutive chunks of the same type for display
  const sections = groupChunks(chunks);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="size-4" />
            AI Thinking
          </DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto space-y-3 min-h-0">
          {sections.length === 0 && (
            <p className="text-sm text-muted-foreground py-4 text-center">
              Waiting for AI to start thinking...
            </p>
          )}
          {sections.map((section, i) => (
            <div key={i}>
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
      </DialogContent>
    </Dialog>
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
