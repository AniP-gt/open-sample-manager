import type { ViewMode } from "../../types/viewMode";
import { HeaderBrand } from "./HeaderBrand";
import { HeaderViewTabs } from "./HeaderViewTabs";

interface HeaderProps {
  sampleCount: number;
  scanned: boolean;
  onScanClick: () => void;
  onSettingsClick: () => void;
  onReload?: () => void;
  onReScanClick?: () => void;
  // When true, show the import drop affordance (app-level drag is active)
  isDragOver?: boolean;
  onBackToSources: () => void;
  onGoBack: () => void;
  onGoForward: () => void;
  showProviderControls: boolean;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

export function Header({ sampleCount, scanned, onScanClick, onSettingsClick, onReload, onReScanClick, isDragOver, onBackToSources, onGoBack, onGoForward, showProviderControls, viewMode, onViewModeChange }: HeaderProps) {
  return (
    <div
      style={{
        padding: "14px 20px",
        borderBottom: "1px solid #0f1117",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        rowGap: "10px",
        columnGap: "16px",
        background: "#0a0c12",
      }}
    >
      <HeaderBrand />

      <div style={{ display: "flex", alignItems: "center", flex: "1 1 auto", flexWrap: "wrap", gap: "8px", justifyContent: "flex-end", minWidth: 0 }}>
        <HeaderViewTabs viewMode={viewMode} onViewModeChange={onViewModeChange} />
        {showProviderControls && (
          <>
            <button type="button" title="Go back" aria-label="Go back" onClick={onGoBack} style={{ background: "transparent", border: "1px solid #374151", borderRadius: "2px", color: "#d1d5db", cursor: "pointer", fontFamily: "'Courier New', monospace", fontSize: "11px", letterSpacing: "0.08em", padding: "6px 8px" }}>
              BACK
            </button>
            <button type="button" title="Go forward" aria-label="Go forward" onClick={onGoForward} style={{ background: "transparent", border: "1px solid #374151", borderRadius: "2px", color: "#d1d5db", cursor: "pointer", fontFamily: "'Courier New', monospace", fontSize: "11px", letterSpacing: "0.08em", padding: "6px 8px" }}>
              FORWARD
            </button>
            <button type="button" title="Back to sources" aria-label="Back to sources" onClick={onBackToSources} style={{ background: "transparent", border: "1px solid #374151", borderRadius: "2px", color: "#d1d5db", cursor: "pointer", fontFamily: "'Courier New', monospace", fontSize: "11px", letterSpacing: "0.08em", padding: "6px 8px" }}>
              BACK TO SOURCES
            </button>
          </>
        )}

        {scanned && (
          <div
            style={{
              fontSize: "14px",
              color: "#22d3ee",
              letterSpacing: "0.1em",
              background: "#22d3ee10",
              border: "1px solid #22d3ee30",
              padding: "3px 8px",
              borderRadius: "2px",
            }}
          >
            ✓ {sampleCount} SAMPLES INDEXED
          </div>
        )}
        <button
          onClick={onSettingsClick}
          title="Settings"
          style={{
            background: "transparent",
            border: "1px solid #374151",
            color: "#6b7280",
            padding: "6px 10px",
            borderRadius: "2px",
            cursor: "pointer",
            fontSize: "14px",
            fontFamily: "'Courier New', monospace",
          }}
        >
          ⚙
        </button>
        {onReload && (
          <button
            onClick={onReload}
            title="Reload file tree"
            style={{
              background: "transparent",
              border: "1px solid #374151",
              color: "#6b7280",
              padding: "6px 10px",
              borderRadius: "2px",
              cursor: "pointer",
              fontSize: "14px",
              fontFamily: "'Courier New', monospace",
            }}
          >
            ↻
          </button>
        )}

        {/* Import affordance: when dragging files over the app, show a strong
            visual affordance in place of the scan button to indicate drop target */}
        {isDragOver ? (
          <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "6px 12px",
                borderRadius: "3px",
                background: "linear-gradient(90deg,#f97316,#fb923c)",
                color: "#000",
                fontWeight: 800,
                letterSpacing: "0.08em",
                boxShadow: "0 6px 18px rgba(249,115,22,0.16)",
              }}
              aria-label="Drop to import"
              // small lift animation
              onAnimationEnd={() => {}}
            >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M12 3v10" stroke="#000" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M8 7l4-4 4 4" stroke="#000" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            DROP TO IMPORT
          </div>
          ) : (
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={onScanClick}
              style={{
                fontSize: "15px",
                letterSpacing: "0.1em",
                background: "#f97316",
                color: "#000",
                border: "none",
                padding: "6px 14px",
                borderRadius: "2px",
                cursor: "pointer",
                fontFamily: "'Courier New', monospace",
                fontWeight: 700,
              }}
            >
              SCAN LIBRARY
            </button>
            {(onReScanClick && sampleCount > 0) && (
              <button
                onClick={onReScanClick}
                title="Re-analyze all samples (update key detection)"
                style={{
                  fontSize: "12px",
                  letterSpacing: "0.08em",
                  background: "transparent",
                  color: "#6b7280",
                  border: "1px solid #1f2937",
                  padding: "6px 10px",
                  borderRadius: "2px",
                  cursor: "pointer",
                  fontFamily: "'Courier New', monospace",
                }}
              >
                RE-SCAN
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
