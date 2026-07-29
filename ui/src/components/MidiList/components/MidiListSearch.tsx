import type { MidiTagRow } from "../../../types/midi";
import { KEY_FILTER_OPTIONS } from "../../../utils/keyOptions";

interface MidiListSearchProps {
  midiSearch: string;
  onMidiSearchChange: (query: string) => void;
  onMidiSearchSubmit: () => void;
  tempoMin: string;
  onTempoMinChange: (value: string) => void;
  tempoMax: string;
  onTempoMaxChange: (value: string) => void;
  filterKey: string;
  onFilterKeyChange?: (value: string) => void;
  midiTags: MidiTagRow[];
  tagFilterId: number | null;
  onTagFilterChange?: (tagId: number | null) => void;
  filteredCount: number;
  totalCount: number;
}

const controlStyle = {
  height: "26px",
  padding: "3px 6px",
  borderRadius: "4px",
  border: "1px solid #1f2937",
  background: "#0f1117",
  color: "#9ca3af",
  fontSize: "12px",
  fontFamily: "'Courier New', monospace",
  outline: "none",
  boxSizing: "border-box" as const,
};

export function MidiListSearch({
  midiSearch,
  onMidiSearchChange,
  onMidiSearchSubmit,
  tempoMin,
  onTempoMinChange,
  tempoMax,
  onTempoMaxChange,
  filterKey,
  onFilterKeyChange,
  midiTags,
  tagFilterId,
  onTagFilterChange,
  filteredCount,
  totalCount,
}: MidiListSearchProps) {
  return (
    <div style={{ padding: "10px 16px", borderBottom: "1px solid #0f1117", background: "#0a0c12", display: "flex", alignItems: "center", gap: "8px", flexShrink: 0, flexWrap: "wrap" }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2">
        <circle cx="11" cy="11" r="8" />
        <path d="m21 21-4.35-4.35" />
      </svg>
      <input
        value={midiSearch}
        onChange={(e) => onMidiSearchChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            onMidiSearchSubmit();
          }
        }}
        placeholder="Search by filename..."
        style={{ flex: "1 1 220px", minWidth: "160px", fontSize: "16px", color: "#9ca3af", letterSpacing: "0.04em", background: "transparent", border: "none", outline: "none", fontFamily: "'Courier New', monospace" }}
      />
      <button
        type="button"
        aria-label="Search MIDI files"
        onClick={onMidiSearchSubmit}
        style={{ ...controlStyle, cursor: "pointer", color: "#f97316" }}
      >
        Search
      </button>
      <input
        type="number"
        value={tempoMin}
        onChange={(e) => onTempoMinChange(e.target.value)}
        placeholder="BPM MIN"
        aria-label="MIDI BPM minimum"
        style={{ ...controlStyle, width: "78px" }}
      />
      <input
        type="number"
        value={tempoMax}
        onChange={(e) => onTempoMaxChange(e.target.value)}
        placeholder="BPM MAX"
        aria-label="MIDI BPM maximum"
        style={{ ...controlStyle, width: "78px" }}
      />
      <select
        value={filterKey}
        onChange={(e) => onFilterKeyChange?.(e.target.value)}
        aria-label="MIDI key filter"
        style={{ ...controlStyle, width: "74px" }}
      >
        {KEY_FILTER_OPTIONS.map((key) => (
          <option key={key || "all"} value={key}>{key || "KEY"}</option>
        ))}
      </select>
      <select
        value={tagFilterId ?? ""}
        onChange={(e) => onTagFilterChange?.(e.target.value ? Number(e.target.value) : null)}
        aria-label="MIDI tag filter"
        style={{ ...controlStyle, width: "104px" }}
      >
        <option value="">TAG</option>
        {midiTags.map((tag) => (
          <option key={tag.id} value={tag.id}>{tag.name}</option>
        ))}
      </select>
      <span style={{ fontSize: "14px", color: "#374151", letterSpacing: "0.1em" }}>
        {filteredCount}/{totalCount} RESULTS
      </span>
    </div>
  );
}
