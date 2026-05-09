import React, { useState } from "react";
import { SortHeader } from "./SortHeader";
import type { SortState } from "../../types/sample";
import type { ActiveResizeState } from "./types";

interface SampleListHeaderProps {
  colWidths: string[];
  sort: SortState;
  onSortChange: (sort: SortState) => void;
  startColumnResize: (index: number, startX: number, startWidth: number) => void;
  draggedColumnRef: React.MutableRefObject<number | null>;
  activeResize: React.MutableRefObject<ActiveResizeState>;
  headerRefs: React.MutableRefObject<Array<HTMLDivElement | null>>;
}

export function SampleListHeader({
  colWidths,
  sort,
  onSortChange,
  startColumnResize,
  draggedColumnRef,
  activeResize,
  headerRefs,
}: SampleListHeaderProps) {
  const [hoveredCol, setHoveredCol] = useState<number | null>(null);

  const handleMouseDown = (index: number, e: React.MouseEvent) => {
    const el = headerRefs.current[index];
    if (!el) return;
    startColumnResize(index, e.clientX, el.getBoundingClientRect().width);
  };

  const handleMouseMove = (index: number, e: React.MouseEvent) => {
    const el = headerRefs.current[index];
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const near = Math.abs(rect.right - e.clientX) <= 10;
    setHoveredCol((h) => (near ? index : h === index ? null : h));
  };

  const handleMouseLeave = (index: number) => {
    setHoveredCol((h) => (h === index ? null : h));
  };

  const renderResizer = (index: number) => (
    <div style={{ position: "absolute", right: -6, top: 0, bottom: 0, display: "flex", alignItems: "center" }}>
      <div
        style={{
          width: hoveredCol === index ? 8 : 4,
          height: "70%",
          cursor: "col-resize",
          background: activeResize.current?.index === index || draggedColumnRef.current === index ? "#f97316" : hoveredCol === index ? "#374151" : "transparent",
          borderRadius: 2,
          transition: "width 0.12s, background 0.12s",
        }}
      />
    </div>
  );

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: colWidths.join(" "),
        padding: "6px 16px",
        borderBottom: "1px solid #0f1117",
        fontSize: "13px",
        letterSpacing: "0.14em",
        color: "#374151",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", color: "#4b5563", fontSize: "16px" }}>☆</div>
      
      <div style={{ position: "relative" }} ref={(el) => (headerRefs.current[1] = el)} onMouseDown={(e) => handleMouseDown(1, e)}>
        <SortHeader field="id" currentSort={sort} onSort={onSortChange} columnIndex={1} draggedColumnRef={draggedColumnRef}>#</SortHeader>
      </div>

      <div
        style={{ position: "relative" }}
        ref={(el) => (headerRefs.current[2] = el)}
        onMouseDown={(e) => handleMouseDown(2, e)}
        onMouseMove={(e) => handleMouseMove(2, e)}
        onMouseLeave={() => handleMouseLeave(2)}
      >
        <SortHeader field="file_name" currentSort={sort} onSort={onSortChange} columnIndex={2} draggedColumnRef={draggedColumnRef}>FILENAME</SortHeader>
        {renderResizer(2)}
      </div>

      <div
        style={{ position: "relative" }}
        ref={(el) => (headerRefs.current[3] = el)}
        onMouseDown={(e) => handleMouseDown(3, e)}
        onMouseMove={(e) => handleMouseMove(3, e)}
        onMouseLeave={() => handleMouseLeave(3)}
      >
        <SortHeader field="sample_type" currentSort={sort} onSort={onSortChange} columnIndex={3} draggedColumnRef={draggedColumnRef}>TYPE</SortHeader>
        {renderResizer(3)}
      </div>

      <div
        style={{ position: "relative" }}
        ref={(el) => (headerRefs.current[4] = el)}
        onMouseDown={(e) => handleMouseDown(4, e)}
        onMouseMove={(e) => handleMouseMove(4, e)}
        onMouseLeave={() => handleMouseLeave(4)}
      >
        <SortHeader field="instrument_type" currentSort={sort} onSort={onSortChange} columnIndex={4} draggedColumnRef={draggedColumnRef}>INST</SortHeader>
        {renderResizer(4)}
      </div>

      <div
        style={{ position: "relative" }}
        ref={(el) => (headerRefs.current[5] = el)}
        onMouseDown={(e) => handleMouseDown(5, e)}
        onMouseMove={(e) => handleMouseMove(5, e)}
        onMouseLeave={() => handleMouseLeave(5)}
      >
        <SortHeader field="bpm" currentSort={sort} onSort={onSortChange} columnIndex={5} draggedColumnRef={draggedColumnRef}>BPM</SortHeader>
        {renderResizer(5)}
      </div>

      <div
        style={{ position: "relative" }}
        ref={(el) => (headerRefs.current[6] = el)}
        onMouseDown={(e) => handleMouseDown(6, e)}
        onMouseMove={(e) => handleMouseMove(6, e)}
        onMouseLeave={() => handleMouseLeave(6)}
      >
        <SortHeader field="duration" currentSort={sort} onSort={onSortChange} columnIndex={6} draggedColumnRef={draggedColumnRef}>DUR</SortHeader>
        {renderResizer(6)}
      </div>

      <div
        style={{ position: "relative" }}
        ref={(el) => (headerRefs.current[7] = el)}
        onMouseDown={(e) => handleMouseDown(7, e)}
        onMouseMove={(e) => handleMouseMove(7, e)}
        onMouseLeave={() => handleMouseLeave(7)}
      >
        <SortHeader field="musical_key" currentSort={sort} onSort={onSortChange} columnIndex={7} draggedColumnRef={draggedColumnRef}>KEY</SortHeader>
        {renderResizer(7)}
      </div>

      <div
        style={{ position: "relative" }}
        ref={(el) => (headerRefs.current[8] = el)}
        onMouseDown={(e) => handleMouseDown(8, e)}
        onMouseMove={(e) => handleMouseMove(8, e)}
        onMouseLeave={() => handleMouseLeave(8)}
      >
        <div />
        {renderResizer(8)}
      </div>
    </div>
  );
}
