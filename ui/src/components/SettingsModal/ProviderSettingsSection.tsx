import { translate } from "../../i18n";
import { useTranslation } from "react-i18next";
import type { KeyboardEvent } from "react";
import type { ProviderBrowserMode } from "../../types/provider";
import type { FreesoundWorkspace } from "../../hooks/useFreesoundWorkspace";
import { FreesoundCredentialForm } from "../FreesoundWorkspace/FreesoundCredentialForm";
import { SettingsSection } from "./SettingsSection";

type ProviderSettingsSectionProps = {
  readonly providerDownloadRoot: string | null;
  readonly onSelectProviderDownloadRoot: () => void;
  readonly onClearProviderDownloadRoot: () => void;
  readonly providerBrowserMode: ProviderBrowserMode;
  readonly onProviderBrowserModeChange: (mode: ProviderBrowserMode) => void;
  readonly freesoundWorkspace: FreesoundWorkspace;
};

const browserModes = ["window", "embedded"] as const;

export function ProviderSettingsSection({
  providerDownloadRoot,
  onSelectProviderDownloadRoot,
  onClearProviderDownloadRoot,
  providerBrowserMode,
  onProviderBrowserModeChange,
  freesoundWorkspace,
}: ProviderSettingsSectionProps) {
  useTranslation();
  const handleBrowserModeKeyDown = (event: KeyboardEvent<HTMLButtonElement>, mode: ProviderBrowserMode) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const index = browserModes.indexOf(mode);
    const nextIndex = event.key === "ArrowLeft" ? (index + browserModes.length - 1) % browserModes.length
      : event.key === "ArrowRight" ? (index + 1) % browserModes.length
        : event.key === "Home" ? 0 : browserModes.length - 1;
    const nextMode = browserModes[nextIndex];
    if (!nextMode) return;
    onProviderBrowserModeChange(nextMode);
    event.currentTarget.parentElement?.querySelector<HTMLButtonElement>(`button[value="${nextMode}"]`)?.focus();
  };

  return (
    <SettingsSection title={translate("providerDownloads")} hasBottomMargin>
      <div style={{ padding: "12px", background: "#080a0f", borderRadius: "2px" }}>
        <div style={{ fontSize: "14px", color: "#d1d5db" }}>{translate("downloadFolder")}</div>
        <div style={{ fontSize: "12px", color: "var(--osm-secondary)", marginTop: "4px", overflowWrap: "anywhere" }}>
          {providerDownloadRoot ?? translate("appDefault")}
        </div>
        <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
          <button
            type="button"
            onClick={onSelectProviderDownloadRoot}
            style={{
              fontSize: "12px", letterSpacing: "0.1em", background: "#f97316", color: "#000",
              border: "1px solid #f97316", padding: "8px 12px", borderRadius: "2px", cursor: "pointer",
              fontFamily: "var(--osm-font)", fontWeight: 700,
            }}
          >
            {translate("selectFolder")}
          </button>
          <button
            type="button"
            onClick={onClearProviderDownloadRoot}
            disabled={providerDownloadRoot === null}
            style={{
              fontSize: "12px", letterSpacing: "0.1em", background: "transparent",
              color: providerDownloadRoot === null ? "#374151" : "#d1d5db", border: "1px solid var(--osm-border)",
              padding: "8px 12px", borderRadius: "2px", cursor: providerDownloadRoot === null ? "not-allowed" : "pointer",
              fontFamily: "var(--osm-font)",
            }}
          >
            {translate("useDefault")}
          </button>
        </div>
        <div style={{ borderTop: "1px solid #1f2937", marginTop: "12px", paddingTop: "12px" }}>
          <div style={{ fontSize: "14px", color: "#d1d5db" }}>{translate("providerBrowserDisplay")}</div>
          <div style={{ fontSize: "12px", color: "var(--osm-secondary)", marginTop: "4px" }}>
            {translate("openProvidersInASeparateWindowOrPlaceThem")}
          </div>
          <div role="radiogroup" aria-label={translate("providerBrowserDisplayMode")} style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
            {browserModes.map((mode) => (
              <button
                key={mode}
                type="button"
                role="radio"
                aria-checked={providerBrowserMode === mode}
                onClick={() => onProviderBrowserModeChange(mode)}
                onKeyDown={(event) => handleBrowserModeKeyDown(event, mode)}
                value={mode}
                style={{
                  background: providerBrowserMode === mode ? "#f97316" : "transparent", border: "1px solid #f97316",
                  borderRadius: "2px", color: providerBrowserMode === mode ? "#000" : "#d1d5db", cursor: "pointer",
                  fontFamily: "var(--osm-font)", fontSize: "12px", fontWeight: 700,
                  letterSpacing: "0.08em", padding: "8px 12px",
                }}
              >
                {mode === "window" ? translate("separateWindow") : translate("embedded")}
              </button>
            ))}
          </div>
        </div>
        <div style={{ borderTop: "1px solid #1f2937", marginTop: "12px", paddingTop: "12px" }}>
          <div style={{ color: "#d1d5db", fontSize: "14px", marginBottom: "4px" }}>Freesound API</div>
          <div style={{ color: "var(--osm-secondary)", fontSize: "12px", marginBottom: "12px" }}>{translate("configureReplaceOrRemoveYourPersonalApiKeyThe")}</div>
          <FreesoundCredentialForm credential={freesoundWorkspace.credential} isBusy={freesoundWorkspace.isBusy} onSave={freesoundWorkspace.saveApiKey} onDelete={() => { void freesoundWorkspace.deleteApiKey(); }} onOpenRegistration={freesoundWorkspace.openRegistration} />
          {freesoundWorkspace.error && <div role="alert" style={{ color: "#f97316", fontSize: "11px", marginTop: "8px" }}>{freesoundWorkspace.error}</div>}
        </div>
      </div>
    </SettingsSection>
  );
}
