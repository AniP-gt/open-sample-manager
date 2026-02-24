import { convertFileSrc } from "@tauri-apps/api/core";

import type { FilterState, Sample } from "../../types/sample";
import { TypeBadge } from "../TypeBadge/TypeBadge";

interface SampleListProps {
  samples: Sample[];
  samplePaths: Record<number, string>;
  filters: FilterState;
  selectedSample: Sample | null;
  onSampleSelect: (sample: Sample) => void;
  onFilterChange: (filters: Partial<FilterState>) => void;
  onDeleteSample: (id: number) => void;
}

export function SampleList({
  samples,
  samplePaths,
  filters,
  selectedSample,
  onSampleSelect,
  onFilterChange,
  onDeleteSample,
}: SampleListProps) {
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
          {filtered.length}/{samples.length} RESULTS
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "28px 1fr 80px 60px 60px 80px 40px",
          padding: "6px 16px",
          borderBottom: "1px solid #0f1117",
          fontSize: "13px",
          letterSpacing: "0.14em",
          color: "#374151",
        }}
      >
        <div />
        <div>FILENAME</div>
        <div>TYPE</div>
        <div>BPM</div>
        <div>DUR</div>
        <div>LOW RATIO</div>
        <div />
      </div>

      <div style={{ flex: 1, overflowY: "auto" }}>
        {filtered.map((s, idx) => (
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
              gridTemplateColumns: "28px 1fr 80px 60px 60px 80px 40px",
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
            <div>
              <TypeBadge type={s.sample_type} />
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
            <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
              <div
                style={{
                  flex: 1,
                  height: "3px",
                  background: "#1f2937",
                  borderRadius: "1px",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${s.low_ratio * 100}%`,
                    background: s.low_ratio > 0.6 ? "#f97316" : "#4b5563",
                    borderRadius: "1px",
                  }}
                />
              </div>
              <span style={{ fontSize: "14px", color: "#4b5563", width: "32px" }}>
                {(s.low_ratio * 100).toFixed(0)}%
              </span>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDeleteSample(s.id);
              }}
              style={{
                background: "transparent",
                border: "none",
                color: "#6b7280",
                cursor: "pointer",
                padding: "4px",
                fontSize: "12px",
              }}
              title="Remove from library"
            >
              X
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
