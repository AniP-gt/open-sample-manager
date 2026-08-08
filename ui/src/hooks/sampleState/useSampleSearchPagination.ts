import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { FilterState, Sample, SortState } from "../../types/sample";
import type { TauriSampleRow } from "../../types/tauri";
import {
  appendFreshSamples,
  collectDirectoriesFromPaths,
  getAroundOffset,
  mapSampleRowsToPathMap,
  mapSampleRowsToSamples,
  mergeSampleRowsIntoPathMap,
  prependFreshSamples,
} from "./samplePathHelpers";
import type {
  InvokeErrorHandler,
  NullableSampleSetter,
  RetryActionSetter,
} from "./sampleStateTypes";

type UseSampleSearchPaginationParams = {
  pageLimit: number;
  setError: (message: string | null) => void;
  setSelected: NullableSampleSetter;
  setRetryAction: RetryActionSetter;
  onInvokeError: InvokeErrorHandler;
};

const initialFilters: FilterState = {
  search: "",
  filterType: "all",
  filterBpmMin: "",
  filterBpmMax: "",
  filterInstrumentType: "",
  favoritesOnly: false,
  hideDuplicates: false,
  filterKey: "",
  filterLicense: "",
  qualityIssuesOnly: false,
  directoryPath: "",
};

