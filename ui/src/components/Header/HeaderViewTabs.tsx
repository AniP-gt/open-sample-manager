import type { ViewMode } from "../../types/viewMode";

type HeaderViewTabsProps = {
  readonly onViewModeChange: (mode: ViewMode) => void;
  readonly viewMode: ViewMode;
};

const viewModes = ["sample", "midi", "web"] as const satisfies readonly ViewMode[];

export function HeaderViewTabs({ onViewModeChange, viewMode }: HeaderViewTabsProps) {
  return (
    <>
      <div style={{ display: "flex", gap: "2px", background: "#1f2937", padding: "2px", borderRadius: "4px" }}>
        {viewModes.map((mode) => (
          <button
            key={mode}
            type="button"
            onClick={() => onViewModeChange(mode)}
            style={{
              background: viewMode === mode ? "#3b82f6" : "transparent",
              border: "none",
              color: viewMode === mode ? "white" : "#9ca3af",
              padding: "6px 12px",
              borderRadius: "3px",
              cursor: "pointer",
              fontSize: "12px",
              fontFamily: "'Courier New', monospace",
              letterSpacing: "0.05em",
              transition: "all 0.15s ease",
            }}
          >
            {mode.toUpperCase()}
          </button>
        ))}
      </div>
    </>
  );
}
