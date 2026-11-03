import { translate } from "../../i18n";
import { useTranslation } from "react-i18next";
import { SettingsSection } from "./SettingsSection";

export function AboutSettingsSection() {
  useTranslation();
  return (
    <SettingsSection title={translate("about")}>
      <div
        style={{
          padding: "12px",
          background: "#080a0f",
          borderRadius: "2px",
          fontSize: "13px",
          color: "var(--osm-secondary)",
        }}
      >
        <div style={{ marginBottom: "8px" }}>
          <span style={{ color: "var(--osm-secondary)" }}>{translate("version")}</span> 0.1.0-alpha
        </div>
        <div style={{ marginBottom: "8px" }}>
          <span style={{ color: "var(--osm-secondary)" }}>{translate("databaseLabel")}</span> SQLite (WAL mode)
        </div>
        <div>
          <span style={{ color: "var(--osm-secondary)" }}>{translate("searchLabel")}</span> FTS5 Full-Text
        </div>
      </div>
    </SettingsSection>
  );
}
