import { useRef, useEffect, useMemo } from "react";
import "./styles/global.css";
import {
  Header,
  ScannerOverlay,
  SettingsModal,
  PlayerBar,
  RescanPrompt,
  AppErrorBanner,
  AppMainPane,
  AppModals,
  type PlayerBarHandle,
  type MidiListHandle,
} from "./components";
import type { SampleListHandle } from "./components/SampleList/types";
import { useSampleState } from "./hooks/useSampleState";
import { useMidiState } from "./hooks/useMidiState";
import { useScanState } from "./hooks/useScanState";
import { useUIState } from "./hooks/useUIState";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useLibraryMigration } from "./hooks/useLibraryMigration";
import { useSettingsStore } from "./store/useSettingsStore";
import { useFavoritesStore } from "./store/useFavoritesStore";
import { useMidiFavoritesStore } from "./store/useMidiFavoritesStore";
import { useRecentStore } from "./store/useRecentStore";
import { useDisplayedSamples } from "./hooks/useDisplayedSamples";
import { useProjectSyncState } from "./hooks/useProjectSyncState";
import { useSampleProcessingState } from "./hooks/useSampleProcessingState";
import type { FilterState, Sample } from "./types/sample";
import type { Midi } from "./types/midi";

const defaultFilters: FilterState = {
  search: "",
  filterType: "all",
  filterBpmMin: "",
  filterBpmMax: "",
  filterInstrumentType: "",
  favoritesOnly: false,
  filterKey: "",
  directoryPath: "",
};

