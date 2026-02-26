import type { Sample, FilterState } from "../../types/sample";
import { AnalysisBar } from "../AnalysisBar/AnalysisBar";
import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

interface DetailPanelProps {
  sample: Sample;
  path?: string;
  onUpdateClassification?: (playbackType: string, instrumentType: string) => void;
  onSelect?: (sample: Sample, path?: string) => void;
  onError?: (message: string) => void;
  samples?: Sample[];
  filters?: FilterState;
  onFilterChange?: (filters: Partial<FilterState>) => void;
}

export function DetailPanel({ sample, path, samples = [], filters, onFilterChange }: DetailPanelProps) {
  // tooltip state kept for potential future interactions; intentionally unused
  // intentionally omit tooltip state entirely since embedding UI is removed
  const [copyToastVisible, setCopyToastVisible] = useState(false);

  const allTags = [...new Set(samples.flatMap((s) => s.tags))].slice(0, 14);

  type FilterTypeOption = FilterState["filterType"];
  const typeFilters: FilterTypeOption[] = ["all", "loop", "one-shot"];

  const getTypeCount = (type: FilterTypeOption) =>
    type === "all" ? samples.length : samples.filter((s) => s.sample_type === type).length;

  // (embedding UI removed)

  // onSelect is available via propsOnSelect; no local wrapper needed now

  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        height: "100%",
        minHeight: 0,
        width: "260px",
        borderLeft: "1px solid #0f1117",
        background: "#0a0c12",
        padding: "20px 16px",
        // Add bottom padding to leave room for PlayerBar when visible
        paddingBottom: "180px",
        display: "flex",
        flexDirection: "column",
        gap: "20px",
        flexShrink: 0,
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
        zIndex: 2,
      }}
    >
      {/* Scrollable content area: everything except the sticky PATH footer */}
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", paddingBottom: "92px" }}>
            <div style={{ display: "flex", justifyContent: "flex-start", overflow: "visible" }} />

        {/* Moved filter controls from left sidebar into the right detail panel */}
        <div>
          <div style={{ fontSize: "12px", color: "#374151", letterSpacing: "0.12em", marginBottom: "8px" }}>FILTERS</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "8px" }}>
            <div>
              <div style={{ fontSize: "11px", color: "#374151", letterSpacing: "0.14em", marginBottom: "6px" }}>SAMPLE TYPE</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {typeFilters.map((t) => (
                  <button
                    key={t}
                    onClick={() => onFilterChange?.({ filterType: t })}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      width: "100%",
                      background: filters?.filterType === t ? "#111827" : "transparent",
                      border: "1px solid #1f2937",
                      padding: "6px 10px",
                      fontSize: "13px",
                      color: "#e2e8f0",
                      cursor: onFilterChange ? "pointer" : "default",
                      borderRadius: "4px",
                      fontFamily: "'Courier New', monospace",
                    }}
                  >
                    <span>{t.toUpperCase()}</span>
                    <span style={{ fontSize: "12px", color: "#374151" }}>{getTypeCount(t)}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div style={{ fontSize: "11px", color: "#374151", letterSpacing: "0.14em", marginBottom: "6px" }}>BPM RANGE</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                <input
                  type="number"
                  placeholder="MIN"
                  value={filters?.filterBpmMin ?? ""}
                  onChange={(e) => onFilterChange && onFilterChange({ filterBpmMin: e.target.value })}
                  style={{
                    minWidth: "120px",
                    flex: "1 1 120px",
                    padding: "6px",
                    borderRadius: "4px",
                    border: "1px solid #1f2937",
                    background: "transparent",
                    color: "#9ca3af",
                    boxSizing: "border-box",
                  }}
                />
                <input
                  type="number"
                  placeholder="MAX"
                  value={filters?.filterBpmMax ?? ""}
                  onChange={(e) => onFilterChange && onFilterChange({ filterBpmMax: e.target.value })}
                  style={{
                    minWidth: "120px",
                    flex: "1 1 120px",
                    padding: "6px",
                    borderRadius: "4px",
                    border: "1px solid #1f2937",
                    background: "transparent",
                    color: "#9ca3af",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            </div>

            <div>
              <div style={{ fontSize: "11px", color: "#374151", letterSpacing: "0.14em", marginBottom: "6px" }}>TAGS</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                {allTags.map((tag) => (
                  <button key={tag} onClick={() => onFilterChange && onFilterChange({ search: tag })} style={{ padding: "4px 8px", border: "1px solid #1f2937", borderRadius: "4px", background: "transparent", color: "#6b7280", cursor: onFilterChange ? "pointer" : "default" }}>{tag}</button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* sample stats and analysis bars */}
        <div>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: "12px", color: "#374151", letterSpacing: "0.06em" }}>SAMPLE RATE</div>
              <div style={{ fontSize: "13px", color: "#4b5563" }}>{sample.sample_rate ? `${sample.sample_rate} Hz` : '—'}</div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: "12px", color: "#374151", letterSpacing: "0.06em" }}>FILE SIZE</div>
              <div style={{ fontSize: "13px", color: "#4b5563" }}>{typeof sample.file_size === 'number' ? `${(sample.file_size/1024).toFixed(1)} KB` : '—'}</div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: "12px", color: "#374151", letterSpacing: "0.06em" }}>ARTIST</div>
              <div style={{ fontSize: "13px", color: "#4b5563" }}>{sample.artist ?? '—'}</div>
            </div>
            <AnalysisBar label="PERIODICITY" value={sample.periodicity} max={1} color="#22d3ee" />
            <AnalysisBar label="ATTACK SLOPE" value={sample.attack_slope} max={5} color="#a78bfa" />
            {sample.decay_time && (
              <AnalysisBar label="DECAY (ms)" value={sample.decay_time} max={600} color="#fb923c" />
            )}
          </div>
        </div>

        {/* embedding UI removed */}
      </div>

      {/* PATH footer (sticky inside the panel) */}
      <div
        style={{
          borderTop: "1px solid #0f1117",
          paddingTop: "12px",
          background: "#0a0c12",
          zIndex: 1100,
          paddingBottom: "12px",
          boxShadow: "0 -6px 18px rgba(0,0,0,0.55)",
          position: "sticky",
          bottom: 0,
        }}
      >
        <div style={{ fontSize: "13px", color: "#374151", letterSpacing: "0.08em", marginBottom: "4px" }}>PATH</div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <div
            title={path || "—"}
            style={{
              fontSize: "13px",
              color: "#4b5563",
              lineHeight: 1.6,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              maxWidth: "100%",
            }}
          >
            {path || "—"}
          </div>
          <button
            onClick={async (e) => {
              e.stopPropagation();
              if (!path) return;
              try {
                await invoke("copy_to_clipboard", { text: path });
                setCopyToastVisible(true);
                setTimeout(() => setCopyToastVisible(false), 1400);
              } catch (err) {
                // eslint-disable-next-line no-console
                console.error("copy failed", err);
              }
            }}
            title="Copy full path"
            style={{
              background: "transparent",
              border: "none",
              color: "#6b7280",
              cursor: "pointer",
              padding: 6,
              borderRadius: 6,
            }}
          >
            📋
          </button>
          {copyToastVisible && (
            <div style={{ marginLeft: 8, fontSize: 12, color: "#22c55e" }}>Copied</div>
          )}
        </div>
      </div>
    </div>
  );
}
