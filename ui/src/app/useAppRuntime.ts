import { useCallback } from "react";
import type { PlayerBarHandle } from "../components";
import { useCollections } from "../hooks/useCollections";
import { useExternalApiCommands } from "../hooks/useExternalApiCommands";
import { useKeyboardShortcuts } from "../hooks/useKeyboardShortcuts";
import { useLibraryMigration } from "../hooks/useLibraryMigration";
import { useMidiState } from "../hooks/useMidiState";
import { useProviderBrowser } from "../hooks/useProviderBrowser";
import { useProviderDownloadRoot } from "../hooks/useProviderDownloadRoot";
import { useSampleState } from "../hooks/useSampleState";
import { useScanState } from "../hooks/useScanState";
import { useUIState } from "../hooks/useUIState";
import { useFavoritesStore } from "../store/useFavoritesStore";
import { useMidiFavoritesStore } from "../store/useMidiFavoritesStore";
import { useRecentStore } from "../store/useRecentStore";
import { useSettingsStore } from "../store/useSettingsStore";
import type { FilterState, Sample } from "../types/sample";
import { useAppDerivedState } from "./useAppDerivedState";
import { useAppEffects } from "./useAppEffects";
import { useAppRefs } from "./useAppRefs";

const defaultFilters: FilterState = {
  search: "", filterType: "all", filterBpmMin: "", filterBpmMax: "", filterInstrumentType: "",
  favoritesOnly: false, hideDuplicates: false, filterKey: "", filterLicense: "", qualityIssuesOnly: false, directoryPath: "",
};

