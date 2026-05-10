import React from "react";
import { FilterSidebar, SampleList, MidiList, DetailPanel, MidiDetailPanel } from "..";
import type { Sample } from "../../types/sample";
import type { Midi } from "../../types/midi";
import type { SampleListHandle } from "../SampleList/types";
import type { MidiListHandle, PlayerBarHandle } from "..";

import type { useUIState } from "../../hooks/useUIState";
import type { useScanState } from "../../hooks/useScanState";
import type { useSampleState } from "../../hooks/useSampleState";
import type { useMidiState } from "../../hooks/useMidiState";

interface AppMainPaneProps {
  uiState: ReturnType<typeof useUIState>;
  scanState: ReturnType<typeof useScanState>;
  sampleState: ReturnType<typeof useSampleState>;
  midiState: ReturnType<typeof useMidiState>;
  playerBarRef: React.RefObject<PlayerBarHandle>;
  sampleListRef: React.RefObject<SampleListHandle>;
  midiListRef: React.RefObject<MidiListHandle>;
  displayedSamples: Sample[];
  filteredMidis: Midi[];
  instrumentColorCoding: boolean;
  directoryClickFiltering: boolean;
  handleSampleSelectWithRecent: (sample: Sample, isShift?: boolean, rangeIds?: Set<number>) => Promise<void>;
}

export function AppMainPane({
  uiState,
  scanState,
  sampleState,
  midiState,
  playerBarRef,
  sampleListRef,
  midiListRef,
  displayedSamples,
  filteredMidis,
  instrumentColorCoding,
  directoryClickFiltering,
  handleSampleSelectWithRecent,
}: AppMainPaneProps) {
  return (
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
            ? midiState.selectedMidi
              ? midiState.selectedMidi.path
              : midiState.directoryPath || null
            : sampleState.selected
              ? sampleState.samplePaths[sampleState.selected.id]
              : sampleState.filters.directoryPath || null
        }
        onFilterChange={sampleState.handleFilterChange}
        onPathSelect={(path) => {
          const normalizedPath = path.replace(/\\/g, "/");
          const filePaths = uiState.viewMode === "midi" ? midiState.allMidiPaths : sampleState.allSamplePaths;
          const isFile = filePaths.some((filePath: string) => filePath.replace(/\\/g, "/") === normalizedPath);

          if (isFile) {
            if (uiState.viewMode === "midi") {
              if (midiState.directoryPath) {
                midiState.suppressNextMidiSearch();
                midiState.setDirectoryPath("");
              }
              void midiState.loadMidiByPath(path, "");
              return;
            }

            if (sampleState.filters.directoryPath) {
              sampleState.suppressNextSearch();
              sampleState.handleFilterChange({ directoryPath: "" });
            }
            void sampleState.loadSampleByPath(path);
            return;
          }

          if (uiState.viewMode === "midi") {
            if (!directoryClickFiltering) return;

            if (midiState.isMidiPlaying) {
              void midiState.togglePlaySelectedMidi();
            }
            midiState.setSelectedMidi(null);
            midiState.setDirectoryPath(midiState.directoryPath === normalizedPath ? "" : normalizedPath);
            return;
          }

          if (!directoryClickFiltering) return;

          playerBarRef.current?.stop();
          sampleState.setSelected(null);
          sampleState.handleFilterChange({
            directoryPath: sampleState.filters.directoryPath === normalizedPath ? "" : normalizedPath,
          });
        }}
        onImportPaths={scanState.handleSidebarImport}
        width={uiState.sidebarWidth}
        bottomInset={
          (uiState.viewMode === "sample" && sampleState.selected) ||
          (uiState.viewMode === "midi" && midiState.selectedMidi)
            ? 160
            : 0
        }
        favoritesOnly={sampleState.filters.favoritesOnly}
        filterKey={sampleState.filters.filterKey}
        samples={sampleState.samples}
        onSampleSelect={(s) => {
          void handleSampleSelectWithRecent(s);
        }}
        activeDirectoryPath={
          uiState.viewMode === "midi"
            ? midiState.directoryPath || null
            : sampleState.filters.directoryPath || null
        }
        onClearDirectoryPath={() => {
          if (uiState.viewMode === "midi") {
            midiState.setDirectoryPath("");
          } else {
            sampleState.handleFilterChange({ directoryPath: "" });
          }
        }}
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
          samples={displayedSamples}
          samplePaths={sampleState.samplePaths}
          filters={sampleState.filters}
          sort={sampleState.sort}
          selectedSample={sampleState.selected}
          onSampleSelect={handleSampleSelectWithRecent}
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
          canLoadMore={
            sampleState.lastFetchCount === null ? true : sampleState.lastFetchCount === uiState.pageLimit
          }
          onLoadPrevious={sampleState.loadPrevious}
          isLoadingPrevious={sampleState.isLoadingPrevious}
          canLoadPrevious={sampleState.canLoadPrevious}
          onTogglePlayback={sampleState.togglePlayback}
          instrumentColorCoding={instrumentColorCoding}
        />
      ) : (
        <>
          <MidiList
            ref={midiListRef}
            midis={filteredMidis}
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
            filterKey={sampleState.filters.filterKey}
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
            void handleSampleSelectWithRecent(s);
          }}
          samples={displayedSamples}
          filters={sampleState.filters}
          onFilterChange={sampleState.handleFilterChange}
          allInstrumentTypeNames={
            sampleState.instrumentTypes.map((t) => t.name) as import("../../types/sample").InstrumentType[]
          }
          onError={(message) => {
            scanState.setError(message);
          }}
          bottomInset={sampleState.selected ? 160 : 0}
        />
      )}
    </div>
  );
}
