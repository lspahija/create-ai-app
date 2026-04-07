import { useRef, useState, useCallback, useEffect } from "react";

const BOTTOM_THRESHOLD = 40;

interface UseAutoScrollReturn {
  scrollContainerRef: (el: HTMLDivElement | null) => void;
  bottomRef: React.RefObject<HTMLDivElement | null>;
  showScrollButton: boolean;
  scrollToBottom: () => void;
}

export function useAutoScroll(deps: unknown[]): UseAutoScrollReturn {
  const [scrollEl, setScrollEl] = useState<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const prevShowRef = useRef(false);
  const [showScrollButton, setShowScrollButton] = useState(false);

  // Callback ref — fires when the DOM element mounts/unmounts
  const scrollContainerRef = useCallback((el: HTMLDivElement | null) => {
    setScrollEl(el);
  }, []);

  // Scroll listener — re-attaches whenever the container element changes
  useEffect(() => {
    if (!scrollEl) return;

    const onScroll = () => {
      const nearBottom =
        scrollEl.scrollTop + scrollEl.clientHeight >=
        scrollEl.scrollHeight - BOTTOM_THRESHOLD;
      isAtBottomRef.current = nearBottom;

      // Only update state when visibility actually changes
      if (prevShowRef.current === nearBottom) {
        prevShowRef.current = !nearBottom;
        setShowScrollButton(!nearBottom);
      }
    };

    scrollEl.addEventListener("scroll", onScroll, { passive: true });
    return () => scrollEl.removeEventListener("scroll", onScroll);
  }, [scrollEl]);

  // Auto-scroll on dependency change (new chunks)
  useEffect(() => {
    if (!isAtBottomRef.current || !scrollEl) return;
    scrollEl.scrollTo({ top: scrollEl.scrollHeight, behavior: "smooth" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const scrollToBottom = useCallback(() => {
    isAtBottomRef.current = true;
    prevShowRef.current = false;
    setShowScrollButton(false);
    if (scrollEl) {
      scrollEl.scrollTo({ top: scrollEl.scrollHeight, behavior: "smooth" });
    }
  }, [scrollEl]);

  return { scrollContainerRef, bottomRef, showScrollButton, scrollToBottom };
}
