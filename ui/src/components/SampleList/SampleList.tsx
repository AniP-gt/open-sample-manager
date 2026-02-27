import { startDrag } from "@crabnebula/tauri-plugin-drag";
import React, { useEffect, useRef, useImperativeHandle, forwardRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";

import type { FilterState, Sample, SortState, SortField } from "../../types/sample";
import { TypeBadge } from "../TypeBadge/TypeBadge";

interface SampleListProps {
  samples: Sample[];
  samplePaths: Record<number, string>;
  filters: FilterState;
  sort: SortState;
  selectedSample: Sample | null;
  onSampleSelect: (sample: Sample) => void;
  onFilterChange: (filters: Partial<FilterState>) => void;
  onSortChange: (sort: SortState) => void;
  onDeleteSample: (id: number) => void;
  onTrashSample?: (id: number) => void;
  onTypeClick?: (sample: Sample) => void;
  // Called when files/folders are dropped onto the list. Paths will be
  // best-effort resolved from the DataTransfer payload (file.path when
  // available, otherwise file names or URI list entries).
  onImportPaths?: (paths: string[]) => void;
  // When true, externally force the drop overlay (useful for dev/testing)
  externalIsDragOver?: boolean;
  // Called to request next page when scrolling to the bottom.
  onLoadMore?: () => Promise<void>;
  // Whether the parent is currently loading more items.
  isLoadingMore?: boolean;
  // Whether more items can be loaded (parent decides based on last fetch length).
  canLoadMore?: boolean;
}

// Helper: extract file system paths from a DataTransfer-like object. Exported
// so unit tests can import it directly. Kept lightweight and defensive to
// support both browser and Tauri drag payloads.
export function extractPathsFromDataTransfer(dataTransfer: DataTransfer | null): string[] {
  const paths: string[] = [];

  const items = (dataTransfer as any)?.items;
  if (items && items.length > 0) {
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.kind !== "file") continue;
      try {
        const file = item.getAsFile?.();
        if (!file) continue;
        const maybePath = (file as File & { path?: string }).path;
        if (maybePath) {
          paths.push(maybePath);
          continue;
        }
        // Fallback to filename when full path is unavailable in browser
        paths.push(file.name);
      } catch (err) {
        // ignore
      }
    }
  }

  // If no paths collected, try URI list or plain text payloads
  if (paths.length === 0) {
    const uriList = (dataTransfer as any)?.getData?.("text/uri-list") || (dataTransfer as any)?.getData?.("text/plain") || "";
    if (uriList) {
      const lines = uriList.split(/\r?\n/).map((l: string) => l.trim()).filter(Boolean);
      for (const line of lines) {
        if (line.startsWith("file://")) {
          try {
            // decodeURI to handle spaces and non-ascii
            const decoded = decodeURI(line.replace(/^file:\/\//, ""));
            // On windows file:///C:/path -> remove leading slash if present
            const winMatch = decoded.match(/^\/?[A-Za-z]:/);
            const path = winMatch ? decoded.replace(/^\//, "") : decoded;
            paths.push(path);
          } catch {
            paths.push(line);
          }
        } else {
          paths.push(line);
        }
      }
    }
  }

  // Deduplicate while preserving order
  return Array.from(new Set(paths));
}
// Minimal transparent PNG as a data URL (1x1). The drag plugin's `image`
// argument accepts a file path or a data URL; using an inline base64 PNG is
// reliable across environments and avoids binary serialization edge cases.
const TRANSPARENT_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";


function SortHeader({
  field,
  currentSort,
  onSort,
  children,
  columnIndex,
  draggedColumnRef,
}: {
  field: SortField;
  currentSort: SortState;
  onSort: (sort: SortState) => void;
  children: React.ReactNode;
  columnIndex?: number;
  draggedColumnRef?: React.MutableRefObject<number | null>;
}) {
  const isActive = currentSort.field === field;
  const direction = isActive ? currentSort.direction : "asc";

  return (
    <div
      onClick={() => {
        // If this column was just used for dragging, ignore the click (it was a resize)
        if (typeof columnIndex === "number" && draggedColumnRef?.current === columnIndex) {
          draggedColumnRef.current = null;
          return;
        }
        onSort({
          field,
          direction: isActive && direction === "asc" ? "desc" : "asc",
        });
      }}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "4px",
        cursor: "pointer",
        userSelect: "none",
      }}
    >
      {children}
      {isActive && (
        <span style={{ color: "#f97316", fontSize: "10px" }}>
          {direction === "asc" ? "▲" : "▼"}
        </span>
      )}
    </div>
  );
}

