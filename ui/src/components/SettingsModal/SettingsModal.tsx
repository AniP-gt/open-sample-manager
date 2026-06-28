interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onClearAllSamples: () => void;
  onDatabaseExport: () => void;
  onDatabaseImport: () => void;
  databaseMigrationBusy: boolean;
  databaseMigrationStatus: string | null;
  sampleCount: number;
  autoPlayOnSelect: boolean;
  onAutoPlayChange: (enabled: boolean) => void;
  instrumentColorCoding: boolean;
  onInstrumentColorCodingChange: (enabled: boolean) => void;
  directoryClickFiltering: boolean;
  onDirectoryClickFilteringChange: (enabled: boolean) => void;
}

export function SettingsModal({
  isOpen,
  onClose,
  sampleCount,
  autoPlayOnSelect,
  onAutoPlayChange,
  instrumentColorCoding,
  onInstrumentColorCodingChange,
  directoryClickFiltering,
  onDirectoryClickFilteringChange,
  onDatabaseExport,
  onDatabaseImport,
  databaseMigrationBusy,
  databaseMigrationStatus,
}: Omit<SettingsModalProps, 'onClearAllSamples'>) {
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
        padding: "24px",
        boxSizing: "border-box",
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
          maxHeight: "calc(100vh - 48px)",
          overflowY: "auto",
          boxSizing: "border-box",
        }}
        role="dialog"
        aria-modal="true"
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

        {/* Playback Section */}
        <div style={{ marginBottom: "24px" }}>
          <h3
            style={{
              fontSize: "14px",
              letterSpacing: "0.1em",
              color: "#9ca3af",
              marginBottom: "12px",
            }}
          >
            PLAYBACK
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
                Auto-play on select
              </div>
              <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "4px" }}>
                Automatically play audio when a file is selected
              </div>
            </div>
            <button
              onClick={() => onAutoPlayChange(!autoPlayOnSelect)}
              style={{
                width: "44px",
                height: "24px",
                borderRadius: "12px",
                border: "none",
                cursor: "pointer",
                background: autoPlayOnSelect ? "#f97316" : "#374151",
                position: "relative",
                flexShrink: 0,
                transition: "background 0.2s",
              }}
              aria-checked={autoPlayOnSelect}
              role="switch"
              aria-label="Auto-play on select"
            >
              <span
                style={{
                  position: "absolute",
                  top: "3px",
                  left: autoPlayOnSelect ? "23px" : "3px",
                  width: "18px",
                  height: "18px",
                  borderRadius: "50%",
                  background: "#fff",
                  transition: "left 0.2s",
                }}
              />
            </button>
          </div>
        </div>

        {/* Display Section */}
        <div style={{ marginBottom: "24px" }}>
          <h3
            style={{
              fontSize: "14px",
              letterSpacing: "0.1em",
              color: "#9ca3af",
              marginBottom: "12px",
            }}
          >
            DISPLAY
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
                Instrument color coding
              </div>
              <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "4px" }}>
                Color-code rows and badges by instrument type
              </div>
            </div>
            <button
              onClick={() => onInstrumentColorCodingChange(!instrumentColorCoding)}
              style={{
                width: "44px",
                height: "24px",
                borderRadius: "12px",
                border: "none",
                cursor: "pointer",
                background: instrumentColorCoding ? "#f97316" : "#374151",
                position: "relative",
                flexShrink: 0,
                transition: "background 0.2s",
              }}
              aria-checked={instrumentColorCoding}
              role="switch"
              aria-label="Instrument color coding"
            >
              <span
                style={{
                  position: "absolute",
                  top: "3px",
                  left: instrumentColorCoding ? "23px" : "3px",
                  width: "18px",
                  height: "18px",
                  borderRadius: "50%",
                  background: "#fff",
                  transition: "left 0.2s",
                }}
              />
            </button>
          </div>
        </div>

        {/* Navigation Section */}
        <div style={{ marginBottom: "24px" }}>
          <h3
            style={{
              fontSize: "14px",
              letterSpacing: "0.1em",
              color: "#9ca3af",
              marginBottom: "12px",
            }}
          >
            NAVIGATION
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
                Directory click filtering
              </div>
              <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "4px" }}>
                Filter list when clicking directories in the sidebar
              </div>
            </div>
            <button
              onClick={() => onDirectoryClickFilteringChange(!directoryClickFiltering)}
              style={{
                width: "44px",
                height: "24px",
                borderRadius: "12px",
                border: "none",
                cursor: "pointer",
                background: directoryClickFiltering ? "#f97316" : "#374151",
                position: "relative",
                flexShrink: 0,
                transition: "background 0.2s",
              }}
              aria-checked={directoryClickFiltering}
              role="switch"
              aria-label="Directory click filtering"
            >
              <span
                style={{
                  position: "absolute",
                  top: "3px",
                  left: directoryClickFiltering ? "23px" : "3px",
                  width: "18px",
                  height: "18px",
                  borderRadius: "50%",
                  background: "#fff",
                  transition: "left 0.2s",
                }}
              />
            </button>
          </div>
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
          <div style={{ padding: "12px", background: "#080a0f", borderRadius: "2px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "12px",
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
                  const event = new CustomEvent('confirm-clear-all', { detail: null });
                  window.dispatchEvent(event);
                }}
                style={{
                  fontSize: "12px",
                  letterSpacing: "0.1em",
                  background: "#ef4444",
                  color: "#fff",
                  border: "1px solid #ef4444",
                  padding: "8px 16px",
                  borderRadius: "2px",
                  cursor: "pointer",
                  fontFamily: "'Courier New', monospace",
                }}
              >
                CLEAR ALL
              </button>
            </div>
            <div
              style={{
                marginTop: "12px",
                paddingTop: "12px",
                borderTop: "1px solid #1f2937",
              }}
            >
              <div style={{ fontSize: "14px", color: "#d1d5db" }}>
                Library migration
              </div>
              <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "4px" }}>
                Export metadata only. Import by selecting samples.db; audio and MIDI files must exist at the same paths on the target PC.
              </div>
              {databaseMigrationStatus && (
                <div style={{ fontSize: "12px", color: "#f97316", marginTop: "8px" }}>
                  {databaseMigrationStatus}
                </div>
              )}
              <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                <button
                  onClick={onDatabaseExport}
                  disabled={databaseMigrationBusy}
                  style={{
                    fontSize: "12px",
                    letterSpacing: "0.1em",
                    background: databaseMigrationBusy ? "#374151" : "#111827",
                    color: "#f1f5f9",
                    border: "1px solid #374151",
                    padding: "8px 12px",
                    borderRadius: "2px",
                    cursor: databaseMigrationBusy ? "not-allowed" : "pointer",
                    fontFamily: "'Courier New', monospace",
                  }}
                >
                  EXPORT DB
                </button>
                <button
                  onClick={onDatabaseImport}
                  disabled={databaseMigrationBusy}
                  style={{
                    fontSize: "12px",
                    letterSpacing: "0.1em",
                    background: databaseMigrationBusy ? "#374151" : "#f97316",
                    color: "#fff",
                    border: databaseMigrationBusy ? "1px solid #374151" : "1px solid #f97316",
                    padding: "8px 12px",
                    borderRadius: "2px",
                    cursor: databaseMigrationBusy ? "not-allowed" : "pointer",
                    fontFamily: "'Courier New', monospace",
                  }}
                >
                  IMPORT DB
                </button>
              </div>
            </div>
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