export function useSampleSearchPagination({
  pageLimit,
  setError,
  setSelected,
  setRetryAction,
  onInvokeError,
}: UseSampleSearchPaginationParams) {
  const [samples, setSamples] = useState<Sample[]>([]);
  const [samplePaths, setSamplePaths] = useState<Record<number, string>>({});
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const suppressSearchRef = useRef(false);
  const [sort, setSort] = useState<SortState>({ field: "id", direction: "asc" });
  const [scannedPaths, setScannedPaths] = useState<string[]>([]);
  const [allSamplePaths, setAllSamplePaths] = useState<string[]>([]);
  const [lastFetchCount, setLastFetchCount] = useState<number | null>(null);
  const [currentOffset, setCurrentOffset] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isLoadingPrevious, setIsLoadingPrevious] = useState(false);
  const [canLoadMore, setCanLoadMore] = useState(true);
  const [canLoadPrevious, setCanLoadPrevious] = useState(false);

  const runSearch = useCallback(
    async (query: string, directoryPathOverride?: string | null) => {
      const directoryPath = directoryPathOverride ?? filters.directoryPath ?? "";
      const rows = await invoke<TauriSampleRow[]>("list_samples_paginated", {
        query: query || null,
        limit: pageLimit,
        offset: 0,
        directoryPath: directoryPath || null,
      });
      const nextSamples = mapSampleRowsToSamples(rows);

      setSamplePaths(mapSampleRowsToPathMap(rows));
      setSamples(nextSamples);
      setCurrentOffset(0);
      setLastFetchCount(rows.length);
      setCanLoadMore(rows.length >= pageLimit);
      setCanLoadPrevious(false);
      setSelected((prev) => {
        if (!prev) {
          return null;
        }
        return nextSamples.find((sample) => sample.id === prev.id) ?? null;
      });
      return nextSamples;
    },
    [filters.directoryPath, pageLimit, setSelected],
  );

  const fetchAllSamplePaths = useCallback(async () => {
    try {
      const paths = await invoke<string[]>("list_all_sample_paths");
      setAllSamplePaths(paths);
    } catch (e) {
      console.error("Failed to fetch all sample paths:", e);
    }
  }, []);

  const handleSearch = useCallback(
    async (query: string) => {
      const action = async () => {
        await runSearch(query);
      };
      setRetryAction(() => action);

      try {
        await action();
        setError(null);
      } catch (e) {
        onInvokeError(e);
      }
    },
    [onInvokeError, runSearch, setError, setRetryAction],
  );

  const handleFilterChange = useCallback((newFilters: Partial<FilterState>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  }, []);

  const loadMore = useCallback(async () => {
    if (isLoadingMore || !canLoadMore) return;
    setIsLoadingMore(true);
    try {
      const nextOffset = currentOffset + samples.length;
      const rows = await invoke<TauriSampleRow[]>("list_samples_paginated", {
        query: filters.search || null,
        limit: pageLimit,
        offset: nextOffset,
        directoryPath: filters.directoryPath || null,
      });
      const nextSamples = mapSampleRowsToSamples(rows);
      setSamples((prev) => appendFreshSamples(prev, nextSamples));
      setSamplePaths((prev) => mergeSampleRowsIntoPathMap(prev, rows));
      setLastFetchCount(rows.length);
      setCanLoadMore(rows.length >= pageLimit);
      setCanLoadPrevious(currentOffset > 0);
    } catch (e) {
      onInvokeError(e);
    } finally {
      setIsLoadingMore(false);
    }
  }, [
    canLoadMore,
    currentOffset,
    filters.directoryPath,
    filters.search,
    isLoadingMore,
    onInvokeError,
    pageLimit,
    samples.length,
  ]);

  const loadPrevious = useCallback(async () => {
    if (isLoadingPrevious || !canLoadPrevious || currentOffset === 0) return;
    setIsLoadingPrevious(true);
    try {
      const prevOffset = Math.max(0, currentOffset - pageLimit);
      const rows = await invoke<TauriSampleRow[]>("list_samples_paginated", {
        query: filters.search || null,
        limit: pageLimit,
        offset: prevOffset,
        directoryPath: filters.directoryPath || null,
      });
      const nextSamples = mapSampleRowsToSamples(rows);
      setSamples((prev) => prependFreshSamples(prev, nextSamples));
      setSamplePaths((prev) => mergeSampleRowsIntoPathMap(prev, rows));
      setCurrentOffset(prevOffset);
      setCanLoadPrevious(prevOffset > 0);
      setCanLoadMore(true);
      setLastFetchCount(rows.length);
    } catch (e) {
      onInvokeError(e);
    } finally {
      setIsLoadingPrevious(false);
    }
  }, [
    canLoadPrevious,
    currentOffset,
    filters.directoryPath,
    filters.search,
    isLoadingPrevious,
    onInvokeError,
    pageLimit,
  ]);

  const loadAround = useCallback(
    async (targetIndex: number) => {
      setIsLoadingMore(true);
      setIsLoadingPrevious(true);
      try {
        const rows = await invoke<TauriSampleRow[]>("list_samples_around_id", {
          targetId: targetIndex,
          limit: pageLimit,
        });
        const nextSamples = mapSampleRowsToSamples(rows);
        const aroundOffset = getAroundOffset(targetIndex, pageLimit);
        setSamples(nextSamples);
        setSamplePaths(mapSampleRowsToPathMap(rows));
        setCurrentOffset(aroundOffset);
        setLastFetchCount(rows.length);
        setCanLoadMore(rows.length >= pageLimit);
        setCanLoadPrevious(aroundOffset > 0);
      } catch (e) {
        onInvokeError(e);
      } finally {
        setIsLoadingMore(false);
        setIsLoadingPrevious(false);
      }
    },
    [onInvokeError, pageLimit],
  );

  useEffect(() => {
    void fetchAllSamplePaths();
  }, [fetchAllSamplePaths]);

  useEffect(() => {
    setScannedPaths(collectDirectoriesFromPaths(allSamplePaths));
  }, [allSamplePaths]);

  useEffect(() => {
    if (suppressSearchRef.current) {
      suppressSearchRef.current = false;
      return;
    }
    void handleSearch(filters.search);
  }, [filters.directoryPath, handleSearch]);

  const suppressNextSearch = useCallback(() => {
    suppressSearchRef.current = true;
  }, []);

  return {
    samples,
    setSamples,
    samplePaths,
    setSamplePaths,
    filters,
    setFilters,
    suppressNextSearch,
    sort,
    setSort,
    scannedPaths,
    setScannedPaths,
    allSamplePaths,
    setAllSamplePaths,
    lastFetchCount,
    setLastFetchCount,
    currentOffset,
    setCurrentOffset,
    isLoadingMore,
    isLoadingPrevious,
    canLoadMore,
    setCanLoadMore,
    canLoadPrevious,
    setCanLoadPrevious,
    runSearch,
    fetchAllSamplePaths,
    handleSearch,
    handleFilterChange,
    loadMore,
    loadPrevious,
    loadAround,
  };
}
