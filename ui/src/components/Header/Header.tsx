interface HeaderProps {
  sampleCount: number;
  scanned: boolean;
  onScanClick: () => void;
  onSettingsClick: () => void;
  onReload?: () => void;
  // When true, show the import drop affordance (app-level drag is active)
  isDragOver?: boolean;
  // View mode toggle
  viewMode: 'sample' | 'midi';
  onViewModeChange: (mode: 'sample' | 'midi') => void;
}

export function Header({ sampleCount, scanned, onScanClick, onSettingsClick, onReload, isDragOver, viewMode, onViewModeChange }: HeaderProps) {
  return (
    <div
      style={{
        padding: "14px 20px",
        borderBottom: "1px solid #0f1117",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: "#0a0c12",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
        <div
          style={{
            width: "28px",
            height: "28px",
            borderRadius: "3px",
            background: "linear-gradient(135deg, #f97316, #ea580c)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "0 0 12px #f9731640",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
            <path d="M12 3v10.55A4 4 0 1 0 14 17V7h4V3z" />
          </svg>
        </div>
        <div>
          <div
            style={{
              fontSize: "18px",
              fontWeight: 700,
              letterSpacing: "0.1em",
              color: "#f1f5f9",
            }}
          >
            OPEN SAMPLE MANAGER
          </div>
          <div
            style={{
              fontSize: "14px",
              color: "#374151",
              letterSpacing: "0.12em",
            }}
          >
            v0.1.0-alpha · Logic Pro AU · LOCAL
          </div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        {/* Sample/MIDI View Toggle */}
        <div style={{ display: "flex", gap: "2px", background: "#1f2937", padding: "2px", borderRadius: "4px" }}>
          <button
            onClick={() => onViewModeChange('sample')}
            style={{
              background: viewMode === 'sample' ? "#3b82f6" : "transparent",
              border: "none",
              color: viewMode === 'sample' ? "white" : "#9ca3af",
              padding: "6px 12px",
              borderRadius: "3px",
              cursor: "pointer",
              fontSize: "12px",
              fontFamily: "'Courier New', monospace",
              letterSpacing: "0.05em",
              transition: "all 0.15s ease",
            }}
          >
            Sample List
          </button>
          <button
            onClick={() => onViewModeChange('midi')}
            style={{
              background: viewMode === 'midi' ? "#3b82f6" : "transparent",
              border: "none",
              color: viewMode === 'midi' ? "white" : "#9ca3af",
              padding: "6px 12px",
              borderRadius: "3px",
              cursor: "pointer",
              fontSize: "12px",
              fontFamily: "'Courier New', monospace",
              letterSpacing: "0.05em",
              transition: "all 0.15s ease",
            }}
          >
            MIDI List
          </button>
        </div>

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
        )}
      </div>
    </div>
  );
}
