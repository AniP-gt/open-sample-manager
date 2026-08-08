import { invoke } from "@tauri-apps/api/core";
import { useCallback, useEffect, useRef, useState } from "react";
import type { FilterState, SavedSearch, SortState } from "../types/sample";
import type { Collection } from "../types/collection";
import type { TauriSampleRow } from "../types/tauri";
import { mapRowToSample } from "../utils/sampleMapper";
import { parseCollection, parseIpcList, parseSavedSearch, parseTauriSampleRow } from "./collectionIpcParsers";

type UseCollectionsParams = {
  readonly onError?: (message: string) => void;
  readonly filters?: FilterState;
  readonly sort?: SortState;
  readonly setFilters?: (filters: FilterState) => void;
  readonly setSort?: (sort: SortState) => void;
  readonly runSearch?: (query: string, directoryPath?: string) => Promise<unknown>;
};

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

export function useCollections({
  onError,
  filters,
  sort,
  setFilters,
  setSort,
  runSearch,
}: UseCollectionsParams = {}) {
  const [collections, setCollections] = useState<readonly Collection[]>([]);
  const [savedSearches, setSavedSearches] = useState<readonly SavedSearch[]>([]);
  const [activeCollectionId, setActiveCollectionId] = useState<number | null>(null);
  const [activeMembers, setActiveMembers] = useState<readonly TauriSampleRow[]>([]);
  const [isCollectionView, setIsCollectionView] = useState(false);
  const isMountedRef = useRef(true);
  const activeCollectionIdRef = useRef<number | null>(null);
  const collectionRequestVersionRef = useRef(0);
  const savedSearchRequestVersionRef = useRef(0);
  const memberRequestVersionRef = useRef(0);

  const loadMembers = useCallback(async (collectionId: number) => {
    const requestVersion = ++memberRequestVersionRef.current;
    try {
      const rows = await invoke<unknown>("get_collection_members", { collectionId });
      if (!isMountedRef.current || requestVersion !== memberRequestVersionRef.current || collectionId !== activeCollectionIdRef.current) return;
      setActiveMembers(parseIpcList(rows, parseTauriSampleRow));
      return;
    } catch (error) {
      if (!isMountedRef.current || requestVersion !== memberRequestVersionRef.current || collectionId !== activeCollectionIdRef.current) return;
      throw error;
    }
  }, []);

  const refresh = useCallback(async () => {
    const requestVersion = ++collectionRequestVersionRef.current;
    const nextCollections = parseIpcList(await invoke<unknown>("list_collections"), parseCollection);
    if (!isMountedRef.current || requestVersion !== collectionRequestVersionRef.current) return;
    setCollections(nextCollections);
    const currentCollectionId = activeCollectionIdRef.current;
    if (currentCollectionId === null) return;
    if (!nextCollections.some((collection) => collection.id === currentCollectionId)) {
      activeCollectionIdRef.current = null;
      setActiveCollectionId(null);
      setActiveMembers([]);
      return;
    }
    await loadMembers(currentCollectionId);
  }, [loadMembers]);

  const refreshSavedSearches = useCallback(async () => {
    const requestVersion = ++savedSearchRequestVersionRef.current;
    const rows = await invoke<unknown>("list_saved_searches");
    if (isMountedRef.current && requestVersion === savedSearchRequestVersionRef.current) {
      setSavedSearches(parseIpcList(rows, parseSavedSearch));
    }
  }, []);

  const clearCollection = useCallback(() => {
    memberRequestVersionRef.current += 1;
    setIsCollectionView(false);
    activeCollectionIdRef.current = null;
    setActiveCollectionId(null);
    setActiveMembers([]);
  }, []);

  const selectCollection = useCallback(async (collectionId: number) => {
    setIsCollectionView(true);
    activeCollectionIdRef.current = collectionId;
    setActiveCollectionId(collectionId);
    setActiveMembers([]);
    try {
      await loadMembers(collectionId);
    } catch {
      if (!isMountedRef.current || activeCollectionIdRef.current !== collectionId) return;
      clearCollection();
      onError?.("Could not load collection samples.");
    }
  }, [clearCollection, loadMembers, onError]);

  const runMutation = useCallback(async (action: () => Promise<void>, errorMessage: string) => {
    try {
      await action();
    } catch (error) {
      onError?.(errorMessage);
      throw error;
    }
  }, [onError]);

  const createCollection = useCallback((name: string, description: string) => runMutation(async () => {
    await invoke("create_collection", { name, description: description.trim() || null });
    await refresh();
  }, "Could not create collection."), [refresh, runMutation]);

  const updateCollection = useCallback((id: number, name: string, description: string) => runMutation(async () => {
    await invoke("update_collection", { id, name, description: description.trim() || null });
    await refresh();
  }, "Could not update collection."), [refresh, runMutation]);

  const deleteCollection = useCallback((id: number) => runMutation(async () => {
    await invoke("delete_collection", { id });
    await refresh();
  }, "Could not delete collection."), [refresh, runMutation]);

  const addSelectedToCollection = useCallback((collectionId: number, sampleIds: number[]) => runMutation(async () => {
    if (sampleIds.length === 0) return;
    await invoke("add_samples_to_collection", { collectionId, sampleIds });
    await refresh();
  }, "Could not add samples to collection."), [refresh, runMutation]);

  const removeSelectedFromCollection = useCallback((collectionId: number, sampleIds: number[]) => runMutation(async () => {
    if (sampleIds.length === 0) return;
    await invoke("remove_samples_from_collection", { collectionId, sampleIds });
    await refresh();
  }, "Could not remove samples from collection."), [refresh, runMutation]);

  const createSavedSearch = useCallback((name: string) => runMutation(async () => {
    if (!filters || !sort) return;
    await invoke("create_saved_search", { input: toSavedSearchInput(name, filters, sort) });
    await refreshSavedSearches();
  }, "Could not create saved search."), [filters, refreshSavedSearches, runMutation, sort]);

  const updateSavedSearch = useCallback((id: number, name: string) => runMutation(async () => {
    if (!filters || !sort) return;
    await invoke("update_saved_search", { id, input: toSavedSearchInput(name, filters, sort) });
    await refreshSavedSearches();
  }, "Could not update saved search."), [filters, refreshSavedSearches, runMutation, sort]);

  const deleteSavedSearch = useCallback((id: number) => runMutation(async () => {
    await invoke("delete_saved_search", { id });
    await refreshSavedSearches();
  }, "Could not delete saved search."), [refreshSavedSearches, runMutation]);

  const applySavedSearch = useCallback((savedSearch: SavedSearch) => runMutation(async () => {
    if (!setFilters || !setSort || !runSearch) return;
    clearCollection();
    setFilters({ search: savedSearch.search, filterType: savedSearch.filter_type, filterBpmMin: savedSearch.filter_bpm_min, filterBpmMax: savedSearch.filter_bpm_max, filterInstrumentType: savedSearch.filter_instrument_type, favoritesOnly: savedSearch.favorites_only, filterKey: savedSearch.filter_key, filterLicense: "", qualityIssuesOnly: false, hideDuplicates: false, directoryPath: savedSearch.directory_path });
    setSort({ field: savedSearch.sort_field, direction: savedSearch.sort_direction });
    await runSearch(savedSearch.search, savedSearch.directory_path);
  }, "Could not apply saved search."), [clearCollection, runMutation, runSearch, setFilters, setSort]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => { isMountedRef.current = false; };
  }, []);

  useEffect(() => {
    const collectionRequestVersion = collectionRequestVersionRef.current + 1;
    const savedSearchRequestVersion = savedSearchRequestVersionRef.current + 1;
    void refresh().catch(() => {
      if (isMountedRef.current && collectionRequestVersion === collectionRequestVersionRef.current) onError?.("Could not load collections.");
    });
    void refreshSavedSearches().catch(() => {
      if (isMountedRef.current && savedSearchRequestVersion === savedSearchRequestVersionRef.current) onError?.("Could not load saved searches.");
    });
  }, [onError, refresh, refreshSavedSearches]);

  const samples = activeMembers.map(mapRowToSample);
  const samplePaths = Object.fromEntries(activeMembers.map((row) => [row.id, row.path]));

  return { collections, savedSearches, activeCollectionId, activeMembers: samples, samplePaths, isCollectionView, refresh, refreshSavedSearches, selectCollection, clearCollection, createCollection, updateCollection, deleteCollection, addSelectedToCollection, removeSelectedFromCollection, createSavedSearch, updateSavedSearch, deleteSavedSearch, applySavedSearch };
}
