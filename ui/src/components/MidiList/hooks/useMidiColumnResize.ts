import { useState, useEffect, useRef } from "react";
import type React from "react";

const defaultColWidths = ["44px", "44px", "420px", "140px", "110px", "190px", "72px", "130px", "120px", "100px", "82px", "82px", "82px", "110px", "96px"];
const STORAGE_KEY = "midiListColWidths_v3";

const minWidths = [20, 28, 200, 90, 80, 120, 56, 90, 90, 70, 60, 60, 60, 80, 56];
const maxWidths = [100, 400, 1600, 800, 800, 800, 300, 800, 800, 400, 400, 400, 400, 800, 400];

export function useMidiColumnResize() {
  const [colWidths, setColWidths] = useState<string[]>(defaultColWidths);
  const headerRefs = useRef<Array<HTMLDivElement | null>>([]);
  const draggedColumnRef = useRef<number | null>(null);
  const activeResize = useRef<{ index: number; startX: number; startWidth: number; wasDragging: boolean } | null>(null);
  const [hoveredCol, setHoveredCol] = useState<number | null>(null);
  const resizeHandlersRef = useRef<{ onMove: (e: MouseEvent) => void; onUp: () => void } | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as string[];
        if (Array.isArray(parsed) && parsed.length === defaultColWidths.length) {
          setColWidths(parsed);
        }
      }
    } catch (err) {
      // ignore and fall back to defaults
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(colWidths));
    } catch (err) {
      // ignore storage failures
    }
  }, [colWidths]);

  const startColumnResize = (index: number, startX: number, startWidth: number) => {
    activeResize.current = { index, startX, startWidth, wasDragging: false };

    if (resizeHandlersRef.current) {
      document.removeEventListener("mousemove", resizeHandlersRef.current.onMove);
      document.removeEventListener("mouseup", resizeHandlersRef.current.onUp);
    }

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
  };

  const adjustColumnWidth = (index: number, deltaPx: number) => {
    const el = headerRefs.current[index];
    const currentPx = (() => {
      const val = colWidths[index];
      if (typeof val === "string" && val.endsWith("px")) return parseInt(val, 10) || 0;
      if (el) return Math.round(el.getBoundingClientRect().width);
      return 120;
    })();
    const min = minWidths[index] ?? 20;
    const max = maxWidths[index] ?? 2000;
    const next = Math.max(min, Math.min(max, Math.round(currentPx + deltaPx)));
    setColWidths((prev) => {
      const copy = [...prev];
      copy[index] = `${next}px`;
      return copy;
    });
  };

  const onResizerKeyDown = (e: React.KeyboardEvent, index: number) => {
    e.stopPropagation();
    const key = e.key;
    if (key === "ArrowLeft") {
      adjustColumnWidth(index, -8);
      e.preventDefault();
    } else if (key === "ArrowRight") {
      adjustColumnWidth(index, 8);
      e.preventDefault();
    } else if (key === "PageDown") {
      adjustColumnWidth(index, -32);
      e.preventDefault();
    } else if (key === "PageUp") {
      adjustColumnWidth(index, 32);
      e.preventDefault();
    } else if (key === "Home") {
      setColWidths((prev) => {
        const copy = [...prev];
        copy[index] = `${maxWidths[index] ?? 800}px`;
        return copy;
      });
      e.preventDefault();
    } else if (key === "End") {
      setColWidths((prev) => {
        const copy = [...prev];
        copy[index] = `${minWidths[index] ?? 20}px`;
        return copy;
      });
      e.preventDefault();
    }
  };

  return {
    colWidths,
    headerRefs,
    draggedColumnRef,
    activeResize,
    hoveredCol,
    setHoveredCol,
    startColumnResize,
    onResizerKeyDown,
  };
}
