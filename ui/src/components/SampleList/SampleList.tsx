import React, { useEffect, useRef, useImperativeHandle, forwardRef, useState, useMemo, memo, useCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

import { useFavoritesStore } from "../../store/useFavoritesStore";
import { GridView } from "./GridView";
import type { SampleListProps, SampleListHandle } from "./types";
import type { Sample } from "../../types/sample";
import { useColumnResize } from "./useColumnResize";
import {
  DEFAULT_SAMPLE_COLUMN_WIDTHS,
  getSampleListMinWidth,
} from "./sampleListLayout";
import { useDragDropList } from "./useDragDropList";
import { useKeyboardNavigation } from "./useKeyboardNavigation";
import { SampleListListView } from "./SampleListListView";
import { sortSampleRows } from "./sortSampleRows";
import { matchesSampleFilters } from "../../utils/sampleFilter";
import { appendPreviousRandomSelection, chooseRandomSample, popRandomHistory } from "./randomSelection";
import { useSamplePaginationObservers } from "./useSamplePaginationObservers";
import { SampleListToolbar } from "./SampleListToolbar";
import { SampleListEmptyState } from "./SampleListEmptyState";
import { clearedSampleFilters, getActiveSampleFilters } from "./ActiveSampleFilters";

export { extractPathsFromDataTransfer } from "../../utils/dataTransfer";
export type { SampleListHandle, SampleListProps } from "./types";

export const SampleList = memo(forwardRef(function SampleList(props: SampleListProps, ref: React.Ref<SampleListHandle>) {
  const {
    samples,
    instrumentTypeOptions: fullInstrumentTypeOptions,
    samplePaths,
    filters,
    sort,
    selectedSample,
    onSampleSelect,
    onFilterChange,
    onSearchSubmit,
    onSortChange,
    onTrashSample,
    onTypeClick,
    onMetadataClick,
    onTogglePlayback,
    onLoadMore,
    isLoadingMore,
    canLoadMore,
    onLoadPrevious,
    isLoadingPrevious,
    canLoadPrevious,
    instrumentColorCoding = false,
    showSampleMetadataQuality = true,
    getSampleProcessingSettings,
    preserveOrder = false,
    onRestoreSearchResults,
  } = props;

  const listRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const headerRefs = useRef<Array<HTMLDivElement | null>>([]);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const topSentinelRef = useRef<HTMLDivElement | null>(null);
  const preparedPathsRef = useRef<Record<string, string>>({});

  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [randomHistory, setRandomHistory] = useState<Sample[]>([]);
  const [lastRandomSample, setLastRandomSample] = useState<Sample | null>(null);
  const { favorites, toggleFavorite } = useFavoritesStore();
  const favSet = useMemo(() => new Set(favorites), [favorites]);

  const { colWidths, startColumnResize, draggedColumnRef, activeResize } = useColumnResize([
    ...DEFAULT_SAMPLE_COLUMN_WIDTHS,
  ]);
  const visibleColWidths = useMemo(() => {
    if (showSampleMetadataQuality) return colWidths;
    return colWidths.filter((_, index) => index !== 8 && index !== 9);
  }, [colWidths, showSampleMetadataQuality]);
  const tableMinWidth = getSampleListMinWidth(showSampleMetadataQuality);

  const {
    isDragOver,
    handleDragEnter,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    dragIconPathRef
  } = useDragDropList(props.onImportPaths);

  const filtered = useMemo(() => {
    if (preserveOrder) return samples;
    return samples.filter((sample) => matchesSampleFilters(sample, filters, favSet.has(sample.id)));
  }, [samples, filters, favSet, preserveOrder]);

  const sorted = useMemo(() => preserveOrder ? filtered : sortSampleRows(filtered, sort), [filtered, preserveOrder, sort]);

  const rowHeight = 48;
  const virtualizer = useVirtualizer({
    count: sorted.length,
    getScrollElement: useCallback(() => scrollRef.current, []),
    estimateSize: useCallback(() => rowHeight, []),
    overscan: 5,
  });

  const handleSampleSelectInternal = useCallback((sample: Sample, isShift?: boolean) => {
    if (isShift && selectedSample && sorted.length > 0) {
      const startIndex = sorted.findIndex(s => s.id === selectedSample.id);
      const endIndex = sorted.findIndex(s => s.id === sample.id);
      if (startIndex !== -1 && endIndex !== -1) {
        const min = Math.min(startIndex, endIndex);
        const max = Math.max(startIndex, endIndex);
        const ids = new Set<number>();
        for (let i = min; i <= max; i++) {
          ids.add(sorted[i].id);
        }
        onSampleSelect(sample, true, ids);
        return;
      }
    }
    onSampleSelect(sample);
  }, [sorted, selectedSample, onSampleSelect]);

  useKeyboardNavigation({
    sorted,
    selectedSample,
    onSampleSelect: handleSampleSelectInternal,
    onTogglePlayback,
    listRef
  });

  const handleRandomSample = useCallback(() => {
    const nextSample = chooseRandomSample(sorted, selectedSample?.id);
    if (!nextSample) return;

    setRandomHistory((history) => appendPreviousRandomSelection(history, lastRandomSample));
    setLastRandomSample(nextSample);
    onSampleSelect(nextSample);
  }, [sorted, selectedSample, lastRandomSample, onSampleSelect]);

  const handleRandomBack = useCallback(() => {
    const { previousSample, nextHistory } = popRandomHistory(randomHistory);
    if (!previousSample) return;

    setRandomHistory(nextHistory);
    setLastRandomSample(previousSample);
    onSampleSelect(previousSample);
  }, [randomHistory, onSampleSelect]);


  const lastScrolledRef = useRef<number | null>(null);
  useEffect(() => {
    if (!scrollRef.current || selectedSample === null) return;
    const targetIndex = sorted.findIndex((s) => s.id === selectedSample.id);
    if (targetIndex === -1) return;
    if (lastScrolledRef.current === selectedSample.id) return;
    lastScrolledRef.current = selectedSample.id;
    virtualizer.scrollToIndex(targetIndex, { align: "center", behavior: "auto" });
  }, [selectedSample, sorted, virtualizer]);

  useSamplePaginationObservers({ listRef, sentinelRef, topSentinelRef, resultCount: sorted.length,
    onLoadMore, isLoadingMore, canLoadMore, onLoadPrevious, isLoadingPrevious, canLoadPrevious });

  useImperativeHandle(ref, () => ({
    focusSelected: () => {
      if (!selectedSample) return;
      const targetIndex = sorted.findIndex((s) => s.id === selectedSample.id);
      if (targetIndex === -1) return;
      virtualizer.scrollToIndex(targetIndex, { align: "center", behavior: "auto" });
      const el = listRef.current?.querySelector<HTMLDivElement>(`.sample-row[data-index="${targetIndex}"]`);
      if (!el) return;
      const prevTab = el.getAttribute("tabindex");
      el.setAttribute("tabindex", "-1");
      requestAnimationFrame(() => {
        try {
          (el as HTMLElement).focus();
        } finally {
          if (prevTab !== null) {
            el.setAttribute("tabindex", prevTab);
          } else {
            el.removeAttribute("tabindex");
          }
        }
      });
    },
  }), [sorted, virtualizer, selectedSample]);

  return (
    <div
      style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <SampleListToolbar
        samples={samples} instrumentTypeOptions={fullInstrumentTypeOptions}
        filters={filters} onFilterChange={onFilterChange} onSearchSubmit={onSearchSubmit}
        showSampleMetadataQuality={showSampleMetadataQuality} resultCount={sorted.length}
        onRandom={handleRandomSample} onRandomBack={handleRandomBack}
        canRandomBack={randomHistory.length > 0} viewMode={viewMode} onViewModeChange={setViewMode}
        preserveOrder={preserveOrder} onRestoreSearchResults={onRestoreSearchResults}
      />

      {viewMode === "grid" && sorted.length > 0 ? (
        <GridView samples={sorted} selectedId={selectedSample?.id ?? null} onSelect={handleSampleSelectInternal} onMetadataClick={onMetadataClick} showSampleMetadataQuality={showSampleMetadataQuality} />
      ) : (
        <div
          data-testid="sample-list-scroll-region"
          style={{ flex: 1, minWidth: 0, overflow: "auto", paddingBottom: selectedSample ? "160px" : undefined, boxSizing: "border-box" }}
          ref={(el: HTMLDivElement | null) => {
            listRef.current = el;
            scrollRef.current = el;
          }}
        >
          <SampleListListView
            emptyState={sorted.length === 0 ? <SampleListEmptyState
              isLoading={props.isLoading} error={props.loadError}
              hasFilters={getActiveSampleFilters(filters).length > 0}
              isCollectionView={props.isCollectionView}
              onClearFilters={() => { onFilterChange(clearedSampleFilters); onSearchSubmit?.(""); }}
              onScanLibrary={props.onScanLibrary} onRetry={props.onRetry}
            /> : undefined}
            samples={sorted}
            samplePaths={samplePaths}
            selectedSample={selectedSample}
            selectedIds={props.selectedIds}
            colWidths={visibleColWidths}
            tableMinWidth={tableMinWidth}
            rowHeight={rowHeight}
            sort={sort}
            onSortChange={onSortChange}
            onSampleSelect={handleSampleSelectInternal}
            onTypeClick={onTypeClick}
            onMetadataClick={onMetadataClick}
            onTrashSample={onTrashSample}
            onToggleFavorite={toggleFavorite}
            favorites={favSet}
            instrumentColorCoding={instrumentColorCoding}
            showSampleMetadataQuality={showSampleMetadataQuality}
            dragIconPath={dragIconPathRef.current}
            preparedPathsRef={preparedPathsRef}
            headerRefs={headerRefs}
            startColumnResize={startColumnResize}
            draggedColumnRef={draggedColumnRef}
            activeResize={activeResize}
            virtualizer={virtualizer}
            isDragOver={isDragOver}
            externalIsDragOver={props.externalIsDragOver}
            topSentinelRef={topSentinelRef}
            sentinelRef={sentinelRef}
            isLoadingPrevious={isLoadingPrevious}
            canLoadPrevious={canLoadPrevious}
            onLoadPrevious={onLoadPrevious}
            isLoadingMore={isLoadingMore}
            canLoadMore={sorted.length > 0 && canLoadMore}
            onLoadMore={onLoadMore}
            getSampleProcessingSettings={getSampleProcessingSettings}
          />
        </div>
      )}
    </div>
  );
}));
