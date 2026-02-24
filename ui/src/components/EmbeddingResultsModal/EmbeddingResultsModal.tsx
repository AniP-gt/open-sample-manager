import type { Sample } from "../../types/sample";

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

interface Props {
  isOpen: boolean;
  results: EmbeddingResult[];
  onClose: () => void;
  // Called when a user selects a result. The modal will not close automatically
  // so the parent can decide how to handle navigation/focus.
  onSelect: (sample: Sample, path?: string) => void;
}

export function EmbeddingResultsModal({ isOpen, results, onClose, onSelect }: Props) {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1200,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "720px",
          maxHeight: "70vh",
          overflowY: "auto",
          background: "#0f1117",
          border: "1px solid #1f2937",
          borderRadius: 6,
          padding: 16,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h3 style={{ margin: 0, color: "#e2e8f0" }}>Similar samples</h3>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: "#6b7280", cursor: "pointer" }}>✕</button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {results.length === 0 && (
            <div style={{ color: "#9ca3af" }}>No similar samples found.</div>
          )}

          {results.map((r) => (
            <div
              key={r.row.id}
              onClick={() => onSelect(
                {
                  id: r.row.id,
                  file_name: r.row.file_name,
                  duration: r.row.duration ?? 0,
                  bpm: r.row.bpm ?? null,
                  periodicity: r.row.periodicity ?? 0,
                  low_ratio: r.row.low_ratio ?? 0,
                  attack_slope: r.row.attack_slope ?? 0,
                  decay_time: r.row.decay_time ?? null,
                  sample_type: (r.row.sample_type as any) ?? null,
                  tags: [],
                  waveform_peaks: r.row.waveform_peaks ? JSON.parse(r.row.waveform_peaks) : null,
                  playback_type: r.row.playback_type as any,
                  instrument_type: r.row.instrument_type as any,
                },
                r.row.path,
              )}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "10px",
                background: "#080a0f",
                borderRadius: 4,
                cursor: "pointer",
              }}
            >
              <div>
                <div style={{ color: "#d1d5db", fontSize: 15 }}>{r.row.file_name}</div>
                <div style={{ color: "#6b7280", fontSize: 12 }}>{r.row.path}</div>
              </div>
              <div style={{ color: "#22d3ee", fontWeight: 700 }}>{typeof r.similarity === "number" ? `${(r.similarity * 100).toFixed(1)}%` : "—"}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
