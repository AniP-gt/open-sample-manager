import type { Sample } from "../../types/sample";
import { InstrumentBadge } from "../TypeBadge/TypeBadge";

interface GridViewProps {
  samples: Sample[];
  selectedId: number | null;
  onSelect: (sample: Sample) => void;
}

export function GridView({ samples, selectedId, onSelect }: GridViewProps) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
        gap: "12px",
        padding: "12px",
        overflowY: "auto",
        flex: 1,
        boxSizing: "border-box",
      }}
    >
      {samples.map((s) => {
        const isSelected = selectedId === s.id;
        return (
          <div
            key={s.id}
            onClick={() => onSelect(s)}
            style={{
              cursor: "pointer",
              padding: "10px",
              background: isSelected ? "#111827" : "#0a0c12",
              border: `1px solid ${isSelected ? "#f97316" : "#1f2937"}`,
              borderRadius: "4px",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              minWidth: 0,
              transition: "border-color 0.15s, background 0.15s",
            }}
          >
            <div
              title={s.file_name}
              style={{
                fontSize: "13px",
                color: "#d1d5db",
                fontFamily: "'Courier New', monospace",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {s.file_name}
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <InstrumentBadge type={s.instrument_type} />
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "11px",
                color: "#6b7280",
                fontFamily: "'Courier New', monospace",
              }}
            >
              <span style={{ color: s.bpm ? "#22d3ee" : "#374151" }}>
                {s.bpm ? `${Math.floor(s.bpm)} BPM` : "—"}
              </span>
              <span>{s.duration ? `${s.duration.toFixed(2)}s` : "—"}</span>
            </div>
            {s.musical_key && (
              <div
                style={{
                  fontSize: "11px",
                  color: "#a78bfa",
                  fontFamily: "'Courier New', monospace",
                  letterSpacing: "0.08em",
                }}
              >
                KEY {s.musical_key}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
