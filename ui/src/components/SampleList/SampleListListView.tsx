import type { MutableRefObject } from "react";
import type { Sample, SortState, SampleProcessingSettings } from "../../types/sample";
import { SampleListHeader } from "./SampleListHeader";
import { SampleRow } from "./SampleRow";

interface SampleListListViewProps {
  samples: Sample[];
  samplePaths: Record<number, string>;
  selectedSample: Sample | null;
  selectedIds?: Set<number>;
  colWidths: string[];
  rowHeight: number;
  sort: SortState;
  onSortChange: (sort: SortState) => void;
  onSampleSelect: (sample: Sample, isShift?: boolean) => void;
  onTypeClick?: (sample: Sample) => void;
  onMetadataClick?: (sample: Sample) => void;
  onTrashSample?: (id: number) => void;
  onToggleFavorite: (id: number) => void;
  favorites: Set<number>;
  instrumentColorCoding: boolean;
  dragIconPath: string;
  preparedPathsRef: MutableRefObject<Record<number, string>>;
  headerRefs: MutableRefObject<Array<HTMLDivElement | null>>;
  startColumnResize: (index: number, startX: number, startWidth: number) => void;
  draggedColumnRef: MutableRefObject<number | null>;
  activeResize: MutableRefObject<{ index: number; startX: number; startWidth: number; wasDragging: boolean } | null>;
  virtualizer: { getTotalSize: () => number; getVirtualItems: () => Array<{ index: number; start: number; key: React.Key; end: number; size: number; lane: number }> };
  isDragOver: boolean;
  externalIsDragOver?: boolean;
  topSentinelRef: MutableRefObject<HTMLDivElement | null>;
  sentinelRef: MutableRefObject<HTMLDivElement | null>;
  isLoadingPrevious?: boolean;
  canLoadPrevious?: boolean;
  onLoadPrevious?: () => Promise<void>;
  isLoadingMore?: boolean;
  canLoadMore?: boolean;
  onLoadMore?: () => Promise<void>;
  getSampleProcessingSettings?: (sample: Sample, path?: string) => SampleProcessingSettings | undefined;
  showSampleMetadataQuality?: boolean;
}

export function SampleListListView({
  samples,
  samplePaths,
  selectedSample,
  selectedIds,
  colWidths,
  rowHeight,
  sort,
  onSortChange,
  onSampleSelect,
  onTypeClick,
  onMetadataClick,
  onTrashSample,
  onToggleFavorite,
  favorites,
  instrumentColorCoding,
  dragIconPath,
  preparedPathsRef,
  headerRefs,
  startColumnResize,
  draggedColumnRef,
  activeResize,
  virtualizer,
  isDragOver,
  externalIsDragOver,
  topSentinelRef,
  sentinelRef,
  isLoadingPrevious,
  canLoadPrevious,
  onLoadPrevious,
  isLoadingMore,
  canLoadMore,
  onLoadMore,
  getSampleProcessingSettings,
  showSampleMetadataQuality = true,
}: SampleListListViewProps) {
  return (
    <>
      <SampleListHeader
        colWidths={colWidths}
        sort={sort}
        onSortChange={onSortChange}
        startColumnResize={startColumnResize}
        draggedColumnRef={draggedColumnRef}
        activeResize={activeResize}
        headerRefs={headerRefs}
        showSampleMetadataQuality={showSampleMetadataQuality}
      />
      {(externalIsDragOver || isDragOver) && (
          <div
            role="status"
            aria-live="polite"
            style={{
              position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
              background: "rgba(2,6,23,0.65)", zIndex: 40, pointerEvents: "none", transition: "opacity 160ms ease",
            }}
            aria-hidden={!isDragOver}
          >
            <div style={{ textAlign: "center", color: "#f1f5f9", transform: isDragOver ? 'scale(1)' : 'scale(0.98)', transition: 'transform 140ms ease' }}>
              <svg width="56" height="56" viewBox="0 0 24 24" fill="none" style={{ marginBottom: 8 }} aria-hidden>
                <path d="M12 3v10" stroke="#f97316" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M8 7l4-4 4 4" stroke="#f97316" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <rect x="3" y="11" width="18" height="10" rx="2" stroke="#f97316" strokeWidth="1.2" />
              </svg>
              <div style={{ fontFamily: "'Courier New', monospace", fontWeight: 700, letterSpacing: "0.08em" }}>IMPORT</div>
              <div style={{ color: "#9ca3af", marginTop: 4, fontSize: 13 }}>Drop files or folders to import into the library</div>
            </div>
          </div>
        )}
        <div ref={topSentinelRef} aria-hidden style={{ height: 1, width: "100%", visibility: "hidden" }} />
        <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
          {virtualizer.getVirtualItems().map((virtualRow) => {
            const s = samples[virtualRow.index];
            const isSelected = selectedIds ? selectedIds.has(s.id) : selectedSample?.id === s.id;
            return (
              <SampleRow
                key={s.id}
                sample={s}
                virtualRow={virtualRow}
                colWidths={colWidths}
                rowHeight={rowHeight}
                isSelected={isSelected}
                samplePath={samplePaths[s.id]}
                isFavorite={favorites.has(s.id)}
                instrumentColorCoding={instrumentColorCoding}
                processingSettings={getSampleProcessingSettings?.(s, samplePaths[s.id])}
                showSampleMetadataQuality={showSampleMetadataQuality}
                dragIconPath={dragIconPath}
                preparedPathsRef={preparedPathsRef}
                onSampleSelect={onSampleSelect}
                onToggleFavorite={onToggleFavorite}
                onTypeClick={onTypeClick}
                onMetadataClick={onMetadataClick}
                onTrashSample={onTrashSample}
              />
            );
          })}
        </div>
        <div ref={sentinelRef} aria-hidden style={{ height: 1, width: "100%", visibility: "hidden" }} />
        <div style={{ padding: "6px 12px", textAlign: "center", color: "#9ca3af" }}>
          {isLoadingPrevious ? (
            <div style={{ fontSize: 13 }}>Loading...</div>
          ) : canLoadPrevious && onLoadPrevious ? (
            <button
              type="button"
              onClick={() => void onLoadPrevious()}
              style={{ background: "#111827", border: "1px solid #1f2937", color: "#f97316", padding: "6px 10px", borderRadius: 4, cursor: "pointer", fontFamily: "'Courier New', monospace" }}
            >
              Load previous
            </button>
          ) : null}
        </div>
        <div style={{ padding: "8px 16px", textAlign: "center", color: "#9ca3af" }}>
          {isLoadingMore ? (
            <div style={{ fontSize: 13 }}>Loading...</div>
          ) : canLoadMore === false ? (
            <div style={{ fontSize: 13 }}>No more results</div>
          ) : onLoadMore ? (
            <button
              type="button"
              onClick={() => void onLoadMore()}
              style={{ background: "#111827", border: "1px solid #1f2937", color: "#f97316", padding: "6px 10px", borderRadius: 4, cursor: "pointer", fontFamily: "'Courier New', monospace" }}
            >
              Load more
            </button>
          ) : null}
        </div>
    </>
  );
}
