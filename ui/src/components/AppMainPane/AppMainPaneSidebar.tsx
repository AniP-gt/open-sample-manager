import { FilterSidebar } from "..";
import { useFavoritesStore } from "../../store/useFavoritesStore";
import { useMidiFavoritesStore } from "../../store/useMidiFavoritesStore";
import type { AppMainPaneProps } from "./AppMainPaneTypes";

type AppMainPaneSidebarProps = Pick<
  AppMainPaneProps,
  | "activeCollectionId"
  | "collections"
  | "directoryClickFiltering"
  | "handleSampleSelectWithRecent"
  | "isCollectionView"
  | "midiState"
  | "onClearCollection"
  | "onSelectCollection"
  | "playerBarRef"
  | "sampleState"
  | "scanState"
  | "uiState"
>;

export function AppMainPaneSidebar({
  activeCollectionId,
  collections,
  directoryClickFiltering,
  handleSampleSelectWithRecent,
  isCollectionView,
  midiState,
  onClearCollection,
  onSelectCollection,
  playerBarRef,
  sampleState,
  scanState,
  uiState,
}: AppMainPaneSidebarProps) {
  const { favorites: sampleFavorites } = useFavoritesStore();
  const { favorites: midiFavorites } = useMidiFavoritesStore();
  const duplicateSampleCount = sampleState.samples.filter((sample) => (sample.duplicate_count ?? 1) > 1).length;

  return (
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
          if (midiState.isMidiPlaying) void midiState.togglePlaySelectedMidi();
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
      favoritesOnly={uiState.viewMode === "midi" ? midiState.favoritesOnly : sampleState.filters.favoritesOnly}
      favoritesCount={uiState.viewMode === "midi" ? midiFavorites.length : sampleFavorites.length}
      hideDuplicates={uiState.viewMode === "sample" ? sampleState.filters.hideDuplicates : false}
      duplicateCount={uiState.viewMode === "sample" ? duplicateSampleCount : 0}
      filterKey={uiState.viewMode === "midi" ? midiState.midiFilterKey : sampleState.filters.filterKey}
      samples={sampleState.samples}
      collections={uiState.viewMode === "sample" ? collections : []}
      activeCollectionId={activeCollectionId}
      isCollectionView={uiState.viewMode === "sample" && isCollectionView}
      onSelectCollection={onSelectCollection}
      onClearCollection={onClearCollection}
      onFilterChange={(filters) => {
        if (uiState.viewMode === "midi") {
          if (filters.favoritesOnly !== undefined) midiState.setFavoritesOnly(filters.favoritesOnly);
          if (filters.filterKey !== undefined) midiState.setMidiFilterKey(filters.filterKey);
          return;
        }
        sampleState.handleFilterChange(filters);
      }}
      onSampleSelect={(sample) => {
        void handleSampleSelectWithRecent(sample);
      }}
      activeDirectoryPath={uiState.viewMode === "midi" ? midiState.directoryPath || null : sampleState.filters.directoryPath || null}
      onClearDirectoryPath={() => {
        if (uiState.viewMode === "midi") {
          midiState.setDirectoryPath("");
          return;
        }
        sampleState.handleFilterChange({ directoryPath: "" });
      }}
    />
  );
}
