import type { Sample, SampleType, FilterState } from "../../types/sample";

interface FilterSidebarProps {
  samples: Sample[];
  filters: FilterState;
  onFilterChange: (filters: Partial<FilterState>) => void;
}

export function FilterSidebar({
  samples,
  filters,
  onFilterChange,
}: FilterSidebarProps) {
  const allTags = [...new Set(samples.flatMap((s) => s.tags))].slice(0, 14);

  const typeFilters: Array<SampleType | "all"> = [
    "all",
    "kick",
    "loop",
    "one-shot",
  ];

  const getTypeCount = (type: SampleType | "all") => {
    return type === "all"
      ? samples.length
      : samples.filter((s) => s.sample_type === type).length;
  };

  return (
    <div
      style={{
        width: "180px",
        borderRight: "1px solid #0f1117",
        background: "#0a0c12",
        padding: "16px 12px",
        display: "flex",
        flexDirection: "column",
        gap: "20px",
        flexShrink: 0,
        overflowY: "auto",
      }}
    >
      
      <div>
        <div
          style={{
            fontSize: "9px",
            color: "#374151",
            letterSpacing: "0.14em",
            marginBottom: "10px",
          }}
        >
          SAMPLE TYPE
        </div>
        {typeFilters.map((t) => (
          <button
            key={t}
            onClick={() => onFilterChange({ filterType: t })}
            style={{
              display: "block",
              width: "100%",
              textAlign: "left",
              background: filters.filterType === t ? "#111827" : "transparent",
              border: "none",
              borderLeft:
                filters.filterType === t
                  ? "2px solid #f97316"
                  : "2px solid transparent",
              padding: "6px 8px",
              fontFamily: "'Courier New', monospace",
              fontSize: "11px",
              color: filters.filterType === t ? "#f1f5f9" : "#6b7280",
              cursor: "pointer",
              letterSpacing: "0.08em",
              marginBottom: "2px",
              borderRadius: "0 2px 2px 0",
            }}
          >
            {t.toUpperCase()}
            <span
              style={{ float: "right", color: "#374151", fontSize: "10px" }}
            >
              {getTypeCount(t)}
            </span>
          </button>
        ))}
      </div>

      
      <div>
        <div
          style={{
            fontSize: "9px",
            color: "#374151",
            letterSpacing: "0.14em",
            marginBottom: "10px",
          }}
        >
          BPM RANGE
        </div>
        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
          <div
            style={{
              flex: 1,
              border: "1px solid #1f2937",
              borderRadius: "2px",
              padding: "4px 6px",
            }}
          >
            <input
              type="number"
              placeholder="MIN"
              value={filters.filterBpmMin}
              onChange={(e) =>
                onFilterChange({ filterBpmMin: e.target.value })
              }
              style={{ width: "100%", fontSize: "10px", color: "#9ca3af" }}
            />
          </div>
          <span style={{ color: "#374151", fontSize: "10px" }}>—</span>
          <div
            style={{
              flex: 1,
              border: "1px solid #1f2937",
              borderRadius: "2px",
              padding: "4px 6px",
            }}
          >
            <input
              type="number"
              placeholder="MAX"
              value={filters.filterBpmMax}
              onChange={(e) =>
                onFilterChange({ filterBpmMax: e.target.value })
              }
              style={{ width: "100%", fontSize: "10px", color: "#9ca3af" }}
            />
          </div>
        </div>
      </div>

      
      <div>
        <div
          style={{
            fontSize: "9px",
            color: "#374151",
            letterSpacing: "0.14em",
            marginBottom: "10px",
          }}
        >
          TAGS
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
          {allTags.map((tag) => (
            <span
              key={tag}
              className="tag-chip"
              onClick={() => onFilterChange({ search: tag })}
              style={{
                fontSize: "9px",
                padding: "2px 6px",
                background: "#0f1117",
                border: "1px solid #1f2937",
                borderRadius: "2px",
                color: "#6b7280",
                letterSpacing: "0.06em",
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      
      <div>
        <div
          style={{
            fontSize: "9px",
            color: "#374151",
            letterSpacing: "0.14em",
            marginBottom: "10px",
          }}
        >
          DB STATUS
        </div>
        <div style={{ fontSize: "9px", color: "#4b5563", lineHeight: 1.8 }}>
          <div>ENGINE: SQLite + FTS5</div>
          <div>RECORDS: {samples.length}</div>
          <div>INDEX: ✓ BPM, TYPE</div>
          <div>EMBED: 64-dim</div>
        </div>
      </div>
    </div>
  );
}
