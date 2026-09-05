import { SampleList, MidiList, DetailPanel, MidiDetailPanel } from "..";
import type { Sample } from "../../types/sample";
import { AppMainPaneSidebar } from "./AppMainPaneSidebar";
import { AppMainPaneResizeHandle } from "./AppMainPaneResizeHandle";
import type { AppMainPaneProps } from "./AppMainPaneTypes";

export type { AppMainPaneProps } from "./AppMainPaneTypes";

export function AppMainPane({
  uiState,
  scanState,
  sampleState,
  midiState,
  playerBarRef,
  sampleListRef,
  midiListRef,
  displayedSamples,
  samplePaths,
  collections,
  activeCollectionId,
  isCollectionView,
  onSelectCollection,
  onClearCollection,
  filteredMidis,
  instrumentColorCoding,
  directoryClickFiltering,
  showSampleMetadataQuality,
  handleSampleSelectWithRecent,
  getSampleProcessingSettings,
  providerBrowser = null,
}: AppMainPaneProps) {
  const instrumentTypeOptions = sampleState.instrumentTypes.map((type) => type.name) as Sample["instrument_type"][];

  if (uiState.viewMode === "web") {
    return <main style={{ display: "flex", flex: 1, minHeight: 0, minWidth: 0, overflow: "hidden" }}>{providerBrowser}</main>;
  }
  
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
      <AppMainPaneSidebar
        activeCollectionId={activeCollectionId}
        collections={collections}
        directoryClickFiltering={directoryClickFiltering}
        handleSampleSelectWithRecent={handleSampleSelectWithRecent}
        isCollectionView={isCollectionView}
        midiState={midiState}
        onClearCollection={onClearCollection}
        onSelectCollection={onSelectCollection}
        playerBarRef={playerBarRef}
        sampleState={sampleState}
        scanState={scanState}
        uiState={uiState}
      />

      <AppMainPaneResizeHandle isResizing={uiState.isResizing} onMouseDown={uiState.handleMouseDown} />

      {uiState.viewMode === "sample" ? (
        <SampleList
          ref={sampleListRef}
          samples={displayedSamples}
          instrumentTypeOptions={instrumentTypeOptions}
          samplePaths={samplePaths}
          filters={sampleState.filters}
          sort={sampleState.sort}
          selectedSample={sampleState.selected}
          selectedIds={sampleState.selectedIds}
          onSampleSelect={handleSampleSelectWithRecent}
          onFilterChange={sampleState.handleFilterChange}
          onSearchSubmit={(query) => {
            sampleState.handleFilterChange({ search: query });
            void sampleState.handleSearch(query);
          }}
          onSortChange={sampleState.setSort}
          onDeleteSample={(id) => {
            void sampleState.handleDeleteSample(id);
          }}
          onTrashSample={(id) => {
            sampleState.requestTrash(id);
          }}
          onTypeClick={sampleState.handleTypeClick}
          onMetadataClick={showSampleMetadataQuality ? sampleState.handleMetadataClick : undefined}
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
          showSampleMetadataQuality={showSampleMetadataQuality}
          getSampleProcessingSettings={getSampleProcessingSettings}
          preserveOrder={sampleState.externalResults !== null || isCollectionView}
          onRestoreSearchResults={sampleState.externalResults ? sampleState.restoreSearchResults : undefined}
        />
      ) : (
        <>
          <MidiList
            ref={midiListRef}
            midis={filteredMidis}
            selectedMidi={midiState.selectedMidi}
            selectedMidiIds={midiState.selectedMidiIds}
            onMidiSelect={midiState.handleMidiSelect}
            onTagBadgeClick={(midi) => {
              midiState.setMidiTagEditTarget(midi);
              if (midiState.selectedMidiIds.has(midi.id)) {
                midiState.setMidiTagEditTargetIds(Array.from(midiState.selectedMidiIds));
              } else {
                midiState.setMidiTagEditTargetIds([midi.id]);
              }
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
            appliedMidiSearch={midiState.debouncedMidiSearch}
            onMidiSearchSubmit={() => {
              void midiState.submitMidiSearch();
            }}
            tempoMin={midiState.midiTempoMin}
            onTempoMinChange={midiState.setMidiTempoMin}
            tempoMax={midiState.midiTempoMax}
            onTempoMaxChange={midiState.setMidiTempoMax}
            onTogglePlayback={() => {
              void midiState.togglePlaySelectedMidi();
            }}
            filterKey={midiState.midiFilterKey}
            onFilterKeyChange={midiState.setMidiFilterKey}
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
                onClose={() => {
                  midiState.setSelectedMidi(null);
                  if (midiState.isMidiPlaying) {
                    void midiState.togglePlaySelectedMidi();
                  }
                }}
              />
            </div>
          )}
        </>
      )}

      {sampleState.selected && uiState.viewMode === "sample" && (
        <DetailPanel
          sample={sampleState.selected}
          path={samplePaths[sampleState.selected.id]}
          onSelect={(s) => {
            void handleSampleSelectWithRecent(s);
          }}
          samples={displayedSamples}
          filters={sampleState.filters}
          onFilterChange={sampleState.handleFilterChange}
          allInstrumentTypeNames={
            instrumentTypeOptions
          }
          onError={(message) => {
            scanState.setError(message);
          }}
          bottomInset={sampleState.selected ? 160 : 0}
          onClose={() => {
            sampleState.setSelected(null);
            playerBarRef.current?.stop();
          }}
        />
      )}
    </div>
  );
}
