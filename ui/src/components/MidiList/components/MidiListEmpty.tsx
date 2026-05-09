interface MidiListEmptyProps {
  midiSearch: string;
  onMidiSearchChange: (query: string) => void;
}

export function MidiListEmpty({ midiSearch, onMidiSearchChange }: MidiListEmptyProps) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", background: "#0a0c12" }}>
      <div style={{ padding: "10px 16px", borderBottom: "1px solid #0f1117", background: "#0a0c12", display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <input
          value={midiSearch}
          onChange={(e) => onMidiSearchChange(e.target.value)}
          placeholder="Search by filename..."
          style={{ flex: 1, fontSize: "16px", color: "#9ca3af", letterSpacing: "0.04em", background: "transparent", border: "none", outline: "none", fontFamily: "'Courier New', monospace" }}
        />
      </div>
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#6b7280",
          fontSize: "14px",
          fontFamily: "'Courier New', monospace",
        }}
      >
        {midiSearch.trim()
          ? `No results for '${midiSearch}'`
          : "No MIDI files indexed. Switch to Sample List or scan a directory containing MIDI files."}
      </div>
    </div>
  );
}
