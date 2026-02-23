interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onClearAllSamples: () => void;
  sampleCount: number;
}

export function SettingsModal({
  isOpen,
  onClose,
  onClearAllSamples,
  sampleCount,
}: SettingsModalProps) {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0, 0, 0, 0.8)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#0f1117",
          border: "1px solid #1f2937",
          borderRadius: "4px",
          padding: "24px",
          minWidth: "400px",
          maxWidth: "500px",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "24px",
            paddingBottom: "16px",
            borderBottom: "1px solid #1f2937",
          }}
        >
          <h2
            style={{
              fontSize: "18px",
              fontWeight: 700,
              letterSpacing: "0.1em",
              color: "#f1f5f9",
              margin: 0,
            }}
          >
            SETTINGS
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "#6b7280",
              cursor: "pointer",
              fontSize: "20px",
              padding: "4px 8px",
            }}
          >
            ✕
          </button>
        </div>

        {/* Database Section */}
        <div style={{ marginBottom: "24px" }}>
          <h3
            style={{
              fontSize: "14px",
              letterSpacing: "0.1em",
              color: "#9ca3af",
              marginBottom: "12px",
            }}
          >
            DATABASE
          </h3>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "12px",
              background: "#080a0f",
              borderRadius: "2px",
            }}
          >
            <div>
              <div style={{ fontSize: "14px", color: "#d1d5db" }}>
                Sample Library
              </div>
              <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "4px" }}>
                {sampleCount} samples indexed
              </div>
            </div>
            <button
              onClick={() => {
                if (confirm("Are you sure you want to delete all samples from the library?")) {
                  onClearAllSamples();
                  onClose();
                }
              }}
              style={{
                fontSize: "12px",
                letterSpacing: "0.1em",
                background: "#7f1d1d",
                color: "#fecaca",
                border: "1px solid #ef444440",
                padding: "8px 16px",
                borderRadius: "2px",
                cursor: "pointer",
                fontFamily: "'Courier New', monospace",
              }}
            >
              CLEAR ALL
            </button>
          </div>
        </div>

        {/* About Section */}
        <div>
          <h3
            style={{
              fontSize: "14px",
              letterSpacing: "0.1em",
              color: "#9ca3af",
              marginBottom: "12px",
            }}
          >
            ABOUT
          </h3>
          <div
            style={{
              padding: "12px",
              background: "#080a0f",
              borderRadius: "2px",
              fontSize: "13px",
              color: "#6b7280",
            }}
          >
            <div style={{ marginBottom: "8px" }}>
              <span style={{ color: "#9ca3af" }}>Version:</span> 0.1.0-alpha
            </div>
            <div style={{ marginBottom: "8px" }}>
              <span style={{ color: "#9ca3af" }}>Database:</span> SQLite (WAL mode)
            </div>
            <div>
              <span style={{ color: "#9ca3af" }}>Search:</span> FTS5 Full-Text
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
