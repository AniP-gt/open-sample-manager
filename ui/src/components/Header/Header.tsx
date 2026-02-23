interface HeaderProps {
  sampleCount: number;
  scanned: boolean;
  onScanClick: () => void;
  onSettingsClick: () => void;
}
export function Header({ sampleCount, scanned, onScanClick, onSettingsClick }: HeaderProps) {
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
      </div>
    </div>
  );
}
