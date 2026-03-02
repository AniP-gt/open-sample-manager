import type { Midi, MidiTagRow } from "../../types/midi";
// No React default import required (new JSX transform). Keep file lean.
interface MidiDetailPanelProps {
  midi: Midi;
  midiTags: MidiTagRow[];
  tagFilterId: number | null;
  onTagFilterChange: (tagId: number | null) => void;
  onManageTags?: () => void;
  bottomInset?: number;
}

export function MidiDetailPanel({ midi, midiTags, tagFilterId, onTagFilterChange, onManageTags, bottomInset = 0 }: MidiDetailPanelProps) {
  const currentTagName = tagFilterId ? midiTags.find((t) => t.id === tagFilterId)?.name ?? "" : "";

  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        height: "100%",
        minHeight: 0,
        width: "min(260px, 40vw)",
        borderLeft: "1px solid #0f1117",
        background: "#0a0c12",
        padding: "20px 16px",
        display: "flex",
        flexDirection: "column",
        gap: "20px",
        zIndex: 2,
      }}
    >
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", paddingBottom: `${12 + bottomInset}px`, boxSizing: "border-box" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: 16, color: "#d1d5db", fontWeight: 700 }}>{midi.file_name}</div>
        </div>

        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: "12px", color: "#374151", letterSpacing: "0.12em", marginBottom: "8px" }}>FILTERS</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "8px" }}>
            <div>
              <div style={{ fontSize: "11px", color: "#374151", letterSpacing: "0.14em", marginBottom: "6px" }}>TAG</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                <button
                  onClick={() => onTagFilterChange(null)}
                  style={{ padding: "6px 10px", borderRadius: 4, border: "1px solid #1f2937", background: tagFilterId === null ? "#111827" : "transparent", color: tagFilterId === null ? "#fff" : "#6b7280", cursor: "pointer" }}
                >
                  ALL
                </button>
                {midiTags.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => onTagFilterChange(tagFilterId === t.id ? null : t.id)}
                    style={{ padding: "6px 10px", borderRadius: 4, border: "1px solid #1f2937", background: tagFilterId === t.id ? "#111827" : "transparent", color: tagFilterId === t.id ? "#fff" : "#6b7280", cursor: "pointer" }}
                  >
                    {t.name.toUpperCase()}
                  </button>
                ))}
                <button onClick={() => onManageTags?.()} style={{ padding: "6px 10px", borderRadius: 4, border: "1px dashed #374151", background: "transparent", color: "#9ca3af", cursor: "pointer" }}>Manage</button>
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: "12px", color: "#374151", letterSpacing: "0.06em" }}>TAG FILTER</div>
          <div style={{ marginTop: 6, fontSize: 13, color: "#4b5563" }}>{currentTagName || "(none)"}</div>
        </div>
      </div>

      <div style={{ borderTop: "1px solid #0f1117", paddingTop: 12, position: "sticky", bottom: 0, background: "#0a0c12", zIndex: 20 }}>
        <div style={{ fontSize: 13, color: "#374151", letterSpacing: "0.08em", marginBottom: 6 }}>PATH</div>
        <div title={midi.path || "—"} style={{ fontSize: 13, color: "#4b5563", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{midi.path || "—"}</div>
      </div>
    </div>
  );
}

export default MidiDetailPanel;
