interface MidiListSearchProps {
  midiSearch: string;
  onMidiSearchChange: (query: string) => void;
  filteredCount: number;
  totalCount: number;
}

export function MidiListSearch({ midiSearch, onMidiSearchChange, filteredCount, totalCount }: MidiListSearchProps) {
  return (
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
      <span style={{ fontSize: "14px", color: "#374151", letterSpacing: "0.1em" }}>
        {filteredCount}/{totalCount} RESULTS
      </span>
    </div>
  );
}
