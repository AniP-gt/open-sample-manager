import { useEffect, useRef } from "react";
import { isTextInputElement } from "../../utils/keyboard";
import type { Sample } from "../../types/sample";

export function useKeyboardNavigation({
  sorted,
  selectedSample,
  onSampleSelect,
  onTogglePlayback,
  listRef,
}: {
  sorted: Sample[];
  selectedSample: Sample | null;
  onSampleSelect: (sample: Sample) => void;
  onTogglePlayback?: () => void;
  listRef: React.MutableRefObject<HTMLDivElement | null>;
}) {
  const arrowDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSelectRef = useRef<Sample | null>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key;
      if (key !== "ArrowDown" && key !== "ArrowUp" && key !== " ") return;
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const listRoot = listRef.current;
      if (!listRoot) return;
      const target = event.target as Element | null;
      if (isTextInputElement(target)) return;
      if (target && target !== document.body && target !== document.documentElement && !listRoot.contains(target)) {
        return;
      }
      if (key === " ") {
        if (!selectedSample || !onTogglePlayback) return;
        event.preventDefault();
        event.stopPropagation();
        onTogglePlayback();
        return;
      }
      if (sorted.length === 0) return;

      event.preventDefault();
      event.stopPropagation();

      const currentIndex = selectedSample ? sorted.findIndex((s) => s.id === selectedSample.id) : -1;
      let nextIndex = currentIndex;
      if (event.key === "ArrowDown") {
        if (currentIndex < sorted.length - 1) {
          nextIndex = currentIndex + 1;
        } else if (currentIndex === -1) {
          nextIndex = 0;
        }
      } else {
        if (currentIndex > 0) {
          nextIndex = currentIndex - 1;
        } else if (currentIndex === -1) {
          nextIndex = sorted.length - 1;
        }
      }

      if (nextIndex < 0 || nextIndex >= sorted.length) return;
      const nextSample = sorted[nextIndex];
      if (!nextSample) return;
      if (!selectedSample || nextSample.id !== selectedSample.id) {
        pendingSelectRef.current = nextSample;
        if (arrowDebounceRef.current) clearTimeout(arrowDebounceRef.current);
        arrowDebounceRef.current = setTimeout(() => {
          const pending = pendingSelectRef.current;
          if (pending) {
            onSampleSelect(pending);
            pendingSelectRef.current = null;
          }
        }, 80);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (arrowDebounceRef.current) clearTimeout(arrowDebounceRef.current);
    };
  }, [sorted, selectedSample, onSampleSelect, onTogglePlayback, listRef]);
}
