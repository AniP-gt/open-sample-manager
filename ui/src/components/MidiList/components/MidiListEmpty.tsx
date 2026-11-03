import { translate } from "../../../i18n";
import { useTranslation } from "react-i18next";
interface MidiListEmptyProps {
  midiSearch: string;
  appliedMidiSearch: string;
  onMidiSearchChange: (query: string) => void;
  onMidiSearchSubmit: () => void;
}

export function MidiListEmpty({
  midiSearch,
  appliedMidiSearch,
  onMidiSearchChange,
  onMidiSearchSubmit,
}: MidiListEmptyProps) {
  useTranslation();
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
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              onMidiSearchSubmit();
            }
          }}
          placeholder={translate("searchByFilename")}
          style={{ flex: 1, fontSize: "16px", color: "#9ca3af", letterSpacing: "0.04em", background: "transparent", border: "none", outline: "none", fontFamily: "'Courier New', monospace" }}
        />
        <button
          type="button"
          aria-label={translate("searchMidiFiles")}
          onClick={onMidiSearchSubmit}
          style={{ background: "#0f1117", border: "1px solid #1f2937", color: "#f97316", padding: "4px 8px", borderRadius: "4px", cursor: "pointer", fontFamily: "'Courier New', monospace", fontSize: "12px" }}
        >
          {translate("search")}
        </button>
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
        {appliedMidiSearch.trim()
          ? translate("noMidiSearchResults", { query: appliedMidiSearch })
          : translate("noMidiFilesIndexedSwitchToSampleListOr")}
      </div>
    </div>
  );
}