export function App() {
  const sampleListRef = useRef<SampleListHandle>(null);
  const midiListRef = useRef<MidiListHandle>(null);
  const playerBarRef = useRef<PlayerBarHandle>(null);
  const scanImportHandlerRef = useRef<((paths: string[]) => Promise<void>) | null>(null);
  const sampleApiRef = useRef<{
    allSamplePaths: string[];
    filters: FilterState;
    runSearch: (query: string) => Promise<Sample[]>;
    fetchAllSamplePaths: () => Promise<void>;
    setSelected: React.Dispatch<React.SetStateAction<Sample | null>>;
  } | null>(null);
  const midiApiRef = useRef<{
    fetchAllMidiPaths: () => Promise<void>;
    setMidis: React.Dispatch<React.SetStateAction<Midi[]>>;
    setLastFetchCountMidi: React.Dispatch<React.SetStateAction<number | null>>;
    directoryPath: string;
    midiTagFilterId: number | null;
  } | null>(null);

  const autoPlayOnSelect = useSettingsStore((s) => s.autoPlayOnSelect);
  const setAutoPlayOnSelect = useSettingsStore((s) => s.setAutoPlayOnSelect);
  const instrumentColorCoding = useSettingsStore((s) => s.instrumentColorCoding);
  const setInstrumentColorCoding = useSettingsStore((s) => s.setInstrumentColorCoding);
  const directoryClickFiltering = useSettingsStore((s) => s.directoryClickFiltering);
  const setDirectoryClickFiltering = useSettingsStore((s) => s.setDirectoryClickFiltering);
  const favorites = useFavoritesStore((s) => s.favorites);
  const midiFavorites = useMidiFavoritesStore((s) => s.favorites);
  const addRecent = useRecentStore((s) => s.addRecent);

  const uiState = useUIState({
    getHandleImportPaths: () => scanImportHandlerRef.current,
  });

  const scanState = useScanState({
    getAllSamplePaths: () => sampleApiRef.current?.allSamplePaths ?? [],
    getFilters: () => sampleApiRef.current?.filters ?? defaultFilters,
    runSearch: (query) => sampleApiRef.current?.runSearch(query) ?? Promise.resolve([]),
    fetchAllSamplePaths: () => sampleApiRef.current?.fetchAllSamplePaths() ?? Promise.resolve(),
    fetchAllMidiPaths: () => midiApiRef.current?.fetchAllMidiPaths() ?? Promise.resolve(),
    getMidiDirectoryPath: () => midiApiRef.current?.directoryPath ?? "",
    getMidiTagFilterId: () => midiApiRef.current?.midiTagFilterId ?? null,
    viewMode: uiState.viewMode,
    pageLimit: uiState.pageLimit,
    setMidis: (value) => {
      midiApiRef.current?.setMidis(value);
    },
    setLastFetchCountMidi: (value) => {
      midiApiRef.current?.setLastFetchCountMidi(value);
    },
    setSelected: (value) => {
      sampleApiRef.current?.setSelected(value);
    },
  });

  const projectSyncState = useProjectSyncState();

  const midiState = useMidiState({
    setError: scanState.setError,
    pageLimit: uiState.pageLimit,
    midiListRef,
    viewMode: uiState.viewMode,
    autoPlayOnSelect,
    getPreviewOptions: (midi) => projectSyncState.getMidiPreviewOptions(midi),
  });

  const sampleState = useSampleState({
    setError: scanState.setError,
    sampleListRef,
    midiListRef,
    playerBarRef,
    pageLimit: uiState.pageLimit,
    setMidis: midiState.setMidis,
    setSelectedMidi: midiState.setSelectedMidi,
    fetchAllMidiPaths: midiState.fetchAllMidiPaths,
  });

  const libraryMigration = useLibraryMigration({
    setError: scanState.setError,
    refreshAfterImport: async () => {
      sampleState.setSelected(null);
      midiState.setSelectedMidi(null);
      await sampleState.handleSearch(sampleState.filters.search);
      await sampleState.fetchAllSamplePaths();
      await midiState.runMidiSearch(midiState.midiSearch);
      await midiState.fetchAllMidiPaths();
    },
  });

  useEffect(() => {
    if (sampleState.filters.favoritesOnly && favorites.length === 0) {
      sampleState.handleFilterChange({ favoritesOnly: false });
    }
  }, [favorites, sampleState.filters.favoritesOnly]);

  useEffect(() => {
    if (midiState.favoritesOnly && midiFavorites.length === 0) {
      midiState.setFavoritesOnly(false);
    }
  }, [midiFavorites, midiState.favoritesOnly]);

  useEffect(() => {
    if (!directoryClickFiltering) {
      if (sampleState.filters.directoryPath) {
        sampleState.handleFilterChange({ directoryPath: "" });
      }
      if (midiState.directoryPath) {
        midiState.setDirectoryPath("");
      }
    }
  }, [
    directoryClickFiltering,
    sampleState.filters.directoryPath,
    midiState.directoryPath,
    sampleState.handleFilterChange,
    midiState.setDirectoryPath,
  ]);

  const displayedSamples = useDisplayedSamples(
    sampleState.samples,
    sampleState.filters,
    favorites
  );

  const filteredMidis = useMemo(() => {
    if (!midiState.favoritesOnly) return midiState.midis;
    const favSet = new Set(midiFavorites);
    return midiState.midis.filter(m => favSet.has(m.id));
  }, [midiState.midis, midiState.favoritesOnly, midiFavorites]);

  const selectedSamplePath = sampleState.selected ? sampleState.samplePaths[sampleState.selected.id] : undefined;
  const sampleProcessingState = useSampleProcessingState(sampleState.selected, selectedSamplePath);

  useKeyboardShortcuts({
    viewMode: uiState.viewMode,
    sampleState: { selected: sampleState.selected },
    midiState: { selectedMidi: midiState.selectedMidi, togglePlaySelectedMidi: midiState.togglePlaySelectedMidi },
    playerBarRef,
  });

  sampleApiRef.current = {
    allSamplePaths: sampleState.allSamplePaths,
    filters: sampleState.filters,
    runSearch: sampleState.runSearch,
    fetchAllSamplePaths: sampleState.fetchAllSamplePaths,
    setSelected: sampleState.setSelected,
  };
  midiApiRef.current = {
    fetchAllMidiPaths: midiState.fetchAllMidiPaths,
    setMidis: midiState.setMidis,
    setLastFetchCountMidi: midiState.setLastFetchCountMidi,
    directoryPath: midiState.directoryPath,
    midiTagFilterId: midiState.midiTagFilterId,
  };
  scanImportHandlerRef.current = scanState.handleImportPaths;

  const handleSampleSelectWithRecent = async (sample: Sample, isShift?: boolean, rangeIds?: Set<number>) => {
    addRecent(sample.id);
    await sampleState.handleSampleSelect(sample, isShift, rangeIds);
  };

  return (
    <div
      style={{
        background: "#080a0f",
        height: "100vh",
        fontFamily: "'Courier New', monospace",
        color: "#e2e8f0",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        minWidth: 0,
      }}
    >
      <Header
        sampleCount={sampleState.samples.length}
        scanned={scanState.scanned}
        isDragOver={uiState.isDragOver}
        viewMode={uiState.viewMode}
        onViewModeChange={(mode) => {
          void uiState.handleViewModeChange(mode, {
            isMidiPlaying: midiState.isMidiPlaying,
            setIsMidiPlaying: midiState.setIsMidiPlaying,
            playerBarRef,
            setSelected: sampleState.setSelected,
            setMidiSearch: midiState.setMidiSearch,
          });
        }}
        onScanClick={() => {
          void scanState.handleScanClick();
        }}
        onReScanClick={() => {
          void scanState.handleReScanClick();
        }}
        onSettingsClick={() => uiState.setSettingsOpen(true)}
        onReload={() => {
          void sampleState.handleSearch(sampleState.filters.search);
        }}
        projectSync={projectSyncState}
      />

      <RescanPrompt
        isOpen={scanState.rescanPromptOpen}
        path={scanState.rescanPendingPath}
        isIncremental={true}
        onRescan={async () => {
          if (!scanState.rescanPendingPath) return;
          scanState.setRescanPromptOpen(false);
          await scanState.performScan(scanState.rescanPendingPath);
          scanState.setRescanPendingPath(null);
        }}
        onSkip={() => {
          scanState.setRescanPendingPath(null);
          scanState.setRescanPromptOpen(false);
        }}
      />

      <AppErrorBanner
        error={scanState.error}
        onRetry={() => {
          void sampleState.handleRetry();
        }}
      />

      {scanState.scanning && <ScannerOverlay progress={scanState.scanProgress} onDone={() => {}} />}

      <AppMainPane
        uiState={uiState}
        scanState={scanState}
        sampleState={sampleState}
        midiState={midiState}
        playerBarRef={playerBarRef}
        sampleListRef={sampleListRef}
        midiListRef={midiListRef}
        displayedSamples={displayedSamples}
        filteredMidis={filteredMidis}
        instrumentColorCoding={instrumentColorCoding}
        directoryClickFiltering={directoryClickFiltering}
        handleSampleSelectWithRecent={handleSampleSelectWithRecent}
        getSampleProcessingSettings={sampleProcessingState.getSettingsForSample}
      />

      {sampleState.selected && (
        <PlayerBar
          ref={playerBarRef}
          sample={sampleState.selected}
          path={selectedSamplePath}
          autoPlay={autoPlayOnSelect}
          playbackRate={projectSyncState.getSamplePlaybackRate(sampleState.selected)}
          syncPitchShift={projectSyncState.getSamplePitchShift(sampleState.selected)}
          processingSettings={sampleProcessingState.selectedSettings}
          onProcessingSettingsChange={sampleProcessingState.updateSelectedSettings}
          onProcessingSettingsReset={sampleProcessingState.resetSelectedSettings}
          onProcessingSettingsClear={sampleProcessingState.clearSelectedSettings}
          onClose={() => {
            playerBarRef.current?.stop();
            sampleState.setSelected(null);
          }}
        />
      )}

      <SettingsModal
        isOpen={uiState.settingsOpen}
        onClose={() => uiState.setSettingsOpen(false)}
        sampleCount={sampleState.samples.length}
        autoPlayOnSelect={autoPlayOnSelect}
        onAutoPlayChange={setAutoPlayOnSelect}
        instrumentColorCoding={instrumentColorCoding}
        onInstrumentColorCodingChange={setInstrumentColorCoding}
        directoryClickFiltering={directoryClickFiltering}
        onDirectoryClickFilteringChange={setDirectoryClickFiltering}
        onDatabaseExport={() => {
          void libraryMigration.handleExportDatabase();
        }}
        onDatabaseImport={() => {
          void libraryMigration.handleImportDatabase();
        }}
        databaseMigrationBusy={libraryMigration.migrationBusy}
        databaseMigrationStatus={libraryMigration.migrationStatus}
      />

      <AppModals sampleState={sampleState} midiState={midiState} />
    </div>
  );
}
