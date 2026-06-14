import React, { useEffect, useRef, useImperativeHandle, forwardRef, useState, useMemo, memo, useCallback } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

import { useFavoritesStore } from "../../store/useFavoritesStore";
import { GridView } from "./GridView";
import type { SampleListProps, SampleListHandle } from "./types";
import type { Sample } from "../../types/sample";
import { useColumnResize } from "./useColumnResize";
import { useDragDropList } from "./useDragDropList";
import { useKeyboardNavigation } from "./useKeyboardNavigation";
import { SampleListListView } from "./SampleListListView";

export { extractPathsFromDataTransfer } from "../../utils/dataTransfer";
export type { SampleListHandle, SampleListProps } from "./types";

export const SampleList = memo(forwardRef(function SampleList(props: SampleListProps, ref: React.Ref<SampleListHandle>) {
  const {
    samples,
    samplePaths,
    filters,
    sort,
    selectedSample,
    onSampleSelect,
    onFilterChange,
    onSortChange,
    onTrashSample,
    onTypeClick,
    onTogglePlayback,
    onLoadMore,
    isLoadingMore,
    canLoadMore,
    onLoadPrevious,
    isLoadingPrevious,
    canLoadPrevious,
    instrumentColorCoding = false,
  } = props;

  const listRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const headerRefs = useRef<Array<HTMLDivElement | null>>([]);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const topSentinelRef = useRef<HTMLDivElement | null>(null);
  const preparedPathsRef = useRef<Record<string, string>>({});

  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const { favorites, toggleFavorite } = useFavoritesStore();
  const favSet = useMemo(() => new Set(favorites), [favorites]);

  const { colWidths, startColumnResize, draggedColumnRef, activeResize } = useColumnResize([
    "44px", "28px", "0.9fr", "90px", "80px", "70px", "60px", "60px", "86px", "88px"
  ]);

  const {
    isDragOver,
    handleDragEnter,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    dragIconPathRef
  } = useDragDropList(props.onImportPaths);

  const filtered = useMemo(() => {
    return samples.filter((s) => {
      const matchType = filters.filterType === "all" || s.sample_type === filters.filterType;
      const matchBpmMin = filters.filterBpmMin === "" || (s.bpm && s.bpm >= parseFloat(filters.filterBpmMin));
      const matchBpmMax = filters.filterBpmMax === "" || (s.bpm && s.bpm <= parseFloat(filters.filterBpmMax));
      const matchInstrumentType = filters.filterInstrumentType === "" || s.instrument_type === filters.filterInstrumentType;
      const matchKey = filters.filterKey === "" || s.musical_key === filters.filterKey;
      return matchType && matchBpmMin && matchBpmMax && matchInstrumentType && matchKey;
    });
  }, [samples, filters]);

  const sorted = useMemo(() => {
    const copy = [...filtered];
    const dir = sort.direction === "asc" ? 1 : -1;
    copy.sort((a, b) => {
      switch (sort.field) {
        case "id": return (a.id - b.id) * dir;
        case "file_name": return a.file_name.localeCompare(b.file_name) * dir;
        case "sample_type": return a.sample_type.localeCompare(b.sample_type) * dir;
        case "instrument_type": return a.instrument_type.localeCompare(b.instrument_type) * dir;
        case "bpm": return ((a.bpm ?? 0) - (b.bpm ?? 0)) * dir;
        case "duration": return (a.duration - b.duration) * dir;
        case "sample_rate": return ((a.sample_rate ?? 0) - (b.sample_rate ?? 0)) * dir;
        case "musical_key": return (a.musical_key ?? "").localeCompare(b.musical_key ?? "") * dir;
        default: return 0;
      }
    });
    return copy;
  }, [filtered, sort]);

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

  const lastScrolledRef = useRef<number | null>(null);
  useEffect(() => {
    if (!scrollRef.current || selectedSample === null) return;
    const targetIndex = sorted.findIndex((s) => s.id === selectedSample.id);
    if (targetIndex === -1) return;
    if (lastScrolledRef.current === selectedSample.id) return;
    lastScrolledRef.current = selectedSample.id;
    virtualizer.scrollToIndex(targetIndex, { align: "center", behavior: "auto" });
  }, [selectedSample, sorted, virtualizer]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    const root = listRef.current;
    if (!sentinel || !root || !onLoadMore) return;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            if (isLoadingMore || canLoadMore === false) return;
            void onLoadMore();
          }
        }
      },
      { root, rootMargin: "200px", threshold: 0.1 }
    );
    obs.observe(sentinel);
    return () => obs.disconnect();
  }, [onLoadMore, isLoadingMore, canLoadMore]);

  useEffect(() => {
    const sentinel = topSentinelRef.current;
    const root = listRef.current;
    if (!sentinel || !root || !onLoadPrevious) return;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            if (isLoadingPrevious || canLoadPrevious === false) return;
            void onLoadPrevious();
          }
        }
      },
      { root, rootMargin: "200px", threshold: 0.1 }
    );
    obs.observe(sentinel);
    return () => obs.disconnect();
  }, [onLoadPrevious, isLoadingPrevious, canLoadPrevious]);

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
      <div style={{ padding: "10px 16px", borderBottom: "1px solid #0f1117", background: "#0a0c12", display: "flex", alignItems: "center", gap: "10px" }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2">
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <input
          value={filters.search}
          onChange={(e) => onFilterChange({ search: e.target.value })}
          placeholder="Search by filename, tag, key..."
          style={{ flex: 1, fontSize: "16px", color: "#9ca3af", letterSpacing: "0.04em" }}
        />
        <span style={{ fontSize: "14px", color: "#374151", letterSpacing: "0.1em" }}>
          {sorted.length}/{samples.length} RESULTS
        </span>
        <div style={{ display: "flex", gap: "4px" }}>
          <button type="button" onClick={() => setViewMode("list")} title="List view" style={{ background: viewMode === "list" ? "#1f2937" : "transparent", border: "1px solid #1f2937", color: viewMode === "list" ? "#f97316" : "#6b7280", padding: "4px 8px", borderRadius: "2px", cursor: "pointer", fontFamily: "'Courier New', monospace", fontSize: "12px" }}>☰</button>
          <button type="button" onClick={() => setViewMode("grid")} title="Grid view" style={{ background: viewMode === "grid" ? "#1f2937" : "transparent", border: "1px solid #1f2937", color: viewMode === "grid" ? "#f97316" : "#6b7280", padding: "4px 8px", borderRadius: "2px", cursor: "pointer", fontFamily: "'Courier New', monospace", fontSize: "12px" }}>▦</button>
        </div>
      </div>

      {viewMode === "grid" ? (
        <GridView samples={sorted} selectedId={selectedSample?.id ?? null} onSelect={handleSampleSelectInternal} />
      ) : (
        <div
          style={{ flex: 1, overflowY: "auto", paddingBottom: selectedSample ? "160px" : undefined, boxSizing: "border-box" }}
          ref={(el: HTMLDivElement | null) => {
            listRef.current = el;
            scrollRef.current = el;
          }}
        >
          <SampleListListView
            samples={sorted}
            samplePaths={samplePaths}
            selectedSample={selectedSample}
            selectedIds={props.selectedIds}
            colWidths={colWidths}
            rowHeight={rowHeight}
            sort={sort}
            onSortChange={onSortChange}
            onSampleSelect={handleSampleSelectInternal}
            onTypeClick={onTypeClick}
            onTrashSample={onTrashSample}
            onToggleFavorite={toggleFavorite}
            favorites={favSet}
            instrumentColorCoding={instrumentColorCoding}
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
            canLoadMore={canLoadMore}
            onLoadMore={onLoadMore}
          />
        </div>
      )}
    </div>
  );
}));