export function useAppRuntime() {
  const refs = useAppRefs();
  const { setPlayerBar } = refs;
  const autoPlayOnSelect = useSettingsStore((state) => state.autoPlayOnSelect);
  const setAutoPlayOnSelect = useSettingsStore((state) => state.setAutoPlayOnSelect);
  const instrumentColorCoding = useSettingsStore((state) => state.instrumentColorCoding);
  const setInstrumentColorCoding = useSettingsStore((state) => state.setInstrumentColorCoding);
  const directoryClickFiltering = useSettingsStore((state) => state.directoryClickFiltering);
  const setDirectoryClickFiltering = useSettingsStore((state) => state.setDirectoryClickFiltering);
  const showSampleMetadataQuality = useSettingsStore((state) => state.showSampleMetadataQuality);
  const setShowSampleMetadataQuality = useSettingsStore((state) => state.setShowSampleMetadataQuality);
  const providerDownloadRoot = useSettingsStore((state) => state.providerDownloadRoot);
  const setProviderDownloadRoot = useSettingsStore((state) => state.setProviderDownloadRoot);
  const providerBrowserMode = useSettingsStore((state) => state.providerBrowserMode);
  const setProviderBrowserMode = useSettingsStore((state) => state.setProviderBrowserMode);
  const favorites = useFavoritesStore((state) => state.favorites);
  const midiFavorites = useMidiFavoritesStore((state) => state.favorites);
  const addRecent = useRecentStore((state) => state.addRecent);
  const uiState = useUIState({ getHandleImportPaths: () => refs.scanImportHandlerRef.current });
  const scanState = useScanState({
    getAllSamplePaths: () => refs.sampleApiRef.current?.allSamplePaths ?? [],
    getFilters: () => refs.sampleApiRef.current?.filters ?? defaultFilters,
    runSearch: (query) => refs.sampleApiRef.current?.runSearch(query) ?? Promise.resolve([]),
    fetchAllSamplePaths: () => refs.sampleApiRef.current?.fetchAllSamplePaths() ?? Promise.resolve(),
    fetchAllMidiPaths: () => refs.midiApiRef.current?.fetchAllMidiPaths() ?? Promise.resolve(),
    getMidiDirectoryPath: () => refs.midiApiRef.current?.directoryPath ?? "",
    getMidiTagFilterId: () => refs.midiApiRef.current?.midiTagFilterId ?? null,
    viewMode: uiState.viewMode, pageLimit: uiState.pageLimit,
    setMidis: (value) => { refs.midiApiRef.current?.setMidis(value); },
    setLastFetchCountMidi: (value) => { refs.midiApiRef.current?.setLastFetchCountMidi(value); },
    setSelected: (value) => { refs.sampleApiRef.current?.setSelected(value); },
  });
  const providerBrowser = useProviderBrowser({ downloadRoot: providerDownloadRoot, mode: providerBrowserMode, settingsOpen: uiState.settingsOpen, viewMode: uiState.viewMode, performScan: scanState.performScan, setError: scanState.setError });
  const providerDownloadRootPicker = useProviderDownloadRoot({ setProviderDownloadRoot, setError: scanState.setError });
  const midiState = useMidiState({ setError: scanState.setError, pageLimit: uiState.pageLimit, midiListRef: refs.midiListRef, viewMode: uiState.viewMode, autoPlayOnSelect });
  const sampleState = useSampleState({ setError: scanState.setError, sampleListRef: refs.sampleListRef, midiListRef: refs.midiListRef, playerBarRef: refs.playerBarRef, pageLimit: uiState.pageLimit, setMidis: midiState.setMidis, setSelectedMidi: midiState.setSelectedMidi, fetchAllMidiPaths: midiState.fetchAllMidiPaths });
  const collectionState = useCollections({ onError: scanState.setError });
  const externalApiCommands = useExternalApiCommands({ showExternalResults: sampleState.showExternalResults, setViewMode: uiState.setViewMode, setError: scanState.setError, playerBarRef: refs.playerBarRef, selectSample: sampleState.handleSampleSelect, refreshCollections: collectionState.refresh });
  const setPlayerBarRef = useCallback((playerBar: PlayerBarHandle | null) => { setPlayerBar(playerBar); externalApiCommands.onPlayerBarReady(); }, [externalApiCommands.onPlayerBarReady, setPlayerBar]);
  const libraryMigration = useLibraryMigration({ setError: scanState.setError, refreshAfterImport: async () => { sampleState.setSelected(null); midiState.setSelectedMidi(null); await sampleState.handleSearch(sampleState.filters.search); await sampleState.fetchAllSamplePaths(); await midiState.runMidiSearch(midiState.midiSearch); await midiState.fetchAllMidiPaths(); } });
  useAppEffects({ directoryClickFiltering, favorites, midiFavorites, midiState, sampleState, showSampleMetadataQuality });
  const derivedState = useAppDerivedState({ collectionState, favorites, midiFavorites, midiState, sampleState });
  useKeyboardShortcuts({ viewMode: uiState.viewMode, sampleState: { selected: sampleState.selected }, midiState: { selectedMidi: midiState.selectedMidi, togglePlaySelectedMidi: midiState.togglePlaySelectedMidi }, playerBarRef: refs.playerBarRef });
  refs.sampleApiRef.current = { allSamplePaths: sampleState.allSamplePaths, filters: sampleState.filters, runSearch: sampleState.runSearch, fetchAllSamplePaths: sampleState.fetchAllSamplePaths, setSelected: sampleState.setSelected };
  refs.midiApiRef.current = { fetchAllMidiPaths: midiState.fetchAllMidiPaths, setMidis: midiState.setMidis, setLastFetchCountMidi: midiState.setLastFetchCountMidi, directoryPath: midiState.directoryPath, midiTagFilterId: midiState.midiTagFilterId };
  refs.scanImportHandlerRef.current = scanState.handleImportPaths;
  const handleSampleSelectWithRecent = async (sample: Sample, isShift?: boolean, rangeIds?: Set<number>) => { addRecent(sample.id); await sampleState.handleSampleSelect(sample, isShift, rangeIds); };
  const clearActiveProvider = useCallback(async () => { try { await providerBrowser.clearActiveProvider(); } catch { scanState.setError("Provider browser could not be closed."); } }, [providerBrowser.clearActiveProvider, scanState.setError]);
  const handleViewModeChange = useCallback((mode: typeof uiState.viewMode) => { void (async () => { if (mode === "web" && uiState.viewMode === "web" && providerBrowser.activeProvider !== null) { await clearActiveProvider(); return; } if (mode !== "web" && !await providerBrowser.hideEmbeddedBrowserBeforeLeavingWeb()) return; await uiState.handleViewModeChange(mode, { isMidiPlaying: midiState.isMidiPlaying, setIsMidiPlaying: midiState.setIsMidiPlaying, playerBarRef: refs.playerBarRef, setSelected: sampleState.setSelected, setMidiSearch: midiState.setMidiSearch }); })(); }, [clearActiveProvider, midiState.isMidiPlaying, midiState.setIsMidiPlaying, midiState.setMidiSearch, providerBrowser, refs.playerBarRef, sampleState.setSelected, uiState]);
  const showProviderControls = uiState.viewMode === "web" && providerBrowserMode === "embedded" && providerBrowser.activeProvider !== null;
  return { ...refs, autoPlayOnSelect, clearActiveProvider, collectionState, derivedState, directoryClickFiltering, externalApiCommands, handleSampleSelectWithRecent, handleViewModeChange, instrumentColorCoding, libraryMigration, midiState, providerBrowser, providerBrowserMode, providerDownloadRoot, providerDownloadRootPicker, sampleState, scanState, setAutoPlayOnSelect, setInstrumentColorCoding, setDirectoryClickFiltering, setPlayerBarRef, setProviderBrowserMode, setProviderDownloadRoot, setShowSampleMetadataQuality, showProviderControls, showSampleMetadataQuality, uiState };
}
