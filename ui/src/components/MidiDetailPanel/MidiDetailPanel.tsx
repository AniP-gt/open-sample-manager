import type { Midi, MidiTagRow, TimidityStatus } from "../../types/midi";
// No React default import required (new JSX transform). Keep file lean.
interface MidiDetailPanelProps {
  midi: Midi;
  midiTags: MidiTagRow[];
  tagFilterId: number | null;
  onTagFilterChange: (tagId: number | null) => void;
  onManageTags?: () => void;
  bottomInset?: number;
  // Playback controls: render play/stop button inside the panel
  isPlaying?: boolean;
  onTogglePlay?: () => Promise<void> | void;
  timidityStatus?: TimidityStatus | null;
}

export function MidiDetailPanel({ midi, midiTags, tagFilterId, onTagFilterChange, onManageTags, bottomInset = 0, isPlaying = false, onTogglePlay, timidityStatus }: MidiDetailPanelProps) {
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
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 8 }}>
          <div style={{ fontSize: 16, color: "#d1d5db", fontWeight: 700 }}>{midi.file_name}</div>

          {/* Prominent Play/Stop button placed under the filename. Size and weight
              chosen to match other prominent action buttons in the UI (eg. "Load more"). */}
          {typeof onTogglePlay === "function" ? (
            <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                type="button"
                onClick={async (e) => {
                  e.stopPropagation();
                  try {
                    await onTogglePlay?.();
                  } catch (err) {
                    console.error("Playback toggle failed:", err);
                  }
                }}
                aria-pressed={isPlaying}
                aria-label={isPlaying ? "Stop MIDI playback" : "Play MIDI"}
                title={isPlaying ? "Stop playback" : "Play"}
                style={{
                  minWidth: 140,
                  background: isPlaying ? "#ef4444" : "#3b82f6",
                  border: "1px solid rgba(255,255,255,0.03)",
                  color: "white",
                  padding: "10px 16px",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: 15,
                  fontWeight: 700,
                  boxShadow: isPlaying ? "0 6px 18px rgba(239,68,68,0.18)" : "0 6px 18px rgba(59,130,246,0.18)",
                  transition: "transform 120ms ease, box-shadow 120ms ease",
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0px)'; }}
              >
                {isPlaying ? "Stop" : "Play"}
              </button>

              {/* TiMidity prompt remains visible below the control when not installed */}
              {timidityStatus && !timidityStatus.installed && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: "#fca5a5", fontSize: "12px", fontFamily: "'Courier New', monospace" }}>TiMidity not installed</span>
                  <button
                    onClick={() => navigator.clipboard.writeText(timidityStatus.install_command || "")}
                    style={{ background: "#374151", border: "1px solid #4b5563", color: "#9ca3af", padding: "6px 10px", borderRadius: "6px", cursor: "pointer", fontSize: "12px", fontFamily: "'Courier New', monospace" }}
                  >
                    Copy Install Command
                  </button>
                </div>
              )}
            </div>
          ) : null}
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
