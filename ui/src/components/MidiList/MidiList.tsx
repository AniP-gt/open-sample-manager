import { useCallback, useEffect, useImperativeHandle, useRef, forwardRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import type React from "react";
import { invoke } from "@tauri-apps/api/core";
import { extractPathsFromDataTransfer } from "../../utils/dataTransfer";
import type { MidiListProps, MidiListHandle } from "./types";
import type { Midi } from "../../types/midi";
import { useMidiColumnResize } from "./hooks/useMidiColumnResize";
import { useMidiSort } from "./hooks/useMidiSort";
import { useMidiKeyboard } from "./hooks/useMidiKeyboard";
import { MidiListSearch } from "./components/MidiListSearch";
import { MidiListEmpty } from "./components/MidiListEmpty";
import { MidiListHeader } from "./components/MidiListHeader";
import { MidiListRow } from "./components/MidiListRow";
import { MidiListOverlay } from "./components/MidiListOverlay";
import { useMidiFavoritesStore } from "../../store/useMidiFavoritesStore";

export type { MidiListProps, MidiListHandle } from "./types";

export const MidiList = forwardRef(function MidiList(
  {
    midis,
    selectedMidi,
    selectedMidiIds,
    onMidiSelect,
    onTagBadgeClick,
    onLoadMore,
    isLoadingMore,
    canLoadMore,
    onLoadPrevious,
    isLoadingPrevious,
    canLoadPrevious,
    onTrashMidi,
    onImportPaths,
    externalIsDragOver,
    midiTags = [],
    onTagFilterChange,
    tagFilterId,
    midiSearch = "",
    onMidiSearchChange = () => {},
    onTogglePlayback,
    filterKey = "",
  }: MidiListProps,
  ref: React.Ref<MidiListHandle>,
) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const topSentinelRef = useRef<HTMLDivElement | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounter = useRef(0);
  const preparedPathsRef = useRef<Record<number, string>>({});
  const dragIconPathRef = useRef<string>("");

  useEffect(() => {
    void invoke<string>("get_drag_icon_path").then((p) => {
      dragIconPathRef.current = p;
    }).catch(() => {});
  }, []);

  void midiTags;
  void onTagFilterChange;
  void tagFilterId;

  const {
    colWidths,
    headerRefs,
    draggedColumnRef,
    activeResize,
    hoveredCol,
    setHoveredCol,
    startColumnResize,
    onResizerKeyDown,
  } = useMidiColumnResize();

  const { favorites, toggleFavorite } = useMidiFavoritesStore();
  const favoriteSet = new Set(favorites);

  const {
    sortBy,
    sortDir,
    filteredMidis,
    sortedMidis,
    headerClick,
    headerKeyDown,
  } = useMidiSort(midis, filterKey);

  const handleMidiSelectInternal = useCallback((midi: Midi, isShift?: boolean) => {
    if (isShift && selectedMidi && sortedMidis.length > 0) {
      const startIndex = sortedMidis.findIndex(m => m.id === selectedMidi.id);
      const endIndex = sortedMidis.findIndex(m => m.id === midi.id);
      if (startIndex !== -1 && endIndex !== -1) {
        const min = Math.min(startIndex, endIndex);
        const max = Math.max(startIndex, endIndex);
        const ids = new Set<number>();
        for (let i = min; i <= max; i++) {
          ids.add(sortedMidis[i].id);
        }
        onMidiSelect(midi, true, ids);
        return;
      }
    }
    onMidiSelect(midi);
  }, [sortedMidis, selectedMidi, onMidiSelect]);

  useMidiKeyboard(listRef, sortedMidis, selectedMidi, handleMidiSelectInternal, onTogglePlayback);

  const midiRowHeight = 48;
  const virtualizer = useVirtualizer({
    count: sortedMidis.length,
    getScrollElement: useCallback(() => scrollRef.current, []),
    estimateSize: useCallback(() => midiRowHeight, []),
    overscan: 5,
  });

  useEffect(() => {
    const sentinel = sentinelRef.current;
    const root = scrollRef.current;
    if (!sentinel || !root || !onLoadMore) return;

    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            if (isLoadingMore) return;
            if (canLoadMore === false) return;
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
    const root = scrollRef.current;
    if (!sentinel || !root || !onLoadPrevious) return;

    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            if (isLoadingPrevious) return;
            if (canLoadPrevious === false) return;
            void onLoadPrevious();
          }
        }
      },
      { root, rootMargin: "200px", threshold: 0.1 }
    );

    obs.observe(sentinel);
    return () => obs.disconnect();
  }, [onLoadPrevious, isLoadingPrevious, canLoadPrevious]);

  const lastScrolledMidiRef = useRef<number | null>(null);
  useEffect(() => {
    if (!scrollRef.current || selectedMidi === null) return;
    const targetIndex = sortedMidis.findIndex((m) => m.id === selectedMidi.id);
    if (targetIndex === -1) return;
    if (lastScrolledMidiRef.current === selectedMidi.id) return;
    lastScrolledMidiRef.current = selectedMidi.id;
    virtualizer.scrollToIndex(targetIndex, { align: "center", behavior: "auto" });
  }, [selectedMidi, sortedMidis, virtualizer]);

  useImperativeHandle(ref, () => ({
    focusSelected: () => {
      if (!selectedMidi) return;
      const targetIndex = sortedMidis.findIndex((m) => m.id === selectedMidi.id);
      if (targetIndex !== -1) {
        virtualizer.scrollToIndex(targetIndex, { align: "center", behavior: "auto" });
      }
    },
  }));

  if (midis.length === 0) {
    return <MidiListEmpty midiSearch={midiSearch} onMidiSearchChange={onMidiSearchChange} />;
  }

  return (
    <div
      ref={listRef}
      data-testid="midi-list-root"
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        background: "#0a0c12",
        position: "relative",
        minHeight: 0,
      }}
      onDragEnter={(e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        dragCounter.current += 1;
        setIsDragOver(true);
      }}
      onDragOver={(e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        try { e.dataTransfer.dropEffect = 'copy'; } catch {}
      }}
      onDragLeave={(e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        dragCounter.current -= 1;
        if (dragCounter.current <= 0) { dragCounter.current = 0; setIsDragOver(false); }
      }}
      onDrop={(e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        dragCounter.current = 0;
        setIsDragOver(false);
        const paths = extractPathsFromDataTransfer(e.dataTransfer ?? null);
        if (paths.length > 0) onImportPaths?.(paths);
      }}
    >
      <MidiListSearch
        midiSearch={midiSearch}
        onMidiSearchChange={onMidiSearchChange}
        filteredCount={filteredMidis.length}
        totalCount={midis.length}
      />

      <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", overflowX: "auto", boxSizing: "border-box", minHeight: 0 }}>
        <MidiListHeader
          colWidths={colWidths}
          headerRefs={headerRefs}
          startColumnResize={startColumnResize}
          hoveredCol={hoveredCol}
          setHoveredCol={setHoveredCol}
          activeResize={activeResize}
          draggedColumnRef={draggedColumnRef}
          sortBy={sortBy}
          sortDir={sortDir}
          headerClick={headerClick}
          headerKeyDown={headerKeyDown}
          onResizerKeyDown={onResizerKeyDown}
        />
        <div ref={topSentinelRef} aria-hidden style={{ height: 1, width: "100%", visibility: "hidden" }} />
        {sortedMidis.length === 0 && midiSearch.trim() ? (
          <div style={{ padding: "24px 16px", color: "#6b7280", fontSize: "13px", fontFamily: "'Courier New', monospace" }}>
            No results for &apos;{midiSearch}&apos;
          </div>
        ) : (
          <div style={{ height: virtualizer.getTotalSize(), width: "100%", position: "relative" }}>
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const midi = sortedMidis[virtualRow.index];
              if (!midi) return null;
              const isSelected = selectedMidiIds ? selectedMidiIds.has(midi.id) : selectedMidi?.id === midi.id;
              const isFavorite = favoriteSet.has(midi.id);
              return (
                <MidiListRow
                  key={midi.id}
                  midi={midi}
                  isSelected={isSelected}
                  isFavorite={isFavorite}
                  onToggleFavorite={() => toggleFavorite(midi.id)}
                  virtualRow={virtualRow}
                  colWidths={colWidths}
                  onMidiSelect={handleMidiSelectInternal}
                  onTagBadgeClick={onTagBadgeClick}
                  onTrashMidi={onTrashMidi}
                  preparedPathsRef={preparedPathsRef}
                  dragIconPathRef={dragIconPathRef}
                />
              );
            })}
          </div>
        )}
        <div ref={sentinelRef} aria-hidden style={{ height: 1, width: "100%", visibility: "hidden" }} />
      </div>

      <MidiListOverlay isDragOver={externalIsDragOver || isDragOver} />

      <div style={{ padding: "8px 12px", textAlign: "center", color: "#9ca3af" }}>
        {isLoadingPrevious ? (
          <div style={{ fontSize: 13 }}>Loading...</div>
        ) : canLoadPrevious && onLoadPrevious ? (
          <button
            type="button"
            onClick={() => { void onLoadPrevious(); }}
            style={{
              background: "#111827",
              border: "1px solid #1f2937",
              color: "#f97316",
              padding: "6px 10px",
              borderRadius: 4,
              cursor: "pointer",
              fontFamily: "'Courier New', monospace",
            }}
          >
            Load previous
          </button>
        ) : null}
      </div>

      <div style={{ padding: "8px 12px", textAlign: "center", color: "#9ca3af" }}>
        {isLoadingMore ? (
          <div style={{ fontSize: 13 }}>Loading...</div>
        ) : canLoadMore === false ? (
          <div style={{ fontSize: 13 }}>No more results</div>
        ) : onLoadMore ? (
          <button
            type="button"
            onClick={() => { void onLoadMore(); }}
            style={{
              background: "#111827",
              border: "1px solid #1f2937",
              color: "#f97316",
              padding: "6px 10px",
              borderRadius: 4,
              cursor: "pointer",
              fontFamily: "'Courier New', monospace",
            }}
          >
            Load more
          </button>
        ) : null}
      </div>
    </div>
  );
});
