import { useState, useEffect } from "react";

export function useElapsed(startedAt: string | undefined, active: boolean): string {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  if (!startedAt || !active) return "";
  const secs = Math.floor((now - new Date(startedAt).getTime()) / 1000);
  if (secs < 0) return "";
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}