export type SampleListHandle = {
  focusSelected: () => void;
};

export const SampleList = forwardRef(function SampleList(props: SampleListProps, ref: React.Ref<SampleListHandle>) {
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
    onLoadMore,
    isLoadingMore,
    canLoadMore,
  } = props;
  // Placeholder state retained for future server-side pagination wiring
  const listRef = useRef<HTMLDivElement | null>(null);
  // Column widths as strings so we can mix px and flexible units like '1fr'.
  // Widen DUR (index 5) and the actions column (index 6) to avoid overlap
  // between the duration text and action buttons (emoji icons).
  // Increase TYPE column (index 2) to reduce wrapping of "one-shot" badge
  const [colWidths, setColWidths] = useState<string[]>(["28px", "0.9fr", "110px", "90px", "60px", "86px", "88px"]);
  const headerRefs = useRef<Array<HTMLDivElement | null>>([]);
  const draggedColumnRef = useRef<number | null>(null);
  const activeResize = useRef<{ index: number; startX: number; startWidth: number; wasDragging: boolean } | null>(null);
  const [hoveredCol, setHoveredCol] = useState<number | null>(null);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const active = activeResize.current;
      if (!active) return;
      const dx = e.clientX - active.startX;
      let next = Math.max(10, Math.round(active.startWidth + dx));
      // min widths per column (px)
      const minWidths = [20, 120, 60, 60, 40, 40, 30];
      const maxWidths = [400, 1600, 800, 800, 400, 400, 400];
      const min = minWidths[active.index] ?? 20;
      const max = maxWidths[active.index] ?? 2000;
      next = Math.max(min, Math.min(max, next));
      setColWidths((prev) => {
        const copy = [...prev];
        copy[active.index] = `${next}px`;
        return copy;
      });
      if (!active.wasDragging && Math.abs(dx) > 3) {
        active.wasDragging = true;
      }
      document.body.style.cursor = "col-resize";
    };

    const onUp = () => {
      const active = activeResize.current;
      if (active) {
        if (active.wasDragging) {
          draggedColumnRef.current = active.index;
        } else {
          draggedColumnRef.current = null;
        }
      }
      activeResize.current = null;
      document.body.style.cursor = "";
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
  }, []);
  const [isDragOver, setIsDragOver] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  // Prepared (backend-copied) paths for drag operations. We start preparing on
  // mouse down so the async backend copy has time to finish before the
  // synchronous dragstart handler runs (browsers require setData to be sync).
  const preparedPathsRef = useRef<Record<number, string>>({});
  const [toast, setToast] = useState<{ message: string; visible: boolean; sampleId: number | null }>({ message: "", visible: false, sampleId: null });
  const dragCounter = useRef(0);

  

  const extractPathsFromDrop = (e: React.DragEvent) => extractPathsFromDataTransfer(e.dataTransfer ?? null);

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current += 1;
    setIsDragOver(true);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    try {
      e.dataTransfer.dropEffect = "copy";
    } catch {}
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDragOver(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDragOver(false);
    const paths = extractPathsFromDrop(e);
    if (paths.length > 0) {
      props.onImportPaths?.(paths);
    }
  };

  const filtered = samples.filter((s) => {
    const matchSearch =
      s.file_name.toLowerCase().includes(filters.search.toLowerCase()) ||
      s.tags.some((t) => t.toLowerCase().includes(filters.search.toLowerCase()));
    const matchType =
      filters.filterType === "all" || s.sample_type === filters.filterType;
    const matchBpmMin =
      filters.filterBpmMin === "" ||
      (s.bpm && s.bpm >= parseFloat(filters.filterBpmMin));
    const matchBpmMax =
      filters.filterBpmMax === "" ||
      (s.bpm && s.bpm <= parseFloat(filters.filterBpmMax));
    const matchInstrumentType =
      filters.filterInstrumentType === "" || s.instrument_type === filters.filterInstrumentType;
    return matchSearch && matchType && matchBpmMin && matchBpmMax && matchInstrumentType;
  });

      const sorted = [...filtered].sort((a, b) => {
        const dir = sort.direction === "asc" ? 1 : -1;
        switch (sort.field) {
      case "id":
        return (a.id - b.id) * dir;
      case "file_name":
        return a.file_name.localeCompare(b.file_name) * dir;
      case "sample_type":
        return a.sample_type.localeCompare(b.sample_type) * dir;
      case "instrument_type":
        return a.instrument_type.localeCompare(b.instrument_type) * dir;
      case "bpm":
        return ((a.bpm ?? 0) - (b.bpm ?? 0)) * dir;
      case "duration":
        return (a.duration - b.duration) * dir;
      case "sample_rate":
        // sample_rate sort no longer exposed in UI headers, but keep logic
        // so external sort state remains functional.
        return ((a.sample_rate ?? 0) - (b.sample_rate ?? 0)) * dir;
      default:
        return 0;
    }
  });

  useEffect(() => {
    if (!listRef.current) return;
    // If a selectedSample exists, ensure it's scrolled into view.
    const el = listRef.current.querySelector<HTMLDivElement>(`.sample-row.active`);
    if (el) el.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [selectedSample]);

  // IntersectionObserver: load more when sentinel becomes visible
  useEffect(() => {
    const sentinel = sentinelRef.current;
    const root = listRef.current;
    if (!sentinel || !root || !onLoadMore) return;

    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            if (isLoadingMore) return;
            if (canLoadMore === false) return;
            // Fire and forget
            void onLoadMore();
          }
        }
      },
      { root, rootMargin: "200px", threshold: 0.1 }
    );

    obs.observe(sentinel);
    return () => obs.disconnect();
  }, [onLoadMore, isLoadingMore, canLoadMore]);

  // Optional: wire a simple Load More footer when the parent exposes the
  // dev helper on window.__osm_load_more. This avoids changing many call
  // sites at once while keeping the UI usable in dev mode.
  useEffect(() => {
    // noop - keep placeholder for future wiring
  }, []);

  // The actual load-more invocation is performed by the dev helper exposed on
  // window.__osm_load_more. We intentionally do not define an exported or
  // prop-driven handler here to keep this change minimally invasive; the
  // helper is attached by the App container during development.


  // Render the footer below the list when running in development to enable
  // quick manual testing of the pagination flow. We defer to the dev helper
  // exposed on window.__osm_load_more which performs the actual invocation.


  useImperativeHandle(ref, () => ({
    focusSelected: () => {
      if (!listRef.current) return;
      const el = listRef.current.querySelector<HTMLDivElement>(`.sample-row.active`);
      if (!el) return;
      // Make the element focusable, focus it, then remove the tabindex attribute.
      const prevTab = el.getAttribute("tabindex");
      el.setAttribute("tabindex", "-1");
      // Ensure DOM painted
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
  }));

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        position: "relative",
      }}
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div
        style={{
          padding: "10px 16px",
          borderBottom: "1px solid #0f1117",
          background: "#0a0c12",
          display: "flex",
          alignItems: "center",
          gap: "10px",
        }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#374151"
          strokeWidth="2"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.35-4.35" />
        </svg>
        <input
          value={filters.search}
          onChange={(e) => onFilterChange({ search: e.target.value })}
          placeholder="Search by filename, tag, key... (FTS5)"
          style={{
            flex: 1,
            fontSize: "16px",
            color: "#9ca3af",
            letterSpacing: "0.04em",
          }}
        />
        <span
          style={{
            fontSize: "14px",
            color: "#374151",
            letterSpacing: "0.1em",
          }}
        >
          {sorted.length}/{samples.length} RESULTS
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: colWidths.join(" "),
          padding: "6px 16px",
          borderBottom: "1px solid #0f1117",
          fontSize: "13px",
          letterSpacing: "0.14em",
          color: "#374151",
        }}
      >
        <div style={{ position: "relative" }} ref={(el) => (headerRefs.current[0] = el)} onMouseDown={(e) => {
          const el = headerRefs.current[0];
          if (!el) return;
          activeResize.current = { index: 0, startX: e.clientX, startWidth: el.getBoundingClientRect().width, wasDragging: false };
        }}>
          <SortHeader field="id" currentSort={sort} onSort={onSortChange} columnIndex={0} draggedColumnRef={draggedColumnRef}>#</SortHeader>
        </div>

          <div
            style={{ position: "relative" }}
            ref={(el) => (headerRefs.current[1] = el)}
            onMouseDown={(e) => {
              const el = headerRefs.current[1];
              if (!el) return;
              activeResize.current = { index: 1, startX: e.clientX, startWidth: el.getBoundingClientRect().width, wasDragging: false };
            }}
            onMouseMove={(e) => {
              const el = headerRefs.current[1];
              if (!el) return;
              const rect = el.getBoundingClientRect();
              // Consider the mouse "near the right edge" when within 10px of the right
              // (this allows hovering the small resizer which sits slightly outside).
              const near = Math.abs(rect.right - e.clientX) <= 10;
              setHoveredCol((h) => (near ? 1 : h === 1 ? null : h));
            }}
            onMouseLeave={() => setHoveredCol((h) => (h === 1 ? null : h))}
          >
          <SortHeader field="file_name" currentSort={sort} onSort={onSortChange} columnIndex={1} draggedColumnRef={draggedColumnRef}>FILENAME</SortHeader>
          <div style={{ position: "absolute", right: -6, top: 0, bottom: 0, display: "flex", alignItems: "center" }}>
            <div
              style={{
                width: hoveredCol === 1 ? 8 : 4,
                height: "70%",
                cursor: "col-resize",
                background: activeResize.current?.index === 1 || draggedColumnRef.current === 1 ? "#f97316" : hoveredCol === 1 ? "#374151" : "transparent",
                borderRadius: 2,
                transition: "width 0.12s, background 0.12s",
              }}
            />
          </div>
        </div>

          <div
            style={{ position: "relative" }}
            ref={(el) => (headerRefs.current[2] = el)}
            onMouseDown={(e) => {
              const el = headerRefs.current[2];
              if (!el) return;
              activeResize.current = { index: 2, startX: e.clientX, startWidth: el.getBoundingClientRect().width, wasDragging: false };
            }}
            onMouseMove={(e) => {
              const el = headerRefs.current[2];
              if (!el) return;
              const rect = el.getBoundingClientRect();
              const near = Math.abs(rect.right - e.clientX) <= 10;
              setHoveredCol((h) => (near ? 2 : h === 2 ? null : h));
            }}
            onMouseLeave={() => setHoveredCol((h) => (h === 2 ? null : h))}
          >
          <SortHeader field="sample_type" currentSort={sort} onSort={onSortChange} columnIndex={2} draggedColumnRef={draggedColumnRef}>TYPE</SortHeader>
          <div style={{ position: "absolute", right: -6, top: 0, bottom: 0, display: "flex", alignItems: "center" }}>
            <div
              style={{
                width: hoveredCol === 2 ? 8 : 4,
                height: "70%",
                cursor: "col-resize",
                background: activeResize.current?.index === 2 || draggedColumnRef.current === 2 ? "#f97316" : hoveredCol === 2 ? "#374151" : "transparent",
                borderRadius: 2,
                transition: "width 0.12s, background 0.12s",
              }}
            />
          </div>
        </div>

        <div
          style={{ position: "relative" }}
          ref={(el) => (headerRefs.current[3] = el)}
          onMouseDown={(e) => {
            const el = headerRefs.current[3];
            if (!el) return;
            activeResize.current = { index: 3, startX: e.clientX, startWidth: el.getBoundingClientRect().width, wasDragging: false };
          }}
          onMouseMove={(e) => {
            const el = headerRefs.current[3];
            if (!el) return;
            const rect = el.getBoundingClientRect();
            const near = Math.abs(rect.right - e.clientX) <= 10;
            setHoveredCol((h) => (near ? 3 : h === 3 ? null : h));
          }}
          onMouseLeave={() => setHoveredCol((h) => (h === 3 ? null : h))}
        >
          <SortHeader field="instrument_type" currentSort={sort} onSort={onSortChange} columnIndex={3} draggedColumnRef={draggedColumnRef}>INST</SortHeader>
          <div style={{ position: "absolute", right: -6, top: 0, bottom: 0, display: "flex", alignItems: "center" }}>
            <div
              style={{
                width: hoveredCol === 3 ? 8 : 4,
                height: "70%",
                cursor: "col-resize",
                background: activeResize.current?.index === 3 || draggedColumnRef.current === 3 ? "#f97316" : hoveredCol === 3 ? "#374151" : "transparent",
                borderRadius: 2,
                transition: "width 0.12s, background 0.12s",
              }}
            />
          </div>
        </div>

          <div
            style={{ position: "relative" }}
            ref={(el) => (headerRefs.current[4] = el)}
            onMouseDown={(e) => {
              const el = headerRefs.current[4];
              if (!el) return;
              activeResize.current = { index: 4, startX: e.clientX, startWidth: el.getBoundingClientRect().width, wasDragging: false };
            }}
            onMouseMove={(e) => {
              const el = headerRefs.current[4];
              if (!el) return;
              const rect = el.getBoundingClientRect();
              const near = Math.abs(rect.right - e.clientX) <= 10;
              setHoveredCol((h) => (near ? 4 : h === 4 ? null : h));
            }}
            onMouseLeave={() => setHoveredCol((h) => (h === 4 ? null : h))}
          >
          <SortHeader field="bpm" currentSort={sort} onSort={onSortChange} columnIndex={4} draggedColumnRef={draggedColumnRef}>BPM</SortHeader>
          <div style={{ position: "absolute", right: -6, top: 0, bottom: 0, display: "flex", alignItems: "center" }}>
            <div
              style={{
                width: hoveredCol === 4 ? 8 : 4,
                height: "70%",
                cursor: "col-resize",
                background: activeResize.current?.index === 4 || draggedColumnRef.current === 4 ? "#f97316" : hoveredCol === 4 ? "#374151" : "transparent",
                borderRadius: 2,
                transition: "width 0.12s, background 0.12s",
              }}
            />
          </div>
        </div>

          <div
            style={{ position: "relative" }}
            ref={(el) => (headerRefs.current[5] = el)}
            onMouseDown={(e) => {
              const el = headerRefs.current[5];
              if (!el) return;
              activeResize.current = { index: 5, startX: e.clientX, startWidth: el.getBoundingClientRect().width, wasDragging: false };
            }}
            onMouseMove={(e) => {
              const el = headerRefs.current[5];
              if (!el) return;
              const rect = el.getBoundingClientRect();
              const near = Math.abs(rect.right - e.clientX) <= 10;
              setHoveredCol((h) => (near ? 5 : h === 5 ? null : h));
            }}
            onMouseLeave={() => setHoveredCol((h) => (h === 5 ? null : h))}
          >
          <SortHeader field="duration" currentSort={sort} onSort={onSortChange} columnIndex={5} draggedColumnRef={draggedColumnRef}>DUR</SortHeader>
          <div style={{ position: "absolute", right: -6, top: 0, bottom: 0, display: "flex", alignItems: "center" }}>
            <div
              style={{
                width: hoveredCol === 5 ? 8 : 4,
                height: "70%",
                cursor: "col-resize",
                background: activeResize.current?.index === 5 || draggedColumnRef.current === 5 ? "#f97316" : hoveredCol === 5 ? "#374151" : "transparent",
                borderRadius: 2,
                transition: "width 0.12s, background 0.12s",
              }}
            />
          </div>
        </div>

          <div
            style={{ position: "relative" }}
            ref={(el) => (headerRefs.current[6] = el)}
            onMouseDown={(e) => {
              const el = headerRefs.current[6];
              if (!el) return;
              activeResize.current = { index: 6, startX: e.clientX, startWidth: el.getBoundingClientRect().width, wasDragging: false };
            }}
            onMouseMove={(e) => {
              const el = headerRefs.current[6];
              if (!el) return;
              const rect = el.getBoundingClientRect();
              const near = Math.abs(rect.right - e.clientX) <= 10;
              setHoveredCol((h) => (near ? 6 : h === 6 ? null : h));
            }}
            onMouseLeave={() => setHoveredCol((h) => (h === 6 ? null : h))}
          >
          <div />
          <div style={{ position: "absolute", right: -6, top: 0, bottom: 0, display: "flex", alignItems: "center" }}>
            <div
              style={{
                width: hoveredCol === 6 ? 8 : 4,
                height: "70%",
                cursor: "col-resize",
                background: activeResize.current?.index === 6 || draggedColumnRef.current === 6 ? "#f97316" : hoveredCol === 6 ? "#374151" : "transparent",
                borderRadius: 2,
                transition: "width 0.12s, background 0.12s",
              }}
            />
          </div>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          // Add bottom padding when a player/waveform is visible so the
          // last list item can be scrolled fully into view instead of
          // being clipped by the fixed-position PlayerBar at the bottom.
          // PlayerBar uses a fixed height of 160px; match that here.
          paddingBottom: selectedSample ? "160px" : undefined,
          boxSizing: "border-box",
        }}
        ref={listRef}
      >
        {(props.externalIsDragOver || isDragOver) && (
        <div
            role="status"
            aria-live="polite"
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "rgba(2,6,23,0.65)",
              zIndex: 40,
              pointerEvents: "none",
              transition: "opacity 160ms ease",
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
        {/* Scroll container reference used to focus selected sample when modal selection occurs */}
        {sorted.map((s, idx) => (
          <div
            key={s.id}
            className={`sample-row ${selectedSample?.id === s.id ? "active" : ""}`}
            draggable={!!samplePaths[s.id]}
            onMouseDown={(e) => {
              // Only prepare drag if we have a path and left mouse button
              if (!samplePaths[s.id] || e.button !== 0) return;
              
              // Track initial position to distinguish click from drag
              const startX = e.clientX;
              const startY = e.clientY;
              
              const handleMouseMove = (moveEvent: MouseEvent) => {
                const dx = Math.abs(moveEvent.clientX - startX);
                const dy = Math.abs(moveEvent.clientY - startY);
                
                // Only initiate drag if moved more than 5px (drag threshold)
                if (dx > 5 || dy > 5) {
                  // Remove listener to prevent multiple preparations
                  document.removeEventListener('mousemove', handleMouseMove);
                  document.removeEventListener('mouseup', handleMouseUp);
                  
                  // Now prepare and start the drag
                  (async () => {
                    const originalPath = samplePaths[s.id];
                    if (!originalPath) return;
                    try {
                      const prepared = await invoke("prepare_drag_file", { path: originalPath }).catch((e) => {
                        console.warn("prepare_drag_file failed:", e);
                        return null;
                      });
                      const p = typeof prepared === "string" ? prepared : String(prepared ?? "");
                      if (p) preparedPathsRef.current[s.id] = p;

                      const platformStr = ((navigator as any)?.platform || '') + (navigator.userAgent || '');
                      const isMac = /Mac|iPhone|iPad|Macintosh/.test(platformStr);
                      if (!isMac) return;

                      const usable = p || originalPath;
                      try {
                        await startDrag({
                          item: [usable],
                          icon: TRANSPARENT_PNG,
                        });
                      } catch (err) {
                        console.warn("[dragout-debug] startDrag failed:", err);
                      }
                    } catch (err) {
                      console.warn("onMouseDown handler error:", err);
                    }
                  })();
                }
              };
              
              const handleMouseUp = () => {
                // Clean up listeners if mouse released without moving enough to drag
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
              };
              
              document.addEventListener('mousemove', handleMouseMove);
              document.addEventListener('mouseup', handleMouseUp);
            }}
            onDragStart={(e) => {
              const originalPath = samplePaths[s.id];
              if (!originalPath) return;
              const prepared = preparedPathsRef.current[s.id];
              const usablePath = prepared ?? originalPath;

              // DAW compatible file:// URL (not Tauri asset URL)
              const isWindows = usablePath.match(/^[A-Z]:/);
              const fileUrl = isWindows
                ? `file:///${usablePath.replace(/\\/g, '/')}`
                : `file://${usablePath}`;
              try {
                e.dataTransfer.setData("text/uri-list", fileUrl);
                e.dataTransfer.setData("text/plain", fileUrl);
                e.dataTransfer.effectAllowed = "copy";
              } catch (e) {
                // Some platforms may restrict dataTransfer usage; ignore failures
              }
            }}
            onClick={() => onSampleSelect(s)}
            style={{
              display: "grid",
              gridTemplateColumns: colWidths.join(" "),
              padding: "8px 16px",
              borderBottom: "1px solid #0d0f16",
              borderLeft:
                selectedSample?.id === s.id
                  ? "2px solid #f97316"
                  : "2px solid transparent",
              background: selectedSample?.id === s.id ? "#111827" : "transparent",
              alignItems: "center",
              animation: `fadeIn 0.2s ease ${idx * 0.03}s both`,
              transition: "background 0.1s",
              cursor: samplePaths[s.id] ? "grab" : "default",
            }}
          >
            <div style={{ fontSize: "14px", color: "#374151" }}>{s.id}</div>
            <div>
              <div
                style={{
                  fontSize: "16px",
                  color: "#d1d5db",
                  letterSpacing: "0.02em",
                  marginBottom: "3px",
                }}
              >
                {s.file_name}
              </div>
              <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                {s.tags.map((t) => (
                  <span
                    key={t}
                    style={{
                      fontSize: "13px",
                      padding: "1px 4px",
                      background: "#0f1117",
                      color: "#4b5563",
                      border: "1px solid #1a1f2e",
                      borderRadius: "1px",
                    }}
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
            <div onMouseDown={(e) => e.stopPropagation()}>
              <TypeBadge type={s.sample_type} onClick={() => onTypeClick?.(s)} />
            </div>
            <div onMouseDown={(e) => e.stopPropagation()}>
              <span
                onClick={() => onTypeClick?.(s)}
                onMouseDown={(e) => e.stopPropagation()}
                style={{
                  fontSize: "10px",
                  fontFamily: "'Courier New', monospace",
                  fontWeight: 600,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "#f97316",
                  cursor: "pointer",
                }}
              >
                {s.instrument_type}
              </span>
            </div>
            <div
              style={{
                fontSize: "16px",
                color: s.bpm ? "#22d3ee" : "#374151",
                fontWeight: s.bpm ? 700 : 400,
              }}
            >
              {s.bpm ? `${Math.floor(s.bpm)}` : "-"}
            </div>
            <div style={{ fontSize: "16px", color: "#6b7280" }}>
              {s.duration.toFixed(2)}s
            </div>
            <div onMouseDown={(e) => e.stopPropagation()} style={{ display: "flex", gap: "6px", justifyContent: "center", position: "relative" }}>
              <button
                onMouseDown={(e) => e.stopPropagation()}
                onClick={async (e) => {
                  e.stopPropagation();
                  const path = samplePaths[s.id];
                  if (path) {
                    let folderPath = path;
                    const lastSlash = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
                    if (lastSlash > 0) {
                      folderPath = path.substring(0, lastSlash);
                    }
                    try {
                      await invoke("open_folder", { path: folderPath });
                    } catch (err) {
                      console.error("Failed to open folder:", err);
                    }
                  }
                }}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#6b7280",
                  cursor: "pointer",
                  padding: "4px",
                  fontSize: "14px",
                  transition: "color 0.15s, transform 0.15s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "#9ca3af";
                  e.currentTarget.style.transform = "scale(1.15)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "#6b7280";
                  e.currentTarget.style.transform = "scale(1)";
                }}
                title="Show in Finder"
              >
                📂
              </button>
              <button
                onMouseDown={(e) => e.stopPropagation()}
                onClick={async (e) => {
                  e.stopPropagation();
                  const path = samplePaths[s.id];
                  if (path) {
                    try {
                      await invoke("copy_to_clipboard", { text: path });
                      setToast({ message: "Path copied!", visible: true, sampleId: s.id });
                    } catch (err) {
                      console.error("Clipboard write failed:", err);
                      setToast({ message: "Copy failed", visible: true, sampleId: s.id });
                    }
                    setTimeout(() => {
                      setToast((prev) => ({ ...prev, visible: false, sampleId: null }));
                    }, 1500);
                  }
                }}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#6b7280",
                  cursor: "pointer",
                  padding: "4px",
                  fontSize: "14px",
                  transition: "color 0.15s, transform 0.15s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "#9ca3af";
                  e.currentTarget.style.transform = "scale(1.15)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "#6b7280";
                  e.currentTarget.style.transform = "scale(1)";
                }}
                title="Copy Full Path"
              >
                📋
              </button>
              {toast.visible && toast.sampleId === s.id && (
                <div
                  style={{
                    position: "absolute",
                    right: "60px",
                    background: "#1f2937",
                    color: "#22c55e",
                    padding: "4px 10px",
                    borderRadius: "4px",
                    fontSize: "11px",
                    fontFamily: "'Courier New', monospace",
                    zIndex: 100,
                    border: "1px solid #22c55e",
                    whiteSpace: "nowrap",
                    animation: "fadeIn 0.15s ease",
                  }}
                >
                  {toast.message}
                </div>
              )}
              <button
                onMouseDown={(e) => e.stopPropagation()}
                onClick={(e) => {
                  e.stopPropagation();
                  onTrashSample?.(s.id);
                }}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#ef4444",
                  cursor: "pointer",
                  padding: "4px",
                  fontSize: "14px",
                  transition: "color 0.15s, transform 0.15s",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = "#f87171";
                  e.currentTarget.style.transform = "scale(1.15)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "#ef4444";
                  e.currentTarget.style.transform = "scale(1)";
                }}
                title="Send to Trash"
              >
                🗑
              </button>
            </div>
          </div>
        ))}
        {/* Sentinel element observed by IntersectionObserver to trigger loading more */}
        <div
          ref={sentinelRef}
          aria-hidden
          style={{ height: 1, width: "100%", visibility: "hidden" }}
        />

        <div style={{ padding: "8px 16px", textAlign: "center", color: "#9ca3af" }}>
          {isLoadingMore ? (
            <div style={{ fontSize: 13 }}>Loading...</div>
          ) : canLoadMore === false ? (
            <div style={{ fontSize: 13 }}>No more results</div>
          ) : (
            // Provide a small manual trigger when parent exposes onLoadMore for debugging
            onLoadMore ? (
              <button
                type="button"
                onClick={() => {
                  void onLoadMore();
                }}
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
            ) : null
          )}
        </div>
      </div>
    </div>
  );
});
