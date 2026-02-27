import type { Sample, FilterState } from "../../types/sample";
import { AnalysisBar } from "../AnalysisBar/AnalysisBar";
import { EmbeddingResultsModal } from "../EmbeddingResultsModal/EmbeddingResultsModal";
import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";

interface DetailPanelProps {
  sample: Sample;
  path?: string;
  // kept for backwards compatibility with App.tsx which previously passed
  // an onUpdateClassification handler. It's optional and unused here.
  onUpdateClassification?: (playbackType: string, instrumentType: string) => void;
  // Called when a user selects a sample from the embedding results modal.
  // If provided, DetailPanel will forward modal selections to this handler
  // so the parent (App) can update the global selection state.
  onSelect?: (sample: Sample, path?: string) => void;
  // If provided, called after embedding search completes with the raw result
  // rows returned by the backend. Parent can choose to replace the main list
  // with these rows (apply a 'similar items' view) or ignore.
  onError?: (message: string) => void;

  // New props: moved filter controls (sample type, BPM, tags) now render here.
  samples?: Sample[];
  filters?: FilterState;
  onFilterChange?: (filters: Partial<FilterState>) => void;
}

export function DetailPanel({ sample, path, samples = [], filters, onFilterChange, onSelect: propsOnSelect, onError: propsOnError }: DetailPanelProps) {
  // Embedding UI removed per user request.
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const tooltipId = "find-similar-tooltip";

  const allInstrumentTypes = [...new Set(samples.map((s) => s.instrument_type))].sort();

  type FilterTypeOption = FilterState["filterType"];
  const typeFilters: FilterTypeOption[] = ["all", "loop", "one-shot"];

  const getTypeCount = (type: FilterTypeOption) =>
    type === "all" ? samples.length : samples.filter((s) => s.sample_type === type).length;

  // Embedding search handler removed per user request.
  // Local types for embedding results modal
  interface EmbeddingResult {
    similarity: number;
    row: {
      id: number;
      path: string;
      file_name: string;
      duration: number | null;
      bpm: number | null;
      periodicity: number | null;
      low_ratio: number | null;
      attack_slope: number | null;
      decay_time: number | null;
      sample_type: string | null;
      waveform_peaks: string | null;
      playback_type: string;
      instrument_type: string;
    };
  }

  const [resultsOpen, setResultsOpen] = useState(false);
  const [embeddingResults, setEmbeddingResults] = useState<EmbeddingResult[]>([]);

  // Open results modal and run embedding search via Tauri command.
  // This calls the `search_by_embedding` IPC command with the current
  // sample path and a small k (top-k) default. Results are stored in
  // local state and forwarded to the results modal.
  const handleRunEmbeddingSearch = async () => {
    // Ensure we have a path to query
    if (!path) {
      propsOnSelect?.(sample, path);
      // Surface a user-facing error if provided
      // Prefer the parent's onError handler if available
      if (typeof propsOnError === "function") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (propsOnError as any)("Sample path missing for embedding search");
      } else {
        // Fallback: open modal with empty results
        setResultsOpen(true);
      }
      return;
    }

    try {
      const k = 12; // return top-12 similar items by default
      const rows = await invoke<EmbeddingResult[]>("search_by_embedding", { path, k });
      setEmbeddingResults(rows ?? []);
      setResultsOpen(true);
    } catch (e) {
      // Surface error to parent if provided, otherwise open modal empty
      const msg = e instanceof Error ? e.message : String(e);
      if (typeof propsOnError === "function") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (propsOnError as any)(msg);
      }
      setEmbeddingResults([]);
      setResultsOpen(true);
    }
  };
  const handleSelectResult = (s: Sample, p?: string) => {
    // If parent provided an onSelect handler, forward the selection so App
    // can update the global selected sample and focus the list. Otherwise
    // fallback to closing the modal only.
    if (typeof propsOnSelect === "function") {
      propsOnSelect(s, p);
    }
    setResultsOpen(false);
  };

  // Render the results modal; it will forward selection to the parent.
  const resultsModal = (
    <EmbeddingResultsModal isOpen={resultsOpen} results={embeddingResults} onClose={() => setResultsOpen(false)} onSelect={handleSelectResult} />
  );

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
          display: "flex",
          flexDirection: "column",
          gap: "20px",
          overflowY: "auto",
          overflow: "hidden",
          zIndex: 2,
        }}
      >
      {/* Scrollable content area: everything except the sticky PATH footer */}
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "flex-start", overflow: "visible" }}>
          <div style={{ position: "relative", display: "inline-flex", overflow: "visible", zIndex: 2, width: "100%" }}>
            <button
              type="button"
              onClick={handleRunEmbeddingSearch}
              onMouseEnter={() => setTooltipVisible(true)}
              onMouseLeave={() => setTooltipVisible(false)}
              onFocus={() => setTooltipVisible(true)}
              onBlur={() => setTooltipVisible(false)}
              aria-describedby={tooltipId}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: "100%",
                padding: "10px 14px",
                background: "#22d3ee",
                color: "#06202a",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontFamily: "'Courier New', monospace",
                fontSize: "14px",
                fontWeight: 600,
                boxShadow: "0 6px 18px rgba(34,211,238,0.08)",
              }}
            >
              Find similar samples
            </button>
          <div
            id={tooltipId}
            role="tooltip"
            aria-hidden={!tooltipVisible}
            style={{
              position: "absolute",
              top: "100%",
              left: "50%",
              transform: "translate(-50%, 8px)",
              padding: "8px 12px",
              borderRadius: "8px",
              background: "rgba(13, 20, 35, 0.95)",
              color: "#f8fafc",
              fontSize: "12px",
              lineHeight: 1.4,
              whiteSpace: "normal",
              maxWidth: "340px",
              boxShadow: "0 6px 18px rgba(0,0,0,0.55)",
              opacity: tooltipVisible ? 1 : 0,
              visibility: tooltipVisible ? "visible" : "hidden",
              pointerEvents: "none",
              transition: "opacity 150ms ease, visibility 150ms ease",
              zIndex: 2000,
            }}
          >
            Opens a floating list of{"\n"}
            cosine similarity scores for this sample (brute-force; ANN planned).
          </div>
        </div>
      </div>

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
            <div style={{ fontSize: "11px", color: "#374151", letterSpacing: "0.14em", marginBottom: "6px" }}>INST</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {allInstrumentTypes.map((inst) => (
                <button key={inst} onClick={() => onFilterChange && onFilterChange({ filterInstrumentType: filters?.filterInstrumentType === inst ? "" : inst })} style={{ padding: "4px 8px", border: "1px solid #1f2937", borderRadius: "4px", background: filters?.filterInstrumentType === inst ? "#f97316" : "transparent", color: filters?.filterInstrumentType === inst ? "#fff" : "#6b7280", cursor: onFilterChange ? "pointer" : "default" }}>{inst}</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Title removed intentionally: kept fields to preserve layout */}
      <div>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {/* sample_rate replaces low-ratio display in the UI */}
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
          <AnalysisBar
            label="PERIODICITY"
            value={sample.periodicity}
            max={1}
            color="#22d3ee"
          />
          <AnalysisBar
            label="ATTACK SLOPE"
            value={sample.attack_slope}
            max={5}
            color="#a78bfa"
          />
          {sample.decay_time && (
            <AnalysisBar
              label="DECAY (ms)"
              value={sample.decay_time}
              max={600}
              color="#fb923c"
            />
          )}
        </div>
      </div>

      


      
      

      
      <div>
        {/* Embedding UI removed per user request. */}
      </div>

      
      </div>

      {/* PATH footer (sticky inside panel) */}
      <div
        style={{
          borderTop: "1px solid #0f1117",
          paddingTop: "12px",
          /* Keep the PATH visible when waveform canvases or the fixed player
             bar overlap the panel. PlayerBar uses zIndex:100, so this
             sticky footer needs a higher stacking context to stay readable. */
          position: "sticky",
          bottom: 0,
          background: "#0a0c12",
          zIndex: 200,
          paddingBottom: "16px",
          boxShadow: "0 -6px 18px rgba(0,0,0,0.55)",
        }}
      >
        <div
          style={{
            fontSize: "13px",
            color: "#374151",
            letterSpacing: "0.08em",
            marginBottom: "4px",
          }}
        >
          PATH
        </div>
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
      </div>
      {resultsModal}
    </div>
  );
}
