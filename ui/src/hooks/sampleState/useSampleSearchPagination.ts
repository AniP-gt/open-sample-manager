import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { FilterState, Sample, SortState } from "../../types/sample";
import { useSampleLibraryPaths } from "./useSampleLibraryPaths";
import { getErrorMessage } from "../../utils/sampleMapper";
import { initialFilters, withInstrumentFilter } from "./sampleSearchQuery";
import type { TauriSampleRow } from "../../types/tauri";
import {
  appendFreshSamples,
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
  const { scannedPaths, setScannedPaths, allSamplePaths, setAllSamplePaths, fetchAllSamplePaths } = useSampleLibraryPaths();
  const [lastFetchCount, setLastFetchCount] = useState<number | null>(null);
  const [currentOffset, setCurrentOffset] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isLoadingPrevious, setIsLoadingPrevious] = useState(false);
  const [canLoadMore, setCanLoadMore] = useState(true);
  const [canLoadPrevious, setCanLoadPrevious] = useState(false);

  const [isSearching, setIsSearching] = useState(true);
  const [searchError, setSearchError] = useState<string | null>(null);
  const searchRequestRef = useRef(0);

  const runSearch = useCallback(
    async (query: string) => {
      const requestId = ++searchRequestRef.current;
      setIsSearching(true);
      setSearchError(null);
      try {
        const backendQuery = withInstrumentFilter(query, filters.filterInstrumentType);
        const rows = await invoke<TauriSampleRow[]>("list_samples_paginated", {
          query: backendQuery || null,
          limit: pageLimit,
          offset: 0,
          directoryPath: filters.directoryPath || null,
        });
        const nextSamples = mapSampleRowsToSamples(rows);

        if (requestId !== searchRequestRef.current) return nextSamples;
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
      } catch (error) {
        if (requestId === searchRequestRef.current) setSearchError(getErrorMessage(error));
        throw error;
      } finally {
        if (requestId === searchRequestRef.current) setIsSearching(false);
      }
    },
    [filters.directoryPath, filters.filterInstrumentType, pageLimit, setSelected],
  );

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
      const backendQuery = withInstrumentFilter(filters.search, filters.filterInstrumentType);
      const rows = await invoke<TauriSampleRow[]>("list_samples_paginated", {
        query: backendQuery || null,
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
    filters.filterInstrumentType,
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
      const backendQuery = withInstrumentFilter(filters.search, filters.filterInstrumentType);
      const rows = await invoke<TauriSampleRow[]>("list_samples_paginated", {
        query: backendQuery || null,
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
    filters.filterInstrumentType,
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
    if (suppressSearchRef.current) {
      suppressSearchRef.current = false;
      return;
    }
    void handleSearch(filters.search);
  }, [filters.directoryPath, filters.filterInstrumentType, handleSearch]);

  const suppressNextSearch = useCallback(() => {
    suppressSearchRef.current = true;
  }, []);

  return {
    isSearching,
    searchError,
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
