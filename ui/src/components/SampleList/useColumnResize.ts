import { useState, useRef, useCallback } from "react";
import type { ActiveResizeState } from "./types";

export function useColumnResize(initialWidths: string[]) {
  const [colWidths, setColWidths] = useState<string[]>(initialWidths);
  const draggedColumnRef = useRef<number | null>(null);
  const activeResize = useRef<ActiveResizeState>(null);
  const resizeHandlersRef = useRef<{ onMove: (e: MouseEvent) => void; onUp: () => void } | null>(null);

  const startColumnResize = useCallback((index: number, startX: number, startWidth: number) => {
    activeResize.current = { index, startX, startWidth, wasDragging: false };

    if (resizeHandlersRef.current) {
      document.removeEventListener("mousemove", resizeHandlersRef.current.onMove);
      document.removeEventListener("mouseup", resizeHandlersRef.current.onUp);
    }

    const minWidths = [36, 20, 200, 100, 72, 40, 40, 40, 30];
    const maxWidths = [80, 400, 1600, 800, 800, 400, 400, 400, 200];

    const onMove = (e: MouseEvent) => {
      const active = activeResize.current;
      if (!active) return;
      const dx = e.clientX - active.startX;
      let next = Math.max(10, Math.round(active.startWidth + dx));
      const min = minWidths[active.index] ?? 20;
      const max = maxWidths[active.index] ?? 2000;
      next = Math.max(min, Math.min(max, next));
      setColWidths((prev) => {
        const copy = [...prev];
        copy[active.index] = `${next}px`;
        return copy;
      });
      if (!active.wasDragging && Math.abs(dx) > 3) {
        active.wasDragging = true;
      }
      document.body.style.cursor = "col-resize";
    };

    const onUp = () => {
      const active = activeResize.current;
      if (active) {
        if (active.wasDragging) {
          draggedColumnRef.current = active.index;
        } else {
          draggedColumnRef.current = null;
        }
      }
      activeResize.current = null;
      document.body.style.cursor = "";
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      resizeHandlersRef.current = null;
    };

    resizeHandlersRef.current = { onMove, onUp };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, []);

  return { colWidths, setColWidths, startColumnResize, draggedColumnRef, activeResize };
}
