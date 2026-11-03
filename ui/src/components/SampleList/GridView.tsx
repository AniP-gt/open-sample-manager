import { translate } from "../../i18n";
import { useTranslation } from "react-i18next";
import type { Sample } from "../../types/sample";
import { InstrumentBadge } from "../TypeBadge/TypeBadge";

interface GridViewProps {
  samples: Sample[];
  selectedId: number | null;
  onSelect: (sample: Sample, isShift?: boolean) => void;
  onMetadataClick?: (sample: Sample) => void;
  showSampleMetadataQuality?: boolean;
}

export function GridView({ samples, selectedId, onSelect, onMetadataClick, showSampleMetadataQuality = true }: GridViewProps) {
  useTranslation();
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
                fontFamily: "var(--osm-font)",
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
                fontSize: "12px",
                color: "var(--osm-secondary)",
                fontFamily: "var(--osm-font)",
              }}
            >
              <span style={{ color: s.bpm ? "#22d3ee" : "var(--osm-secondary)" }}>
                {s.bpm ? `${Math.floor(s.bpm)} BPM` : "—"}
              </span>
              <span>{s.duration ? `${s.duration.toFixed(2)}s` : "—"}</span>
            </div>
            {showSampleMetadataQuality && (
              <button
                type="button"
                onClick={(event) => { event.stopPropagation(); onMetadataClick?.(s); }}
                style={{
                  background: "#080a0f",
                  border: "1px solid #1f2937",
                  borderRadius: "2px",
                  color: s.license ? "#22d3ee" : "var(--osm-secondary)",
                  cursor: "pointer",
                  fontFamily: "var(--osm-font)",
                  fontSize: "12px",
                  letterSpacing: "0.08em",
                  padding: "4px 6px",
                  textAlign: "left",
                }}
              >
                {(s.license ?? translate("noLic")).toUpperCase()} {s.quality_flags.length > 0 ? ` / QC ${s.quality_flags.length}` : ""}
              </button>
            )}
            {s.musical_key && (
              <div
                style={{
                  fontSize: "12px",
                  color: "#a78bfa",
                  fontFamily: "var(--osm-font)",
                  letterSpacing: "0.08em",
                }}
              >
                {translate("keyUpper")} {s.musical_key}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
