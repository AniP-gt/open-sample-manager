import { useRef, useEffect, useState } from "react";

interface ResizeHandleProps {
  onWidthChange: (width: number) => void;
  minWidth?: number;
  maxWidth?: number;
}

export function ResizeHandle({ onWidthChange, minWidth = 100, maxWidth = 400 }: ResizeHandleProps) {
  const [isDragging, setIsDragging] = useState(false);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const next = Math.max(minWidth, Math.min(maxWidth, e.clientX));
      if (rafRef.current == null) {
        rafRef.current = window.requestAnimationFrame(() => {
          onWidthChange(next);
          rafRef.current = null;
        });
      }
    };

    const onUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    }

    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      if (rafRef.current != null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isDragging, minWidth, maxWidth, onWidthChange]);

  return (
    <div
      onMouseDown={() => setIsDragging(true)}
      role="separator"
      aria-orientation="vertical"
      style={{
        width: "4px",
        background: isDragging ? "#f97316" : "#1f2937",
        cursor: "col-resize",
        transition: "background 0.12s",
        flexShrink: 0,
      }}
      onMouseEnter={(e) => {
        if (!isDragging) (e.currentTarget as HTMLDivElement).style.background = "#374151";
      }}
      onMouseLeave={(e) => {
        if (!isDragging) (e.currentTarget as HTMLDivElement).style.background = "#1f2937";
      }}
    />
  );
}

export default ResizeHandle;
