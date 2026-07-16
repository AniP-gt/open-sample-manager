import type { FilterState } from "../../types/sample";
import { KEY_FILTER_OPTIONS } from "../../utils/keyOptions";

interface FilterControlsProps {
  favoritesOnly: boolean;
  hideDuplicates: boolean;
  duplicateCount: number;
  filterKey: string;
  favoritesCount: number;
  onFilterChange: (filters: Partial<FilterState>) => void;
}

export function FilterControls({
  favoritesOnly,
  hideDuplicates,
  duplicateCount,
  filterKey,
  favoritesCount,
  onFilterChange,
}: FilterControlsProps) {
  return (
    <>
      <div style={{ padding: "8px 12px 4px" }}>
        <button
          onClick={() => onFilterChange({ favoritesOnly: !favoritesOnly })}
          style={{
            background: favoritesOnly ? "#f6e05e25" : "#f6e05e0a",
            border: `1px solid ${favoritesOnly ? "#f6e05e80" : "#f6e05e30"}`,
            color: favoritesOnly ? "#f6e05e" : "#9ca3af",
            borderRadius: "3px",
            padding: "6px 10px",
            fontSize: "11px",
            cursor: "pointer",
            fontFamily: "'Courier New', monospace",
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            letterSpacing: "0.08em",
            transition: "background 0.15s, border-color 0.15s, color 0.15s",
          }}
        >
          <span>{favoritesOnly ? "★" : "☆"}</span>
          <span>FAVORITES {favoritesCount > 0 ? `(${favoritesCount})` : ""}</span>
        </button>
      </div>
      <div style={{ padding: "4px 12px 4px" }}>
        <button
          onClick={() => onFilterChange({ hideDuplicates: !hideDuplicates })}
          style={{
            background: hideDuplicates ? "#38bdf825" : "#38bdf80a",
            border: `1px solid ${hideDuplicates ? "#38bdf880" : "#38bdf830"}`,
            color: hideDuplicates ? "#7dd3fc" : "#9ca3af",
            borderRadius: "3px",
            padding: "6px 10px",
            fontSize: "11px",
            cursor: "pointer",
            fontFamily: "'Courier New', monospace",
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            letterSpacing: "0.08em",
            transition: "background 0.15s, border-color 0.15s, color 0.15s",
          }}
        >
          <span>{hideDuplicates ? "●" : "○"}</span>
          <span>HIDE DUPLICATES {duplicateCount > 0 ? `(${duplicateCount})` : ""}</span>
        </button>
      </div>
      <div style={{ padding: "4px 12px 12px" }}>
        <div style={{ fontSize: "11px", color: "#374151", letterSpacing: "0.14em", marginBottom: "6px" }}>KEY</div>
        <select
          value={filterKey ?? ""}
          onChange={(e) => onFilterChange({ filterKey: e.target.value })}
          style={{
            width: "100%",
            background: "#0a0c12",
            border: "1px solid #1f2937",
            borderRadius: "3px",
            color: "#e2e8f0",
            padding: "6px 8px",
            fontFamily: "'Courier New', monospace",
            fontSize: "12px",
          }}
        >
          {KEY_FILTER_OPTIONS.map((k) => <option key={k} value={k}>{k || "All"}</option>)}
        </select>
      </div>
    </>
  );
}
