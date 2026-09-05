import type { ProviderBrowserMode } from "../../types/provider";
import { AboutSettingsSection } from "./AboutSettingsSection";
import { DatabaseSettingsSection } from "./DatabaseSettingsSection";
import { DisplaySettingsSection } from "./DisplaySettingsSection";
import { NavigationSettingsSection } from "./NavigationSettingsSection";
import { PlaybackSettingsSection } from "./PlaybackSettingsSection";
import { ProviderSettingsSection } from "./ProviderSettingsSection";

interface SettingsModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  readonly onClearAllSamples: () => void;
  readonly onDatabaseExport: () => void;
  readonly onDatabaseImport: () => void;
  readonly databaseMigrationBusy: boolean;
  readonly databaseMigrationStatus: string | null;
  readonly sampleCount: number;
  readonly autoPlayOnSelect: boolean;
  readonly onAutoPlayChange: (enabled: boolean) => void;
  readonly instrumentColorCoding: boolean;
  readonly onInstrumentColorCodingChange: (enabled: boolean) => void;
  readonly directoryClickFiltering: boolean;
  readonly onDirectoryClickFilteringChange: (enabled: boolean) => void;
  readonly showSampleMetadataQuality: boolean;
  readonly onShowSampleMetadataQualityChange: (enabled: boolean) => void;
  readonly providerDownloadRoot: string | null;
  readonly onSelectProviderDownloadRoot: () => void;
  readonly onClearProviderDownloadRoot: () => void;
  readonly providerBrowserMode?: ProviderBrowserMode;
  readonly onProviderBrowserModeChange?: (mode: ProviderBrowserMode) => void;
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
  showSampleMetadataQuality,
  onShowSampleMetadataQualityChange,
  providerDownloadRoot,
  onSelectProviderDownloadRoot,
  onClearProviderDownloadRoot,
  providerBrowserMode = "window",
  onProviderBrowserModeChange = () => {},
  onDatabaseExport,
  onDatabaseImport,
  databaseMigrationBusy,
  databaseMigrationStatus,
}: Omit<SettingsModalProps, "onClearAllSamples">) {
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
        onClick={(event) => event.stopPropagation()}
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
          <h2 style={{ fontSize: "18px", fontWeight: 700, letterSpacing: "0.1em", color: "#f1f5f9", margin: 0 }}>
            SETTINGS
          </h2>
          <button
            onClick={onClose}
            style={{ background: "transparent", border: "none", color: "#6b7280", cursor: "pointer", fontSize: "20px", padding: "4px 8px" }}
          >
            ✕
          </button>
        </div>
        <PlaybackSettingsSection autoPlayOnSelect={autoPlayOnSelect} onAutoPlayChange={onAutoPlayChange} />
        <DisplaySettingsSection
          instrumentColorCoding={instrumentColorCoding}
          onInstrumentColorCodingChange={onInstrumentColorCodingChange}
          showSampleMetadataQuality={showSampleMetadataQuality}
          onShowSampleMetadataQualityChange={onShowSampleMetadataQualityChange}
        />
        <NavigationSettingsSection
          directoryClickFiltering={directoryClickFiltering}
          onDirectoryClickFilteringChange={onDirectoryClickFilteringChange}
        />
        <ProviderSettingsSection
          providerDownloadRoot={providerDownloadRoot}
          onSelectProviderDownloadRoot={onSelectProviderDownloadRoot}
          onClearProviderDownloadRoot={onClearProviderDownloadRoot}
          providerBrowserMode={providerBrowserMode}
          onProviderBrowserModeChange={onProviderBrowserModeChange}
        />
        <DatabaseSettingsSection
          sampleCount={sampleCount}
          onDatabaseExport={onDatabaseExport}
          onDatabaseImport={onDatabaseImport}
          databaseMigrationBusy={databaseMigrationBusy}
          databaseMigrationStatus={databaseMigrationStatus}
        />
        <AboutSettingsSection />
      </div>
    </div>
  );
}
