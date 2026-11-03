import { translate } from "../../i18n";
import { useTranslation } from "react-i18next";
import type { FilterState } from "../../types/sample";

interface FilterControlsProps {
  favoritesOnly: boolean;
  hideDuplicates: boolean;
  duplicateCount: number;
  favoritesCount: number;
  onFilterChange: (filters: Partial<FilterState>) => void;
}

export function FilterControls({
  favoritesOnly,
  hideDuplicates,
  duplicateCount,
  favoritesCount,
  onFilterChange,
}: FilterControlsProps) {
  useTranslation();
  return (
    <>
      <div style={{ padding: "8px 12px 4px" }}>
        <button
          aria-pressed={favoritesOnly}
          onClick={() => onFilterChange({ favoritesOnly: !favoritesOnly })}
          style={{
            background: favoritesOnly ? "#f6e05e25" : "#f6e05e0a",
            border: "1px solid var(--osm-border)",
            color: favoritesOnly ? "#f6e05e" : "var(--osm-secondary)",
            borderRadius: "3px",
            padding: "6px 10px",
            fontSize: "12px",
            cursor: "pointer",
            fontFamily: "var(--osm-font)",
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            letterSpacing: "0.02em",
            transition: "background 0.15s, border-color 0.15s, color 0.15s",
          }}
        >
          <span>{favoritesOnly ? "★" : "☆"}</span>
          <span>{translate("favorites")} {favoritesCount > 0 ? `(${favoritesCount})` : ""}</span>
        </button>
      </div>
      <div style={{ padding: "4px 12px 4px" }}>
        <button
          aria-pressed={hideDuplicates}
          onClick={() => onFilterChange({ hideDuplicates: !hideDuplicates })}
          style={{
            background: hideDuplicates ? "#38bdf825" : "#38bdf80a",
            border: "1px solid var(--osm-border)",
            color: hideDuplicates ? "#7dd3fc" : "var(--osm-secondary)",
            borderRadius: "3px",
            padding: "6px 10px",
            fontSize: "12px",
            cursor: "pointer",
            fontFamily: "var(--osm-font)",
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            letterSpacing: "0.02em",
            transition: "background 0.15s, border-color 0.15s, color 0.15s",
          }}
        >
          <span>{hideDuplicates ? "●" : "○"}</span>
          <span>{translate("hideDuplicates")} {duplicateCount > 0 ? `(${duplicateCount})` : ""}</span>
        </button>
      </div>
    </>
  );
}
