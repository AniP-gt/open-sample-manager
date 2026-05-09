import React from "react";
import type { SortField, SortState } from "../../types/sample";

export function SortHeader({
  field,
  currentSort,
  onSort,
  children,
  columnIndex,
  draggedColumnRef,
}: {
  field: SortField;
  currentSort: SortState;
  onSort: (sort: SortState) => void;
  children: React.ReactNode;
  columnIndex?: number;
  draggedColumnRef?: React.MutableRefObject<number | null>;
}) {
  const isActive = currentSort.field === field;
  const direction = isActive ? currentSort.direction : "asc";

  return (
    <div
      onClick={() => {
        if (typeof columnIndex === "number" && draggedColumnRef?.current === columnIndex) {
          draggedColumnRef.current = null;
          return;
        }
        onSort({
          field,
          direction: isActive && direction === "asc" ? "desc" : "asc",
        });
      }}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "4px",
        cursor: "pointer",
        userSelect: "none",
      }}
    >
      {children}
      {isActive && (
        <span style={{ color: "#f97316", fontSize: "10px" }}>
          {direction === "asc" ? "▲" : "▼"}
        </span>
      )}
    </div>
  );
}
