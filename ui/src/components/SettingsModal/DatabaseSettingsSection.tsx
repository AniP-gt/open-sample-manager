import { SettingsSection } from "./SettingsSection";

type DatabaseSettingsSectionProps = {
  readonly sampleCount: number;
  readonly onDatabaseExport: () => void;
  readonly onDatabaseImport: () => void;
  readonly databaseMigrationBusy: boolean;
  readonly databaseMigrationStatus: string | null;
};

export function DatabaseSettingsSection({
  sampleCount,
  onDatabaseExport,
  onDatabaseImport,
  databaseMigrationBusy,
  databaseMigrationStatus,
}: DatabaseSettingsSectionProps) {
  return (
    <SettingsSection title="DATABASE" hasBottomMargin>
      <div style={{ padding: "12px", background: "#080a0f", borderRadius: "2px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px" }}>
          <div>
            <div style={{ fontSize: "14px", color: "#d1d5db" }}>Sample Library</div>
            <div style={{ fontSize: "12px", color: "var(--osm-secondary)", marginTop: "4px" }}>
              {sampleCount} samples indexed
            </div>
          </div>
          <button
            onClick={() => window.dispatchEvent(new CustomEvent("confirm-clear-all", { detail: null }))}
            style={{
              fontSize: "12px", letterSpacing: "0.1em", background: "#ef4444", color: "#080a0f",
              border: "1px solid #ef4444", padding: "8px 16px", borderRadius: "2px", cursor: "pointer",
              fontFamily: "var(--osm-font)",
            }}
          >
            CLEAR ALL
          </button>
        </div>
        <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid #1f2937" }}>
          <div style={{ fontSize: "14px", color: "#d1d5db" }}>Library migration</div>
          <div style={{ fontSize: "12px", color: "var(--osm-secondary)", marginTop: "4px" }}>
            Export metadata only. Import by selecting samples.db; audio and MIDI files must exist at the same paths on the target PC.
          </div>
          {databaseMigrationStatus && (
            <div style={{ fontSize: "12px", color: "#f97316", marginTop: "8px" }}>{databaseMigrationStatus}</div>
          )}
          <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
            <button
              onClick={onDatabaseExport}
              disabled={databaseMigrationBusy}
              style={{
                fontSize: "12px", letterSpacing: "0.1em", background: databaseMigrationBusy ? "#374151" : "#111827",
                color: "#f1f5f9", border: "1px solid var(--osm-border)", padding: "8px 12px", borderRadius: "2px",
                cursor: databaseMigrationBusy ? "not-allowed" : "pointer", fontFamily: "var(--osm-font)",
              }}
            >
              EXPORT DB
            </button>
            <button
              onClick={onDatabaseImport}
              disabled={databaseMigrationBusy}
              style={{
                fontSize: "12px", letterSpacing: "0.1em", background: databaseMigrationBusy ? "#374151" : "#f97316",
                color: databaseMigrationBusy ? "#f1f5f9" : "#080a0f", border: databaseMigrationBusy ? "1px solid var(--osm-border)" : "1px solid #f97316",
                padding: "8px 12px", borderRadius: "2px", cursor: databaseMigrationBusy ? "not-allowed" : "pointer",
                fontFamily: "var(--osm-font)",
              }}
            >
              IMPORT DB
            </button>
          </div>
        </div>
      </div>
    </SettingsSection>
  );
}
