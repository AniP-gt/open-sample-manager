import { useCallback, useState } from "react";
import { getErrorMessage } from "../utils/sampleMapper";
import { useInstrumentTypes } from "./sampleState/useInstrumentTypes";
import { useSampleClassificationState } from "./sampleState/useSampleClassificationState";
import { useSampleMetadataState } from "./sampleState/useSampleMetadataState";
import { useSamplePathLoading } from "./sampleState/useSamplePathLoading";
import { useSampleSearchPagination } from "./sampleState/useSampleSearchPagination";
import { useSampleSelectionState } from "./sampleState/useSampleSelectionState";
import { useSampleTrash } from "./sampleState/useSampleTrash";
import type { RetryAction, UseSampleStateParams } from "./sampleState/sampleStateTypes";

export function useSampleState({
  setError,
  sampleListRef,
  midiListRef,
  playerBarRef,
  pageLimit,
  setMidis,
  setSelectedMidi,
  fetchAllMidiPaths,
}: UseSampleStateParams) {
  const handleInvokeError = useCallback((e: unknown) => {
    setError(getErrorMessage(e));
  }, [setError]);

  const selection = useSampleSelectionState({ sampleListRef, playerBarRef });
  const instrumentState = useInstrumentTypes({ setError });
  const [retryAction, setRetryAction] = useState<RetryAction | null>(null);

  const searchState = useSampleSearchPagination({
    pageLimit,
    setError,
    setSelected: selection.setSelected,
    setRetryAction,
    onInvokeError: handleInvokeError,
  });

  const connectedTrashState = useSampleTrash({
    samplePaths: searchState.samplePaths,
    selected: selection.selected,
    setSelected: selection.setSelected,
    filters: searchState.filters,
    runSearch: searchState.runSearch,
    fetchAllSamplePaths: searchState.fetchAllSamplePaths,
    setSamples: searchState.setSamples,
    setSamplePaths: searchState.setSamplePaths,
    setScannedPaths: searchState.setScannedPaths,
    setAllSamplePaths: searchState.setAllSamplePaths,
    setMidis,
    setSelectedMidi,
    fetchAllMidiPaths,
    retryAction,
    setError,
    onInvokeError: handleInvokeError,
  });

  const pathLoading = useSamplePathLoading({
    pageLimit,
    sampleListRef,
    midiListRef,
    setMidis,
    setSelectedMidi,
    setSelected: selection.setSelected,
    setSamples: searchState.setSamples,
    setSamplePaths: searchState.setSamplePaths,
    setCurrentOffset: searchState.setCurrentOffset,
    setLastFetchCount: searchState.setLastFetchCount,
    setCanLoadMore: searchState.setCanLoadMore,
    setCanLoadPrevious: searchState.setCanLoadPrevious,
  });

  const metadataState = useSampleMetadataState({
    samplePaths: searchState.samplePaths,
    searchQuery: searchState.filters.search,
    runSearch: searchState.runSearch,
    fetchAllSamplePaths: searchState.fetchAllSamplePaths,
    setSelected: selection.setSelected,
    selectedIds: selection.selectedIds,
    setError,
  });

  const classificationState = useSampleClassificationState({
    samplePaths: searchState.samplePaths,
    instrumentTypes: instrumentState.instrumentTypes,
    searchQuery: searchState.filters.search,
    runSearch: searchState.runSearch,
    fetchAllSamplePaths: searchState.fetchAllSamplePaths,
    setSelected: selection.setSelected,
    selectedIds: selection.selectedIds,
    setError,
  });

  return {
    samples: searchState.samples,
    selected: selection.selected,
    selectedIds: selection.selectedIds,
    setSelected: selection.setSelected,
    samplePaths: searchState.samplePaths,
    filters: searchState.filters,
    setFilters: searchState.setFilters,
    suppressNextSearch: searchState.suppressNextSearch,
    sort: searchState.sort,
    setSort: searchState.setSort,
    scannedPaths: searchState.scannedPaths,
    allSamplePaths: searchState.allSamplePaths,
    lastFetchCount: searchState.lastFetchCount,
    isLoadingMore: searchState.isLoadingMore,
    isLoadingPrevious: searchState.isLoadingPrevious,
    canLoadMore: searchState.canLoadMore,
    canLoadPrevious: searchState.canLoadPrevious,
    metadataModalOpen: metadataState.metadataModalOpen,
    setMetadataModalOpen: metadataState.setMetadataModalOpen,
    metadataSample: metadataState.metadataSample,
    metadataTargetIds: metadataState.metadataTargetIds,
    metadataForm: metadataState.metadataForm,
    classificationModalOpen: classificationState.classificationModalOpen,
    setClassificationModalOpen: classificationState.setClassificationModalOpen,
    classificationSample: classificationState.classificationSample,
    classificationTargetIds: classificationState.classificationTargetIds,
    editInstrumentType: classificationState.editInstrumentType,
    setEditInstrumentType: classificationState.setEditInstrumentType,
    editSampleType: classificationState.editSampleType,
    instrumentTypes: instrumentState.instrumentTypes,
    instrumentTypeModalOpen: instrumentState.instrumentTypeModalOpen,
    setInstrumentTypeModalOpen: instrumentState.setInstrumentTypeModalOpen,
    confirmOpen: connectedTrashState.confirmOpen,
    pendingTrashSampleId: connectedTrashState.pendingTrashSampleId,
    runSearch: searchState.runSearch,
    fetchAllSamplePaths: searchState.fetchAllSamplePaths,
    handleSampleSelect: selection.handleSampleSelect,
    loadSampleByPath: pathLoading.loadSampleByPath,
    loadMidiByPath: pathLoading.loadMidiByPath,
    handleSearch: searchState.handleSearch,
    handleFilterChange: searchState.handleFilterChange,
    handleDeleteSample: connectedTrashState.handleDeleteSample,
    handleClearAllSamples: connectedTrashState.handleClearAllSamples,
    handleTrashSample: connectedTrashState.handleTrashSample,
    requestTrash: connectedTrashState.requestTrash,
    confirmTrash: connectedTrashState.confirmTrash,
    cancelTrash: connectedTrashState.cancelTrash,
    handleRetry: connectedTrashState.handleRetry,
    handleMetadataClick: metadataState.handleMetadataClick,
    handleMetadataFieldChange: metadataState.handleMetadataFieldChange,
    handleMetadataSave: metadataState.handleMetadataSave,
    handleTypeClick: classificationState.handleTypeClick,
    handleSampleTypeSelect: classificationState.handleSampleTypeSelect,
    handleClassificationSave: classificationState.handleClassificationSave,
    handleAddInstrumentType: instrumentState.handleAddInstrumentType,
    handleDeleteInstrumentType: instrumentState.handleDeleteInstrumentType,
    handleUpdateInstrumentType: instrumentState.handleUpdateInstrumentType,
    loadMore: searchState.loadMore,
    loadPrevious: searchState.loadPrevious,
    loadAround: searchState.loadAround,
    setConfirmOpen: connectedTrashState.setConfirmOpen,
    setPendingTrashSampleId: connectedTrashState.setPendingTrashSampleId,
    togglePlayback: selection.togglePlayback,
  };
}
