import { SettingsSection } from "./SettingsSection";

export function AboutSettingsSection() {
  return (
    <SettingsSection title="ABOUT">
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
    </SettingsSection>
  );
}
