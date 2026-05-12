import type React from "react";

interface MidiListHeaderProps {
  colWidths: string[];
  headerRefs: React.MutableRefObject<Array<HTMLDivElement | null>>;
  startColumnResize: (index: number, startX: number, startWidth: number) => void;
  hoveredCol: number | null;
  setHoveredCol: React.Dispatch<React.SetStateAction<number | null>>;
  activeResize: React.MutableRefObject<{ index: number; startX: number; startWidth: number; wasDragging: boolean } | null>;
  draggedColumnRef: React.MutableRefObject<number | null>;
  sortBy: string | null;
  sortDir: "asc" | "desc";
  headerClick: (key: string) => void;
  headerKeyDown: (e: React.KeyboardEvent, key: string) => void;
  onResizerKeyDown: (e: React.KeyboardEvent, index: number) => void;
}

export function MidiListHeader({
  colWidths,
  headerRefs,
  startColumnResize,
  hoveredCol,
  setHoveredCol,
  activeResize,
  draggedColumnRef,
  sortBy,
  sortDir,
  headerClick,
  headerKeyDown,
  onResizerKeyDown,
}: MidiListHeaderProps) {
  const columns = [
    { key: "favorite", label: "☆", align: "center" as const, color: "#4b5563", noSort: true },
    { key: "id", label: "#", align: "left" as const, color: "#374151" },
    { key: "file_name", label: "FILENAME", align: "left" as const, color: "#9ca3af", letterSpacing: "0.06em" },
    { key: "tag_name", label: "TAG", align: "left" as const, color: "#9ca3af" },
    { key: "tempo", label: "TEMPO", align: "right" as const, color: "#9ca3af" },
    { key: "time_sig", label: "TIME SIG", align: "center" as const, color: "#9ca3af" },
    { key: "track_count", label: "TRACKS", align: "right" as const, color: "#9ca3af" },
    { key: "note_count", label: "NOTES", align: "right" as const, color: "#9ca3af" },
    { key: "key_estimate", label: "KEY", align: "center" as const, color: "#9ca3af" },
    { key: "duration", label: "DURATION", align: "right" as const, color: "#9ca3af" },
    { key: "actions", label: "", align: "center" as const, color: "#9ca3af", noSort: true }
  ];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: colWidths.join(" "),
        padding: "6px 12px",
        borderLeft: "2px solid transparent",
        boxSizing: "border-box",
        borderBottom: "1px solid #0f1117",
        fontSize: "13px",
        letterSpacing: "0.14em",
        color: "#374151",
        alignItems: "center",
        background: "#0a0c12",
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}
    >
      {columns.map((col, idx) => (
        <div
          key={col.key}
          style={{ position: "relative", cursor: col.noSort ? (hoveredCol === idx ? "col-resize" : undefined) : "pointer" }}
          ref={(el) => (headerRefs.current[idx] = el)}
          onMouseDown={(e) => {
            const el = headerRefs.current[idx];
            if (!el) return;
            startColumnResize(idx, e.clientX, el.getBoundingClientRect().width);
          }}
          onMouseMove={(e) => {
            const el = headerRefs.current[idx];
            if (!el) return;
            const rect = el.getBoundingClientRect();
            const near = Math.abs(rect.right - e.clientX) <= 10;
            setHoveredCol((h) => (near ? idx : h === idx ? null : h));
          }}
          onMouseLeave={() => setHoveredCol((h) => (h === idx ? null : h))}
          onClick={() => {
            if (!col.noSort) headerClick(col.key);
          }}
          role={col.noSort ? undefined : "button"}
          tabIndex={col.noSort ? undefined : 0}
          onKeyDown={(e) => {
            if (!col.noSort) headerKeyDown(e, col.key);
          }}
        >
          <div style={{ fontSize: 13, color: col.color, textAlign: col.align, letterSpacing: col.letterSpacing, userSelect: "none" }}>
            {col.label}
            {!col.noSort && sortBy === col.key ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
          </div>
          <div style={{ position: "absolute", right: -6, top: 0, bottom: 0, display: "flex", alignItems: "center" }}>
            <div
              title="Resize column"
              role="separator"
              tabIndex={0}
              onKeyDown={(e) => onResizerKeyDown(e, idx)}
              style={{
                width: hoveredCol === idx ? 8 : 4,
                height: "70%",
                cursor: "col-resize",
                background: activeResize.current?.index === idx || draggedColumnRef.current === idx ? "#f97316" : hoveredCol === idx ? "#374151" : "transparent",
                borderRadius: 2,
                transition: "width 0.12s, background 0.12s"
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
