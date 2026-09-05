import type { ProviderBrowserMode } from "../../types/provider";
import { SettingsSection } from "./SettingsSection";

type ProviderSettingsSectionProps = {
  readonly providerDownloadRoot: string | null;
  readonly onSelectProviderDownloadRoot: () => void;
  readonly onClearProviderDownloadRoot: () => void;
  readonly providerBrowserMode: ProviderBrowserMode;
  readonly onProviderBrowserModeChange: (mode: ProviderBrowserMode) => void;
};

const browserModes = ["window", "embedded"] as const;

export function ProviderSettingsSection({
  providerDownloadRoot,
  onSelectProviderDownloadRoot,
  onClearProviderDownloadRoot,
  providerBrowserMode,
  onProviderBrowserModeChange,
}: ProviderSettingsSectionProps) {
  return (
    <SettingsSection title="PROVIDER DOWNLOADS" hasBottomMargin>
      <div style={{ padding: "12px", background: "#080a0f", borderRadius: "2px" }}>
        <div style={{ fontSize: "14px", color: "#d1d5db" }}>Download folder</div>
        <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "4px", overflowWrap: "anywhere" }}>
          {providerDownloadRoot ?? "App default"}
        </div>
        <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
          <button
            type="button"
            onClick={onSelectProviderDownloadRoot}
            style={{
              fontSize: "12px", letterSpacing: "0.1em", background: "#f97316", color: "#000",
              border: "1px solid #f97316", padding: "8px 12px", borderRadius: "2px", cursor: "pointer",
              fontFamily: "'Courier New', monospace", fontWeight: 700,
            }}
          >
            SELECT FOLDER
          </button>
          <button
            type="button"
            onClick={onClearProviderDownloadRoot}
            disabled={providerDownloadRoot === null}
            style={{
              fontSize: "12px", letterSpacing: "0.1em", background: "transparent",
              color: providerDownloadRoot === null ? "#374151" : "#d1d5db", border: "1px solid #374151",
              padding: "8px 12px", borderRadius: "2px", cursor: providerDownloadRoot === null ? "not-allowed" : "pointer",
              fontFamily: "'Courier New', monospace",
            }}
          >
            USE DEFAULT
          </button>
        </div>
        <div style={{ borderTop: "1px solid #1f2937", marginTop: "12px", paddingTop: "12px" }}>
          <div style={{ fontSize: "14px", color: "#d1d5db" }}>Provider browser display</div>
          <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "4px" }}>
            Open providers in a separate window or place them inside the WEB workspace.
          </div>
          <div role="radiogroup" aria-label="Provider browser display mode" style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
            {browserModes.map((mode) => (
              <button
                key={mode}
                type="button"
                role="radio"
                aria-checked={providerBrowserMode === mode}
                onClick={() => onProviderBrowserModeChange(mode)}
                style={{
                  background: providerBrowserMode === mode ? "#f97316" : "transparent", border: "1px solid #f97316",
                  borderRadius: "2px", color: providerBrowserMode === mode ? "#000" : "#d1d5db", cursor: "pointer",
                  fontFamily: "'Courier New', monospace", fontSize: "12px", fontWeight: 700,
                  letterSpacing: "0.08em", padding: "8px 12px",
                }}
              >
                {mode === "window" ? "SEPARATE WINDOW" : "EMBEDDED"}
              </button>
            ))}
          </div>
        </div>
      </div>
    </SettingsSection>
  );
}
