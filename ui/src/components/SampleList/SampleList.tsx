import { convertFileSrc } from "@tauri-apps/api/core";
import React, { useEffect, useRef, useImperativeHandle, forwardRef } from "react";

import type { FilterState, Sample, SortState, SortField } from "../../types/sample";
import { TypeBadge } from "../TypeBadge/TypeBadge";

interface SampleListProps {
  samples: Sample[];
  samplePaths: Record<number, string>;
  filters: FilterState;
  sort: SortState;
  selectedSample: Sample | null;
  onSampleSelect: (sample: Sample) => void;
  onFilterChange: (filters: Partial<FilterState>) => void;
  onSortChange: (sort: SortState) => void;
  onDeleteSample: (id: number) => void;
  onTrashSample?: (id: number) => void;
  onTypeClick?: (sample: Sample) => void;
}

function SortHeader({
  field,
  currentSort,
  onSort,
  children,
}: {
  field: SortField;
  currentSort: SortState;
  onSort: (sort: SortState) => void;
  children: React.ReactNode;
}) {
  const isActive = currentSort.field === field;
  const direction = isActive ? currentSort.direction : "asc";

  return (
    <div
      onClick={() =>
        onSort({
          field,
          direction: isActive && direction === "asc" ? "desc" : "asc",
        })
      }
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

export type SampleListHandle = {
  focusSelected: () => void;
};

export const SampleList = forwardRef<SampleListHandle, SampleListProps>(function SampleList(props, ref) {
  const {
    samples,
    samplePaths,
    filters,
    sort,
    selectedSample,
    onSampleSelect,
    onFilterChange,
    onSortChange,
    onTrashSample,
    onTypeClick,
  } = props;
  const listRef = useRef<HTMLDivElement | null>(null);

  const filtered = samples.filter((s) => {
    const matchSearch =
      s.file_name.toLowerCase().includes(filters.search.toLowerCase()) ||
      s.tags.some((t) => t.toLowerCase().includes(filters.search.toLowerCase()));
    const matchType =
      filters.filterType === "all" || s.sample_type === filters.filterType;
    const matchBpmMin =
      filters.filterBpmMin === "" ||
      (s.bpm && s.bpm >= parseFloat(filters.filterBpmMin));
    const matchBpmMax =
      filters.filterBpmMax === "" ||
      (s.bpm && s.bpm <= parseFloat(filters.filterBpmMax));
    return matchSearch && matchType && matchBpmMin && matchBpmMax;
  });

      const sorted = [...filtered].sort((a, b) => {
        const dir = sort.direction === "asc" ? 1 : -1;
        switch (sort.field) {
      case "id":
        return (a.id - b.id) * dir;
      case "file_name":
        return a.file_name.localeCompare(b.file_name) * dir;
      case "sample_type":
        return a.sample_type.localeCompare(b.sample_type) * dir;
      case "bpm":
        return ((a.bpm ?? 0) - (b.bpm ?? 0)) * dir;
      case "duration":
        return (a.duration - b.duration) * dir;
      case "sample_rate":
        return ((a.sample_rate ?? 0) - (b.sample_rate ?? 0)) * dir;
      default:
        return 0;
    }
  });

  useEffect(() => {
    if (!listRef.current) return;
    // If a selectedSample exists, ensure it's scrolled into view.
    const el = listRef.current.querySelector<HTMLDivElement>(`.sample-row.active`);
    if (el) el.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [selectedSample]);

  useImperativeHandle(ref, () => ({
    focusSelected: () => {
      if (!listRef.current) return;
      const el = listRef.current.querySelector<HTMLDivElement>(`.sample-row.active`);
      if (!el) return;
      // Make the element focusable, focus it, then remove the tabindex attribute.
      const prevTab = el.getAttribute("tabindex");
      el.setAttribute("tabindex", "-1");
      // Ensure DOM painted
      requestAnimationFrame(() => {
        try {
          (el as HTMLElement).focus();
        } finally {
          if (prevTab !== null) {
            el.setAttribute("tabindex", prevTab);
          } else {
            el.removeAttribute("tabindex");
          }
        }
      });
    },
  }));

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          padding: "10px 16px",
          borderBottom: "1px solid #0f1117",
          background: "#0a0c12",
          display: "flex",
          alignItems: "center",
          gap: "10px",
        }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#374151"
          strokeWidth="2"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <input
          value={filters.search}
          onChange={(e) => onFilterChange({ search: e.target.value })}
          placeholder="Search by filename, tag, key... (FTS5)"
          style={{
            flex: 1,
            fontSize: "16px",
            color: "#9ca3af",
            letterSpacing: "0.04em",
          }}
        />
        <span
          style={{
            fontSize: "14px",
            color: "#374151",
            letterSpacing: "0.1em",
          }}
        >
          {sorted.length}/{samples.length} RESULTS
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "28px 1fr 100px 60px 60px 80px 40px",
          padding: "6px 16px",
          borderBottom: "1px solid #0f1117",
          fontSize: "13px",
          letterSpacing: "0.14em",
          color: "#374151",
        }}
      >
        <SortHeader field="id" currentSort={sort} onSort={onSortChange}>#</SortHeader>
        <SortHeader field="file_name" currentSort={sort} onSort={onSortChange}>FILENAME</SortHeader>
        <SortHeader field="sample_type" currentSort={sort} onSort={onSortChange}>TYPE / INST</SortHeader>
        <SortHeader field="bpm" currentSort={sort} onSort={onSortChange}>BPM</SortHeader>
        <SortHeader field="duration" currentSort={sort} onSort={onSortChange}>DUR</SortHeader>
          <SortHeader field="sample_rate" currentSort={sort} onSort={onSortChange}>SAMPLE RATE</SortHeader>
        <div />
      </div>

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          // Add bottom padding when a player/waveform is visible so the
          // last list item can be scrolled fully into view instead of
          // being clipped by the fixed-position PlayerBar at the bottom.
          // PlayerBar uses a fixed height of 160px; match that here.
          paddingBottom: selectedSample ? "160px" : undefined,
          boxSizing: "border-box",
        }}
        ref={listRef}
      >
        {/* Scroll container reference used to focus selected sample when modal selection occurs */}
        {sorted.map((s, idx) => (
          <div
            key={s.id}
            className={`sample-row ${selectedSample?.id === s.id ? "active" : ""}`}
            draggable={!!samplePaths[s.id]}
            onDragStart={(e) => {
              const path = samplePaths[s.id];
              if (path) {
                // Convert local path to file:// URL for DAW compatibility
                const fileUrl = convertFileSrc(path);
                e.dataTransfer.setData("text/uri-list", fileUrl);
                e.dataTransfer.setData("text/plain", path);
                e.dataTransfer.effectAllowed = "copy";
              }
            }}
            onClick={() => onSampleSelect(s)}
            style={{
              display: "grid",
              gridTemplateColumns: "28px 1fr 100px 60px 60px 80px 40px",
              padding: "8px 16px",
              borderBottom: "1px solid #0d0f16",
              borderLeft:
                selectedSample?.id === s.id
                  ? "2px solid #f97316"
                  : "2px solid transparent",
              background: selectedSample?.id === s.id ? "#111827" : "transparent",
              alignItems: "center",
              animation: `fadeIn 0.2s ease ${idx * 0.03}s both`,
              transition: "background 0.1s",
              cursor: samplePaths[s.id] ? "grab" : "default",
            }}
          >
            <div style={{ fontSize: "14px", color: "#374151" }}>{s.id}</div>
            <div>
              <div
                style={{
                  fontSize: "16px",
                  color: "#d1d5db",
                  letterSpacing: "0.02em",
                  marginBottom: "3px",
                }}
              >
                {s.file_name}
              </div>
              <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                {s.tags.map((t) => (
                  <span
                    key={t}
                    style={{
                      fontSize: "13px",
                      padding: "1px 4px",
                      background: "#0f1117",
                      color: "#4b5563",
                      border: "1px solid #1a1f2e",
                      borderRadius: "1px",
                    }}
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <TypeBadge type={s.sample_type} onClick={() => onTypeClick?.(s)} />
              <span
                onClick={() => onTypeClick?.(s)}
                style={{
                  fontSize: "10px",
                  fontFamily: "'Courier New', monospace",
                  fontWeight: 600,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "#f97316",
                  cursor: "pointer",
                }}
              >
                {s.instrument_type}
              </span>
            </div>
            <div
              style={{
                fontSize: "16px",
                color: s.bpm ? "#22d3ee" : "#374151",
                fontWeight: s.bpm ? 700 : 400,
              }}
            >
              {s.bpm ? `${Math.floor(s.bpm)}` : "-"}
            </div>
            <div style={{ fontSize: "16px", color: "#6b7280" }}>
              {s.duration.toFixed(2)}s
            </div>
            <div style={{ fontSize: "14px", color: "#4b5563" }}>
              {s.sample_rate ? `${s.sample_rate} Hz` : '—'}
            </div>
            <div style={{ display: "flex", gap: "6px", justifyContent: "center" }}>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onTrashSample?.(s.id);
                }}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#ef4444",
                  cursor: "pointer",
                  padding: "4px",
                  fontSize: "14px",
                }}
                title="Send to Trash"
              >
                🗑
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});
