import { useRef } from "react";
import "./styles/global.css";
import {
  Header,
  FilterSidebar,
  SampleList,
  MidiList,
  DetailPanel,
  ScannerOverlay,
  SettingsModal,
  PlayerBar,
  ClassificationEditModal,
  ConfirmModal,
  InstrumentTypeManagementModal,
  MidiTagManagementModal,
  MidiTagEditModal,
  MidiDetailPanel,
  RescanPrompt,
  type PlayerBarHandle,
  type MidiListHandle,
} from "./components";
import type { SampleListHandle } from "./components/SampleList/SampleList";
import { useSampleState } from "./hooks/useSampleState";
import { useMidiState } from "./hooks/useMidiState";
import { useScanState } from "./hooks/useScanState";
import { useUIState } from "./hooks/useUIState";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useSettingsStore } from "./store/useSettingsStore";
import type { FilterState, Sample } from "./types/sample";
import type { Midi } from "./types/midi";

const defaultFilters: FilterState = {
  search: "",
  filterType: "all",
  filterBpmMin: "",
  filterBpmMax: "",
  filterInstrumentType: "",
};

export function App() {
  const sampleListRef = useRef<SampleListHandle | null>(null);
  const midiListRef = useRef<MidiListHandle | null>(null);
  const playerBarRef = useRef<PlayerBarHandle | null>(null);
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
  } | null>(null);

  const { autoPlayOnSelect, setAutoPlayOnSelect } = useSettingsStore();

  const uiState = useUIState({
    getHandleImportPaths: () => scanImportHandlerRef.current,
  });

  const scanState = useScanState({
    getAllSamplePaths: () => sampleApiRef.current?.allSamplePaths ?? [],
    getFilters: () => sampleApiRef.current?.filters ?? defaultFilters,
    runSearch: (query) => sampleApiRef.current?.runSearch(query) ?? Promise.resolve([]),
    fetchAllSamplePaths: () => sampleApiRef.current?.fetchAllSamplePaths() ?? Promise.resolve(),
    fetchAllMidiPaths: () => midiApiRef.current?.fetchAllMidiPaths() ?? Promise.resolve(),
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

  const midiState = useMidiState({
    setError: scanState.setError,
    pageLimit: uiState.pageLimit,
    midiListRef,
    viewMode: uiState.viewMode,
    autoPlayOnSelect,
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
  };
  scanImportHandlerRef.current = scanState.handleImportPaths;

  const confirmOpen = sampleState.confirmOpen || midiState.confirmOpen;

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
        onSettingsClick={() => uiState.setSettingsOpen(true)}
        onReload={() => {
          void sampleState.handleSearch(sampleState.filters.search);
        }}
      />

      <RescanPrompt
        isOpen={scanState.rescanPromptOpen}
        path={scanState.rescanPendingPath}
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

      {scanState.error && (
        <div
          style={{
            margin: "10px 16px 0",
            padding: "10px 12px",
            border: "1px solid #ef444480",
            background: "#7f1d1d55",
            color: "#fecaca",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <span>{scanState.error}</span>
          <button
            type="button"
            onClick={() => {
              void sampleState.handleRetry();
            }}
            style={{
              background: "#ef4444",
              border: "none",
              borderRadius: "2px",
              color: "#fff",
              fontFamily: "'Courier New', monospace",
              padding: "4px 10px",
              cursor: "pointer",
            }}
          >
            RETRY
          </button>
        </div>
      )}

      {scanState.scanning && <ScannerOverlay progress={scanState.scanProgress} onDone={() => {}} />}

      <div
        style={{
          display: "flex",
          flex: 1,
          overflow: "hidden",
          minWidth: 0,
          height: sampleState.selected ? "calc(100vh - 57px - 160px)" : "calc(100vh - 57px)",
          transition: "height 0.3s ease",
        }}
      >
        <FilterSidebar
          scannedPaths={uiState.viewMode === "midi" ? midiState.midiScannedPaths : sampleState.scannedPaths}
          filePaths={uiState.viewMode === "midi" ? midiState.allMidiPaths : sampleState.allSamplePaths}
          selectedPath={
            uiState.viewMode === "midi"
              ? (midiState.selectedMidi ? midiState.selectedMidi.path : null)
              : (sampleState.selected ? sampleState.samplePaths[sampleState.selected.id] : null)
          }
          onFilterChange={sampleState.handleFilterChange}
          onPathSelect={(path) => {
            if (uiState.viewMode === "midi") {
              void midiState.loadMidiByPath(path);
              return;
            }

            void sampleState.loadSampleByPath(path);
          }}
          onImportPaths={scanState.handleSidebarImport}
          width={uiState.sidebarWidth}
          bottomInset={(uiState.viewMode === "sample" && sampleState.selected) || (uiState.viewMode === "midi" && midiState.selectedMidi) ? 160 : 0}
        />

        <div
          onMouseDown={uiState.handleMouseDown}
          style={{
            width: "4px",
            background: uiState.isResizing ? "#f97316" : "#1f2937",
            cursor: "col-resize",
            transition: "background 0.2s",
            flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            if (!uiState.isResizing) e.currentTarget.style.background = "#374151";
          }}
          onMouseLeave={(e) => {
            if (!uiState.isResizing) e.currentTarget.style.background = "#1f2937";
          }}
        />

        {uiState.viewMode === "sample" ? (
          <SampleList
            ref={sampleListRef}
            samples={sampleState.samples}
            samplePaths={sampleState.samplePaths}
            filters={sampleState.filters}
            sort={sampleState.sort}
            selectedSample={sampleState.selected}
            onSampleSelect={sampleState.handleSampleSelect}
            onFilterChange={sampleState.handleFilterChange}
            onSortChange={sampleState.setSort}
            onDeleteSample={(id) => {
              void sampleState.handleDeleteSample(id);
            }}
            onTrashSample={(id) => {
              sampleState.requestTrash(id);
            }}
            onTypeClick={sampleState.handleTypeClick}
            onImportPaths={scanState.handleImportPaths}
            onLoadMore={sampleState.loadMore}
            isLoadingMore={sampleState.isLoadingMore}
            canLoadMore={sampleState.lastFetchCount === null ? true : sampleState.lastFetchCount === uiState.pageLimit}
            onLoadPrevious={sampleState.loadPrevious}
            isLoadingPrevious={sampleState.isLoadingPrevious}
            canLoadPrevious={sampleState.canLoadPrevious}
            onTogglePlayback={sampleState.togglePlayback}
          />
        ) : (
          <>
            <MidiList
              ref={midiListRef}
              midis={
                midiState.midiTagFilterId
                  ? midiState.midis.filter(
                      (m) =>
                        m.tag_name ===
                        (midiState.midiTags.find((t) => t.id === midiState.midiTagFilterId)?.name ?? ""),
                    )
                  : midiState.midis
              }
              selectedMidi={midiState.selectedMidi}
              onMidiSelect={midiState.handleMidiSelect}
              onTagBadgeClick={(midi) => {
                midiState.setMidiTagEditTarget(midi);
                midiState.setMidiTagEditOpen(true);
              }}
              midiTags={midiState.midiTags}
              onTagFilterChange={(id: number | null) => midiState.setMidiTagFilterId(id)}
              tagFilterId={midiState.midiTagFilterId}
              onTrashMidi={(id) => {
                midiState.requestTrashMidi(id);
              }}
              onLoadMore={midiState.loadMoreMidi}
              isLoadingMore={midiState.isLoadingMoreMidi}
              canLoadMore={
                midiState.lastFetchCountMidi === null ? true : midiState.lastFetchCountMidi === uiState.pageLimit
              }
              onLoadPrevious={midiState.loadPreviousMidi}
              isLoadingPrevious={midiState.isLoadingPreviousMidi}
              canLoadPrevious={midiState.canLoadPreviousMidi}
              onImportPaths={scanState.handleImportPaths}
              externalIsDragOver={uiState.isDragOver}
              midiSearch={midiState.midiSearch}
              onMidiSearchChange={midiState.setMidiSearch}
              onTogglePlayback={() => {
                void midiState.togglePlaySelectedMidi();
              }}
            />

            {midiState.selectedMidi && uiState.viewMode === "midi" && (
              <div style={{ position: "relative", width: "min(260px, 40vw)" }}>
                <MidiDetailPanel
                  midi={midiState.selectedMidi}
                  midiTags={midiState.midiTags}
                  tagFilterId={midiState.midiTagFilterId ?? null}
                  onTagFilterChange={(id: number | null) => midiState.setMidiTagFilterId(id)}
                  onManageTags={() => midiState.setMidiTagModalOpen(true)}
                  bottomInset={160}
                  isPlaying={midiState.isMidiPlaying}
                  onTogglePlay={() => {
                    void midiState.togglePlaySelectedMidi();
                  }}
                  timidityStatus={midiState._timidityStatus}
                />
              </div>
            )}
          </>
        )}

        {sampleState.selected && uiState.viewMode === "sample" && (
          <DetailPanel
            sample={sampleState.selected}
            path={sampleState.samplePaths[sampleState.selected.id]}
            onSelect={(s) => {
              void sampleState.handleSampleSelect(s);
            }}
            samples={sampleState.samples}
            filters={sampleState.filters}
            onFilterChange={sampleState.handleFilterChange}
            onError={(message) => {
              scanState.setError(message);
            }}
            bottomInset={sampleState.selected ? 160 : 0}
          />
        )}
      </div>

      {sampleState.selected && (
        <PlayerBar
          ref={playerBarRef}
          sample={sampleState.selected}
          path={sampleState.samplePaths[sampleState.selected.id]}
          autoPlay={autoPlayOnSelect}
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
      />

      <ConfirmModal
        isOpen={confirmOpen}
        title={
          sampleState.pendingTrashSampleId === -1
            ? "Clear All Data"
            : midiState.pendingTrashMidiId
              ? "Move MIDI to Trash"
              : "Move to Trash"
        }
        message={
          sampleState.pendingTrashSampleId === -1
            ? "Are you sure you want to clear all samples and MIDI files from the library index? This will remove all samples and MIDI files from the application's index (your files on disk will NOT be deleted). This action cannot be undone in the app."
            : midiState.pendingTrashMidiId
              ? `Are you sure you want to move '${midiState.midis.find((m) => m.id === midiState.pendingTrashMidiId)?.file_name ?? "this MIDI file"}' to the Trash?`
              : `Are you sure you want to move '${sampleState.samples.find((s) => s.id === sampleState.pendingTrashSampleId)?.file_name ?? "this file"}' to the Trash?`
        }
        danger={sampleState.pendingTrashSampleId === -1}
        onConfirm={async () => {
          if (midiState.pendingTrashMidiId) {
            await midiState.confirmTrashMidi();
          } else {
            await sampleState.confirmTrash();
          }
        }}
        onCancel={() => {
          if (midiState.pendingTrashMidiId) {
            midiState.setPendingTrashMidiId(null);
            midiState.setConfirmOpen(false);
          } else {
            sampleState.cancelTrash();
          }
        }}
      />

      <ClassificationEditModal
        isOpen={sampleState.classificationModalOpen}
        sample={sampleState.classificationSample}
        editInstrumentType={sampleState.editInstrumentType}
        editSampleType={sampleState.editSampleType}
        instrumentTypes={sampleState.instrumentTypes.map((t) => t.name)}
        onInstrumentTypeChange={sampleState.setEditInstrumentType}
        onSampleTypeChange={sampleState.handleSampleTypeSelect}
        onSave={sampleState.handleClassificationSave}
        onClose={() => sampleState.setClassificationModalOpen(false)}
        onManageClick={() => sampleState.setInstrumentTypeModalOpen(true)}
      />

      <InstrumentTypeManagementModal
        isOpen={sampleState.instrumentTypeModalOpen}
        instrumentTypes={sampleState.instrumentTypes}
        onAdd={sampleState.handleAddInstrumentType}
        onDelete={sampleState.handleDeleteInstrumentType}
        onUpdate={sampleState.handleUpdateInstrumentType}
        onClose={() => sampleState.setInstrumentTypeModalOpen(false)}
      />

      <MidiTagManagementModal
        isOpen={midiState.midiTagModalOpen}
        midiTags={midiState.midiTags}
        onAdd={midiState.handleAddMidiTag}
        onDelete={midiState.handleDeleteMidiTag}
        onUpdate={midiState.handleUpdateMidiTag}
        onClose={() => midiState.setMidiTagModalOpen(false)}
      />

      <MidiTagEditModal
        isOpen={midiState.midiTagEditOpen}
        midi={midiState.midiTagEditTarget}
        midiTags={midiState.midiTags}
        onSave={midiState.handleMidiTagChange}
        onClose={() => midiState.setMidiTagEditOpen(false)}
        onManageClick={() => {
          midiState.setMidiTagEditOpen(false);
          midiState.setMidiTagModalOpen(true);
        }}
      />
    </div>
  );
}
