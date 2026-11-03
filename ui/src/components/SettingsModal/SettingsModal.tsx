import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import type { ProviderBrowserMode } from "../../types/provider";
import type { FreesoundWorkspace } from "../../hooks/useFreesoundWorkspace";
import { AboutSettingsSection } from "./AboutSettingsSection";
import { DatabaseSettingsSection } from "./DatabaseSettingsSection";
import { DisplaySettingsSection } from "./DisplaySettingsSection";
import { NavigationSettingsSection } from "./NavigationSettingsSection";
import { PlaybackSettingsSection } from "./PlaybackSettingsSection";
import { ProviderSettingsSection } from "./ProviderSettingsSection";

const categories = ["Playback", "Display", "Downloads", "Database", "About"] as const;
type SettingsCategory = typeof categories[number];

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
  readonly freesoundWorkspace: FreesoundWorkspace;
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
  freesoundWorkspace,
  onDatabaseExport,
  onDatabaseImport,
  databaseMigrationBusy,
  databaseMigrationStatus,
}: Omit<SettingsModalProps, "onClearAllSamples">) {
  const [category, setCategory] = useState<SettingsCategory>("Playback");
  const contentRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setCategory("Playback");
    previouslyFocusedRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.querySelector<HTMLButtonElement>("[data-settings-close]")?.focus();
    return () => previouslyFocusedRef.current?.focus();
  }, [isOpen]);

  const handleDialogKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>("button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex='-1'])") ?? []);
    const first = focusable[0];
    const last = focusable.at(-1);
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  useEffect(() => { contentRef.current?.scrollTo?.(0, 0); }, [category]);

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
        className="settings-dialog"
        style={{
          background: "#0f1117",
          border: "1px solid var(--osm-border)",
          borderRadius: "4px",
          padding: "24px",
          width: "min(820px, 100%)",
          maxWidth: "820px",
          height: "min(680px, calc(100vh - 48px))",
          maxHeight: "calc(100vh - 48px)",
          overflow: "hidden",
          boxSizing: "border-box",
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-modal-title"
        ref={dialogRef}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={handleDialogKeyDown}
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
          <h2 id="settings-modal-title" style={{ fontSize: "18px", fontWeight: 700, letterSpacing: "0.1em", color: "#f1f5f9", margin: 0 }}>
            SETTINGS
          </h2>
          <button
            onClick={onClose}
            data-settings-close
            aria-label="Close settings"
            style={{ background: "transparent", border: "none", color: "var(--osm-secondary)", cursor: "pointer", fontSize: "20px", padding: "4px 8px" }}
          >
            ✕
          </button>
        </div>
        <div className="settings-layout">
          <nav className="settings-categories" aria-label="Settings categories">
            {categories.map((name) => <button key={name} type="button" aria-current={category === name ? "page" : undefined} onClick={() => setCategory(name)}>{name}</button>)}
          </nav>
          <section className="settings-content" ref={contentRef} aria-label={`${category} settings`}>
            {category === "Playback" && <PlaybackSettingsSection autoPlayOnSelect={autoPlayOnSelect} onAutoPlayChange={onAutoPlayChange} />}
            {category === "Display" && <><DisplaySettingsSection
              instrumentColorCoding={instrumentColorCoding}
              onInstrumentColorCodingChange={onInstrumentColorCodingChange}
              showSampleMetadataQuality={showSampleMetadataQuality}
              onShowSampleMetadataQualityChange={onShowSampleMetadataQualityChange}
            />
            <NavigationSettingsSection
              directoryClickFiltering={directoryClickFiltering}
              onDirectoryClickFilteringChange={onDirectoryClickFilteringChange}
            /></>}
            {category === "Downloads" && <ProviderSettingsSection
              providerDownloadRoot={providerDownloadRoot}
              onSelectProviderDownloadRoot={onSelectProviderDownloadRoot}
              onClearProviderDownloadRoot={onClearProviderDownloadRoot}
              providerBrowserMode={providerBrowserMode}
              onProviderBrowserModeChange={onProviderBrowserModeChange}
              freesoundWorkspace={freesoundWorkspace}
            />}
            {category === "Database" && <DatabaseSettingsSection
              sampleCount={sampleCount}
              onDatabaseExport={onDatabaseExport}
              onDatabaseImport={onDatabaseImport}
              databaseMigrationBusy={databaseMigrationBusy}
              databaseMigrationStatus={databaseMigrationStatus}
            />}
            {category === "About" && <AboutSettingsSection />}
          </section>
        </div>
      </div>
    </div>
  );
}
