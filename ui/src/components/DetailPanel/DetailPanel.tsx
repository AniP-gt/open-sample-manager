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
  const [resultsOpen, setResultsOpen] = useState(false);
  const [results, setResults] = useState<any[]>([]);

  const allTags = [...new Set(samples.flatMap((s) => s.tags))].slice(0, 14);

  type FilterTypeOption = FilterState["filterType"];
  const typeFilters: FilterTypeOption[] = ["all", "loop", "one-shot"];

  const getTypeCount = (type: FilterTypeOption) =>
    type === "all" ? samples.length : samples.filter((s) => s.sample_type === type).length;

  const handleRunEmbeddingSearch = async () => {
    if (!path) return;
    try {
      const rows: any[] = await invoke("search_by_embedding", { path, k: 8 });
      setResults(rows);
      setResultsOpen(true);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("embedding search failed", e);
      if (typeof propsOnError === "function") {
        propsOnError("Embedding search failed: " + String(e));
      }
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

  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        height: "100%",
        width: "260px",
        borderLeft: "1px solid #0f1117",
        background: "#0a0c12",
        padding: "20px 16px",
        display: "flex",
        flexDirection: "column",
        gap: "20px",
        flexShrink: 0,
        overflowY: "auto",
      }}
    >
      

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

      <div>
        <div
          style={{
            fontSize: "14px",
            color: "#374151",
            letterSpacing: "0.14em",
            marginBottom: "12px",
          }}
        >
          SPECTRAL ANALYSIS
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {/* sample_rate replaces low-ratio display in the UI */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: "12px", color: "#374151", letterSpacing: "0.06em" }}>SAMPLE RATE</div>
            <div style={{ fontSize: "13px", color: "#4b5563" }}>{sample.sample_rate ? `${sample.sample_rate} Hz` : '—'}</div>
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

      
      {sample.instrument_type === "kick" && (
        <div
          style={{
            background: "#a78bfa15",
            border: "1px solid #a78bfa40",
            borderRadius: "3px",
            padding: "10px",
          }}
        >
          <div
            style={{
              fontSize: "14px",
              color: "#a78bfa",
              letterSpacing: "0.12em",
              marginBottom: "8px",
            }}
          >
            KICK DETECTION
          </div>
          <div style={{ fontSize: "14px", color: "#6b7280", lineHeight: 2 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>low_ratio &gt; 0.6</span>
              <span
                style={{
                  color: sample.low_ratio > 0.6 ? "#22d3ee" : "#ef4444",
                }}
              >
                {sample.low_ratio > 0.6 ? "✓" : "✗"}{" "}
                {sample.low_ratio.toFixed(2)}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>attack_slope &gt; θ</span>
              <span
                style={{
                  color: sample.attack_slope > 1.5 ? "#22d3ee" : "#ef4444",
                }}
              >
                {sample.attack_slope > 1.5 ? "✓" : "✗"}{" "}
                {sample.attack_slope.toFixed(2)}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>decay &lt; 400ms</span>
              <span
                style={{
                  color:
                    sample.decay_time && sample.decay_time < 400
                      ? "#22d3ee"
                      : "#ef4444",
                }}
              >
                {sample.decay_time && sample.decay_time < 400 ? "✓" : "✗"}{" "}
                {sample.decay_time}ms
              </span>
            </div>
          </div>
        </div>
      )}

      
      

      
      <div>
        <div
          style={{
            fontSize: "14px",
            color: "#374151",
            letterSpacing: "0.14em",
            marginBottom: "8px",
          }}
        >
          EMBEDDING [64-dim]
        </div>
        <div
          style={{
            display: "flex",
            gap: "1px",
            flexWrap: "wrap",
            opacity: 0.6,
          }}
        >
          {Array.from({ length: 32 }, (_, i) => (
            <div
              key={i}
              style={{
                width: "6px",
                height: "6px",
                background: `hsl(${(sample.id * 37 + i * 11) % 360}, 60%, 40%)`,
                borderRadius: "1px",
              }}
            />
          ))}
        </div>
        <div style={{ fontSize: "13px", color: "#374151", marginTop: "6px" }}>
          cos-sim search · HNSW ready
        </div>
        <div style={{ marginTop: "8px", display: "flex", gap: "8px", alignItems: "center" }}>
          <button onClick={handleRunEmbeddingSearch} style={{
            marginTop: "8px",
            padding: "6px 8px",
            background: "#111827",
            color: "#e2e8f0",
            border: "1px solid #0f172a",
            borderRadius: "4px",
            cursor: "pointer",
          }}>
            Find similar samples
          </button>
        </div>
        <EmbeddingResultsModal isOpen={resultsOpen} results={results} onClose={() => setResultsOpen(false)} onSelect={handleSelectResult} />
      </div>

      
      <div
        style={{ borderTop: "1px solid #0f1117", paddingTop: "12px" }}
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
          style={{
            fontSize: "13px",
            color: "#4b5563",
            wordBreak: "break-all",
            lineHeight: 1.6,
          }}
        >
          {path || "—"}
        </div>
      </div>
    </div>
  );
}
