import React, { useState } from "react";
import { SortHeader } from "./SortHeader";
import type { SortState } from "../../types/sample";
import type { ActiveResizeState } from "./types";
import { SAMPLE_LIST_COLUMN_GAP } from "./sampleListLayout";

interface SampleListHeaderProps {
  colWidths: string[];
  tableMinWidth: number;
  sort: SortState;
  onSortChange: (sort: SortState) => void;
  startColumnResize: (index: number, startX: number, startWidth: number) => void;
  draggedColumnRef: React.MutableRefObject<number | null>;
  activeResize: React.MutableRefObject<ActiveResizeState>;
  headerRefs: React.MutableRefObject<Array<HTMLDivElement | null>>;
  showMusicalKey?: boolean;
  showSampleMetadataQuality?: boolean;
}

export function SampleListHeader({
  colWidths,
  tableMinWidth,
  sort,
  onSortChange,
  startColumnResize,
  draggedColumnRef,
  activeResize,
  headerRefs,
  showMusicalKey = true,
  showSampleMetadataQuality = true,
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
      data-testid="sample-list-header"
      style={{
        display: "grid",
        gridTemplateColumns: colWidths.join(" "),
        columnGap: SAMPLE_LIST_COLUMN_GAP,
        minWidth: tableMinWidth,
        padding: "6px 12px",
        borderLeft: "2px solid transparent",
        boxSizing: "border-box",
        borderBottom: "1px solid #0f1117",
        fontSize: "13px",
        letterSpacing: "0.14em",
        color: "#374151",
        background: "#020617",
        position: "sticky",
        top: 0,
        zIndex: 10,
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

      {showMusicalKey && (
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
      )}

      {showSampleMetadataQuality && (
        <>
          <div
            style={{ position: "relative" }}
            ref={(el) => (headerRefs.current[8] = el)}
            onMouseDown={(e) => handleMouseDown(8, e)}
            onMouseMove={(e) => handleMouseMove(8, e)}
            onMouseLeave={() => handleMouseLeave(8)}
          >
            <SortHeader field="license" currentSort={sort} onSort={onSortChange} columnIndex={8} draggedColumnRef={draggedColumnRef}>LIC</SortHeader>
            {renderResizer(8)}
          </div>

          <div
            style={{ position: "relative" }}
            ref={(el) => (headerRefs.current[9] = el)}
            onMouseDown={(e) => handleMouseDown(9, e)}
            onMouseMove={(e) => handleMouseMove(9, e)}
            onMouseLeave={() => handleMouseLeave(9)}
          >
            <SortHeader field="quality_flags" currentSort={sort} onSort={onSortChange} columnIndex={9} draggedColumnRef={draggedColumnRef}>QC</SortHeader>
            {renderResizer(9)}
          </div>
        </>
      )}

      <div style={{ position: "relative" }} ref={(el) => (headerRefs.current[10] = el)}>
        <div />
      </div>
    </div>
  );
}
