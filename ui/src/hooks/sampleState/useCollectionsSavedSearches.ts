import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { FilterState, SampleCollection, SavedSearch, SortState } from "../../types/sample";
import type { TauriSampleRow } from "../../types/tauri";
import { mapSampleRowsToPathMap, mapSampleRowsToSamples } from "./samplePathHelpers";
import type { InvokeErrorHandler, NullableSampleSetter, RunSampleSearch, SamplePathMapSetter, SampleStateSetter } from "./sampleStateTypes";

type Params = {
  filters: FilterState;
  sort: SortState;
  setFilters: (filters: FilterState) => void;
  setSort: (sort: SortState) => void;
  setSamples: SampleStateSetter;
  setSamplePaths: SamplePathMapSetter;
  setSelected: NullableSampleSetter;
  runSearch: RunSampleSearch;
  onInvokeError: InvokeErrorHandler;
};

const emptyDescription = (value: string) => value.trim() === "" ? null : value.trim();

export function useCollectionsSavedSearches({
  filters,
  sort,
  setFilters,
  setSort,
  setSamples,
  setSamplePaths,
  setSelected,
  runSearch,
  onInvokeError,
}: Params) {
  const [collections, setCollections] = useState<SampleCollection[]>([]);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [activeCollectionId, setActiveCollectionId] = useState<number | null>(null);

  const refreshCollections = useCallback(async () => {
    const rows = await invoke<SampleCollection[] | null>("list_collections");
    setCollections(Array.isArray(rows) ? rows : []);
  }, []);

  const refreshSavedSearches = useCallback(async () => {
    const rows = await invoke<SavedSearch[] | null>("list_saved_searches");
    setSavedSearches(Array.isArray(rows) ? rows : []);
  }, []);

  const loadCollectionSamples = useCallback(async (collectionId: number) => {
    const rows = await invoke<TauriSampleRow[]>("list_collection_samples", { collectionId });
    setSamples(mapSampleRowsToSamples(rows));
    setSamplePaths(mapSampleRowsToPathMap(rows));
    setSelected(null);
    setActiveCollectionId(collectionId);
  }, [setSamplePaths, setSamples, setSelected]);

  const clearCollectionMode = useCallback(async () => {
    setActiveCollectionId(null);
  }, []);

  const createCollection = useCallback(async (name: string, description: string) => {
    await invoke<SampleCollection>("create_collection", { name, description: emptyDescription(description) });
    await refreshCollections();
  }, [refreshCollections]);

  const updateCollection = useCallback(async (id: number, name: string, description: string) => {
    await invoke<SampleCollection | null>("update_collection", { id, name, description: emptyDescription(description) });
    await refreshCollections();
  }, [refreshCollections]);

  const deleteCollection = useCallback(async (id: number) => {
    await invoke<number>("delete_collection", { id });
    if (activeCollectionId === id) setActiveCollectionId(null);
    await refreshCollections();
  }, [activeCollectionId, refreshCollections]);

  const addSelectedToCollection = useCallback(async (collectionId: number, sampleIds: number[]) => {
    if (sampleIds.length === 0) return;
    await invoke<number>("add_samples_to_collection", { collectionId, sampleIds });
    await refreshCollections();
    if (activeCollectionId === collectionId) await loadCollectionSamples(collectionId);
  }, [activeCollectionId, loadCollectionSamples, refreshCollections]);

  const removeSelectedFromCollection = useCallback(async (collectionId: number, sampleIds: number[]) => {
    if (sampleIds.length === 0) return;
    await invoke<number>("remove_samples_from_collection", { collectionId, sampleIds });
    await refreshCollections();
    if (activeCollectionId === collectionId) await loadCollectionSamples(collectionId);
  }, [activeCollectionId, loadCollectionSamples, refreshCollections]);

  const createSavedSearch = useCallback(async (name: string) => {
    await invoke<SavedSearch>("create_saved_search", { input: toSavedSearchInput(name, filters, sort) });
    await refreshSavedSearches();
  }, [filters, refreshSavedSearches, sort]);

  const updateSavedSearch = useCallback(async (id: number, name: string) => {
    await invoke<SavedSearch | null>("update_saved_search", { id, input: toSavedSearchInput(name, filters, sort) });
    await refreshSavedSearches();
  }, [filters, refreshSavedSearches, sort]);

  const deleteSavedSearch = useCallback(async (id: number) => {
    await invoke<number>("delete_saved_search", { id });
    await refreshSavedSearches();
  }, [refreshSavedSearches]);

  const applySavedSearch = useCallback(async (savedSearch: SavedSearch) => {
    const nextFilters = {
      search: savedSearch.search,
      filterType: savedSearch.filter_type,
      filterBpmMin: savedSearch.filter_bpm_min,
      filterBpmMax: savedSearch.filter_bpm_max,
      filterInstrumentType: savedSearch.filter_instrument_type,
      favoritesOnly: savedSearch.favorites_only,
      filterKey: savedSearch.filter_key,
      filterLicense: "",
      qualityIssuesOnly: false,
      directoryPath: savedSearch.directory_path,
    };
    setActiveCollectionId(null);
    setFilters(nextFilters);
    setSort({ field: savedSearch.sort_field, direction: savedSearch.sort_direction });
    await runSearch(savedSearch.search, savedSearch.directory_path);
  }, [runSearch, setFilters, setSort]);

  useEffect(() => {
    void refreshCollections().catch(onInvokeError);
    void refreshSavedSearches().catch(onInvokeError);
  }, [onInvokeError, refreshCollections, refreshSavedSearches]);

  return {
    collections,
    savedSearches,
    activeCollectionId,
    refreshCollections,
    refreshSavedSearches,
    loadCollectionSamples,
    clearCollectionMode,
    createCollection,
    updateCollection,
    deleteCollection,
    addSelectedToCollection,
    removeSelectedFromCollection,
    createSavedSearch,
    updateSavedSearch,
    deleteSavedSearch,
    applySavedSearch,
  };
}

function toSavedSearchInput(name: string, filters: FilterState, sort: SortState) {
  return {
    name,
    search: filters.search,
    filter_type: filters.filterType,
    filter_bpm_min: filters.filterBpmMin,
    filter_bpm_max: filters.filterBpmMax,
    filter_instrument_type: filters.filterInstrumentType,
    favorites_only: filters.favoritesOnly,
    filter_key: filters.filterKey,
    directory_path: filters.directoryPath ?? "",
    sort_field: sort.field,
    sort_direction: sort.direction,
  };
}
