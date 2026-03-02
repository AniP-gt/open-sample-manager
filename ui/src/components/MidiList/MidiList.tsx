import { startDrag } from "@crabnebula/tauri-plugin-drag";
import { useEffect, useImperativeHandle, useRef, forwardRef, useState } from "react";
import type { MidiTagRow } from "../../types/midi";
import { invoke } from "@tauri-apps/api/core";
// Reuse the robust extractor implemented for SampleList
import { extractPathsFromDataTransfer } from "../../utils/dataTransfer";
import type { Midi } from "../../types/midi";

// Minimal transparent PNG used as drag icon (same as SampleList)
const TRANSPARENT_PNG =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
 

interface MidiListProps {
  midis: Midi[];
  selectedMidi: Midi | null;
  onMidiSelect: (midi: Midi) => void;
  onTagBadgeClick?: (midi: Midi) => void;
  midiTags?: MidiTagRow[];
  onTagFilterChange?: (tagId: number | null) => void;
  tagFilterId?: number | null;
  onMidiTagChange?: (midiId: number, tagName: string | null) => void;
  // Optional: called when files/folders are dropped/imported from sidebar
  onImportPaths?: (paths: string[]) => void;
  // When running inside Tauri, the host may indicate a drag-over state
  externalIsDragOver?: boolean;
  // Pagination handlers
  onLoadMore?: () => Promise<void> | void;
  isLoadingMore?: boolean;
  canLoadMore?: boolean;
  // Called to request that a midi be sent to trash (parent handles actual deletion)
  onTrashMidi?: (id: number) => void;
  // Search
  midiSearch?: string;
  onMidiSearchChange?: (query: string) => void;
}

export type MidiListHandle = {
  focusSelected: () => void;
};

export const MidiList = forwardRef(function MidiList(
  { midis, selectedMidi, onMidiSelect, onTagBadgeClick, onLoadMore, isLoadingMore, canLoadMore, onTrashMidi, onImportPaths, externalIsDragOver, midiTags = [], onTagFilterChange, tagFilterId, midiSearch = "", onMidiSearchChange = () => {} }: MidiListProps,
  ref: React.Ref<MidiListHandle>,
) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [toast, setToast] = useState<{ message: string; visible: boolean; midiId: number | null }>({ message: "", visible: false, midiId: null });
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounter = useRef(0);
  // Prepared (backend-copied) paths for drag-out operations
  const preparedPathsRef = useRef<Record<number, string>>({});
  // Props accepted for API parity; reference them so TypeScript doesn't warn about unused vars
  // These are intentionally no-ops in this component because the detail panel is
  // rendered by the App container for consistent layout with the Sample detail.
  void midiTags;
  void onTagFilterChange;
  void tagFilterId;

  // Resizable columns state and helpers (mirror SampleList behavior)
  const [colWidths, setColWidths] = useState<string[]>(["36px", "1fr", "110px", "86px", "86px", "60px", "60px", "64px", "86px", "88px"]);
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
      const minWidths = [20, 120, 60, 60, 40, 40, 30, 40, 60, 40];
      const maxWidths = [400, 1600, 800, 800, 400, 400, 400, 400, 800, 400];
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

  
  // Client-side filter by filename
  const filteredMidis = midiSearch.trim()
    ? midis.filter((m) => m.file_name.toLowerCase().includes(midiSearch.toLowerCase()))
    : midis;

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
            void onLoadMore();
          }
        }
      },
      // Only trigger when the sentinel is fully within view (i.e. scrolled to the bottom)
      { root, rootMargin: "0px", threshold: 1.0 }
    );

    obs.observe(sentinel);
    return () => obs.disconnect();
  }, [onLoadMore, isLoadingMore, canLoadMore]);

  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector<HTMLTableRowElement>("tr.midi-row.active");
    if (el && typeof el.scrollIntoView === "function") {
      el.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [selectedMidi]);

  useImperativeHandle(ref, () => ({
    focusSelected: () => {
      if (!listRef.current) return;
      const el = listRef.current.querySelector<HTMLTableRowElement>("tr.midi-row.active");
      if (!el) return;
      if (typeof el.scrollIntoView === "function") {
        el.scrollIntoView({ block: "center", behavior: "smooth" });
      }
    },
  }));

  if (midis.length === 0) {
    return (
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#6b7280",
          fontSize: "14px",
          fontFamily: "'Courier New', monospace",
        }}
      >
        No MIDI files indexed. Switch to Sample List or scan a directory containing MIDI files.
      </div>
    );
  }

  

  return (
    <div
      ref={listRef}
      data-testid="midi-list-root"
      style={{
        flex: 1,
        overflowY: "auto",
        background: "#0a0c12",
        position: "relative",
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
      

      {/* Render a SampleList-like grid for MIDI rows to match appearance.
          Keep the original table markup wrapped in a disabled conditional
          so tests and existing code paths remain available for reference. */}
      {(() => {
        return (
          <>
            {/* Search bar — mirrors SampleList search form */}
            <div style={{ padding: "10px 16px", borderBottom: "1px solid #0f1117", background: "#0a0c12", display: "flex", alignItems: "center", gap: "10px", flexShrink: 0 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" />
              </svg>
              <input
                value={midiSearch}
                onChange={(e) => onMidiSearchChange(e.target.value)}
                placeholder="Search by filename..."
                style={{ flex: 1, fontSize: "16px", color: "#9ca3af", letterSpacing: "0.04em", background: "transparent", border: "none", outline: "none", fontFamily: "'Courier New', monospace" }}
              />
              <span style={{ fontSize: "14px", color: "#374151", letterSpacing: "0.1em" }}>
                {filteredMidis.length}/{midis.length} RESULTS
              </span>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: colWidths.join(" "),
                padding: "6px 12px",
                borderBottom: "1px solid #0f1117",
                fontSize: "13px",
                letterSpacing: "0.14em",
                color: "#374151",
                alignItems: "center",
              }}
            >
              <div style={{ position: "relative", cursor: hoveredCol === 0 ? "col-resize" : undefined }} ref={(el) => (headerRefs.current[0] = el)} onMouseDown={(e) => { const el = headerRefs.current[0]; if (!el) return; activeResize.current = { index: 0, startX: e.clientX, startWidth: el.getBoundingClientRect().width, wasDragging: false }; }} onMouseMove={(e) => { const el = headerRefs.current[0]; if (!el) return; const rect = el.getBoundingClientRect(); const near = Math.abs(rect.right - e.clientX) <= 10; setHoveredCol((h) => (near ? 0 : h === 0 ? null : h)); }} onMouseLeave={() => setHoveredCol((h) => (h === 0 ? null : h))}>
                <div style={{ fontSize: 13, color: "#374151" }}>#</div>
                <div style={{ position: "absolute", right: -6, top: 0, bottom: 0, display: "flex", alignItems: "center" }}>
                  <div title="Resize column" style={{ width: hoveredCol === 0 ? 8 : 4, height: "70%", cursor: "col-resize", background: activeResize.current?.index === 0 || draggedColumnRef.current === 0 ? "#f97316" : hoveredCol === 0 ? "#374151" : "transparent", borderRadius: 2, transition: "width 0.12s, background 0.12s" }} />
                </div>
              </div>

              <div style={{ position: "relative", cursor: hoveredCol === 1 ? "col-resize" : undefined }} ref={(el) => (headerRefs.current[1] = el)} onMouseDown={(e) => { const el = headerRefs.current[1]; if (!el) return; activeResize.current = { index: 1, startX: e.clientX, startWidth: el.getBoundingClientRect().width, wasDragging: false }; }} onMouseMove={(e) => { const el = headerRefs.current[1]; if (!el) return; const rect = el.getBoundingClientRect(); const near = Math.abs(rect.right - e.clientX) <= 10; setHoveredCol((h) => (near ? 1 : h === 1 ? null : h)); }} onMouseLeave={() => setHoveredCol((h) => (h === 1 ? null : h))}>
                <div style={{ fontSize: 13, color: "#9ca3af", letterSpacing: "0.06em" }}>FILENAME</div>
                <div style={{ position: "absolute", right: -6, top: 0, bottom: 0, display: "flex", alignItems: "center" }}>
                  <div title="Resize column" style={{ width: hoveredCol === 1 ? 8 : 4, height: "70%", cursor: "col-resize", background: activeResize.current?.index === 1 || draggedColumnRef.current === 1 ? "#f97316" : hoveredCol === 1 ? "#374151" : "transparent", borderRadius: 2, transition: "width 0.12s, background 0.12s" }} />
                </div>
              </div>

        <div style={{ position: "relative", cursor: hoveredCol === 2 ? "col-resize" : undefined }} ref={(el) => (headerRefs.current[2] = el)} onMouseDown={(e) => { const el = headerRefs.current[2]; if (!el) return; activeResize.current = { index: 2, startX: e.clientX, startWidth: el.getBoundingClientRect().width, wasDragging: false }; }} onMouseMove={(e) => { const el = headerRefs.current[2]; if (!el) return; const rect = el.getBoundingClientRect(); const near = Math.abs(rect.right - e.clientX) <= 10; setHoveredCol((h) => (near ? 2 : h === 2 ? null : h)); }} onMouseLeave={() => setHoveredCol((h) => (h === 2 ? null : h))}>
                <div style={{ fontSize: 13, color: "#9ca3af" }}>TAG</div>
                <div style={{ position: "absolute", right: -6, top: 0, bottom: 0, display: "flex", alignItems: "center" }}>
                  <div title="Resize column" style={{ width: hoveredCol === 2 ? 8 : 4, height: "70%", cursor: "col-resize", background: activeResize.current?.index === 2 || draggedColumnRef.current === 2 ? "#f97316" : hoveredCol === 2 ? "#374151" : "transparent", borderRadius: 2, transition: "width 0.12s, background 0.12s" }} />
                </div>
              </div>

              <div style={{ position: "relative", cursor: hoveredCol === 3 ? "col-resize" : undefined }} ref={(el) => (headerRefs.current[3] = el)} onMouseDown={(e) => { const el = headerRefs.current[3]; if (!el) return; activeResize.current = { index: 3, startX: e.clientX, startWidth: el.getBoundingClientRect().width, wasDragging: false }; }} onMouseMove={(e) => { const el = headerRefs.current[3]; if (!el) return; const rect = el.getBoundingClientRect(); const near = Math.abs(rect.right - e.clientX) <= 10; setHoveredCol((h) => (near ? 3 : h === 3 ? null : h)); }} onMouseLeave={() => setHoveredCol((h) => (h === 3 ? null : h))}>
                <div style={{ fontSize: 13, color: "#9ca3af", textAlign: "right" }}>TEMPO</div>
                <div style={{ position: "absolute", right: -6, top: 0, bottom: 0, display: "flex", alignItems: "center" }}>
                  <div title="Resize column" style={{ width: hoveredCol === 3 ? 8 : 4, height: "70%", cursor: "col-resize", background: activeResize.current?.index === 3 || draggedColumnRef.current === 3 ? "#f97316" : hoveredCol === 3 ? "#374151" : "transparent", borderRadius: 2, transition: "width 0.12s, background 0.12s" }} />
                </div>
              </div>

              <div style={{ position: "relative", cursor: hoveredCol === 4 ? "col-resize" : undefined }} ref={(el) => (headerRefs.current[4] = el)} onMouseDown={(e) => { const el = headerRefs.current[4]; if (!el) return; activeResize.current = { index: 4, startX: e.clientX, startWidth: el.getBoundingClientRect().width, wasDragging: false }; }} onMouseMove={(e) => { const el = headerRefs.current[4]; if (!el) return; const rect = el.getBoundingClientRect(); const near = Math.abs(rect.right - e.clientX) <= 10; setHoveredCol((h) => (near ? 4 : h === 4 ? null : h)); }} onMouseLeave={() => setHoveredCol((h) => (h === 4 ? null : h))}>
                <div style={{ fontSize: 13, color: "#9ca3af", textAlign: "center" }}>TIME SIG</div>
                <div style={{ position: "absolute", right: -6, top: 0, bottom: 0, display: "flex", alignItems: "center" }}>
                  <div title="Resize column" style={{ width: hoveredCol === 4 ? 8 : 4, height: "70%", cursor: "col-resize", background: activeResize.current?.index === 4 || draggedColumnRef.current === 4 ? "#f97316" : hoveredCol === 4 ? "#374151" : "transparent", borderRadius: 2, transition: "width 0.12s, background 0.12s" }} />
                </div>
              </div>

              <div style={{ position: "relative", cursor: hoveredCol === 5 ? "col-resize" : undefined }} ref={(el) => (headerRefs.current[5] = el)} onMouseDown={(e) => { const el = headerRefs.current[5]; if (!el) return; activeResize.current = { index: 5, startX: e.clientX, startWidth: el.getBoundingClientRect().width, wasDragging: false }; }} onMouseMove={(e) => { const el = headerRefs.current[5]; if (!el) return; const rect = el.getBoundingClientRect(); const near = Math.abs(rect.right - e.clientX) <= 10; setHoveredCol((h) => (near ? 5 : h === 5 ? null : h)); }} onMouseLeave={() => setHoveredCol((h) => (h === 5 ? null : h))}>
                <div style={{ fontSize: 13, color: "#9ca3af", textAlign: "right" }}>TRACKS</div>
                <div style={{ position: "absolute", right: -6, top: 0, bottom: 0, display: "flex", alignItems: "center" }}>
                  <div title="Resize column" style={{ width: hoveredCol === 5 ? 8 : 4, height: "70%", cursor: "col-resize", background: activeResize.current?.index === 5 || draggedColumnRef.current === 5 ? "#f97316" : hoveredCol === 5 ? "#374151" : "transparent", borderRadius: 2, transition: "width 0.12s, background 0.12s" }} />
                </div>
              </div>

              <div style={{ position: "relative", cursor: hoveredCol === 6 ? "col-resize" : undefined }} ref={(el) => (headerRefs.current[6] = el)} onMouseDown={(e) => { const el = headerRefs.current[6]; if (!el) return; activeResize.current = { index: 6, startX: e.clientX, startWidth: el.getBoundingClientRect().width, wasDragging: false }; }} onMouseMove={(e) => { const el = headerRefs.current[6]; if (!el) return; const rect = el.getBoundingClientRect(); const near = Math.abs(rect.right - e.clientX) <= 10; setHoveredCol((h) => (near ? 6 : h === 6 ? null : h)); }} onMouseLeave={() => setHoveredCol((h) => (h === 6 ? null : h))}>
                <div style={{ fontSize: 13, color: "#9ca3af", textAlign: "right" }}>NOTES</div>
                <div style={{ position: "absolute", right: -6, top: 0, bottom: 0, display: "flex", alignItems: "center" }}>
                  <div title="Resize column" style={{ width: hoveredCol === 6 ? 8 : 4, height: "70%", cursor: "col-resize", background: activeResize.current?.index === 6 || draggedColumnRef.current === 6 ? "#f97316" : hoveredCol === 6 ? "#374151" : "transparent", borderRadius: 2, transition: "width 0.12s, background 0.12s" }} />
                </div>
              </div>

              <div style={{ position: "relative", cursor: hoveredCol === 7 ? "col-resize" : undefined }} ref={(el) => (headerRefs.current[7] = el)} onMouseDown={(e) => { const el = headerRefs.current[7]; if (!el) return; activeResize.current = { index: 7, startX: e.clientX, startWidth: el.getBoundingClientRect().width, wasDragging: false }; }} onMouseMove={(e) => { const el = headerRefs.current[7]; if (!el) return; const rect = el.getBoundingClientRect(); const near = Math.abs(rect.right - e.clientX) <= 10; setHoveredCol((h) => (near ? 7 : h === 7 ? null : h)); }} onMouseLeave={() => setHoveredCol((h) => (h === 7 ? null : h))}>
                <div style={{ fontSize: 13, color: "#9ca3af", textAlign: "center" }}>KEY</div>
                <div style={{ position: "absolute", right: -6, top: 0, bottom: 0, display: "flex", alignItems: "center" }}>
                  <div title="Resize column" style={{ width: hoveredCol === 7 ? 8 : 4, height: "70%", cursor: "col-resize", background: activeResize.current?.index === 7 || draggedColumnRef.current === 7 ? "#f97316" : hoveredCol === 7 ? "#374151" : "transparent", borderRadius: 2, transition: "width 0.12s, background 0.12s" }} />
                </div>
              </div>

              <div style={{ position: "relative", cursor: hoveredCol === 8 ? "col-resize" : undefined }} ref={(el) => (headerRefs.current[8] = el)} onMouseDown={(e) => { const el = headerRefs.current[8]; if (!el) return; activeResize.current = { index: 8, startX: e.clientX, startWidth: el.getBoundingClientRect().width, wasDragging: false }; }} onMouseMove={(e) => { const el = headerRefs.current[8]; if (!el) return; const rect = el.getBoundingClientRect(); const near = Math.abs(rect.right - e.clientX) <= 10; setHoveredCol((h) => (near ? 8 : h === 8 ? null : h)); }} onMouseLeave={() => setHoveredCol((h) => (h === 8 ? null : h))}>
                <div style={{ fontSize: 13, color: "#9ca3af", textAlign: "right" }}>DURATION</div>
                <div style={{ position: "absolute", right: -6, top: 0, bottom: 0, display: "flex", alignItems: "center" }}>
                  <div title="Resize column" style={{ width: hoveredCol === 8 ? 8 : 4, height: "70%", cursor: "col-resize", background: activeResize.current?.index === 8 || draggedColumnRef.current === 8 ? "#f97316" : hoveredCol === 8 ? "#374151" : "transparent", borderRadius: 2, transition: "width 0.12s, background 0.12s" }} />
                </div>
              </div>

              <div style={{ position: "relative", cursor: hoveredCol === 9 ? "col-resize" : undefined }} ref={(el) => (headerRefs.current[9] = el)} onMouseDown={(e) => { const el = headerRefs.current[9]; if (!el) return; activeResize.current = { index: 9, startX: e.clientX, startWidth: el.getBoundingClientRect().width, wasDragging: false }; }} onMouseMove={(e) => { const el = headerRefs.current[9]; if (!el) return; const rect = el.getBoundingClientRect(); const near = Math.abs(rect.right - e.clientX) <= 10; setHoveredCol((h) => (near ? 9 : h === 9 ? null : h)); }} onMouseLeave={() => setHoveredCol((h) => (h === 9 ? null : h))}>
                <div />
                <div style={{ position: "absolute", right: -6, top: 0, bottom: 0, display: "flex", alignItems: "center" }}>
                  <div title="Resize column" style={{ width: hoveredCol === 9 ? 8 : 4, height: "70%", cursor: "col-resize", background: activeResize.current?.index === 9 || draggedColumnRef.current === 9 ? "#f97316" : hoveredCol === 9 ? "#374151" : "transparent", borderRadius: 2, transition: "width 0.12s, background 0.12s" }} />
                </div>
              </div>
            </div>

            <div style={{ flex: 1, overflowY: "auto", boxSizing: "border-box" }}>
      {/* Right-side detail panel moved to App for consistent layout with Sample DetailPanel */}
              {filteredMidis.length === 0 && midiSearch.trim() ? (
                <div style={{ padding: "24px 16px", color: "#6b7280", fontSize: "13px", fontFamily: "'Courier New', monospace" }}>
                  No results for &apos;{midiSearch}&apos;
                </div>
              ) : filteredMidis.map((midi, idx) => {
                const isSelected = selectedMidi?.id === midi.id;
                return (
                  <div
                    key={midi.id}
                    className={`midi-row ${isSelected ? "active" : ""}`}
                    draggable={!!midi.path}
                    onClick={() => onMidiSelect(midi)}
                    onMouseDown={(e) => {
                      if (!midi.path || e.button !== 0) return;
                      const startX = e.clientX;
                      const startY = e.clientY;
                      const handleMouseMove = (moveEvent: MouseEvent) => {
                        const dx = Math.abs(moveEvent.clientX - startX);
                        const dy = Math.abs(moveEvent.clientY - startY);
                        if (dx > 5 || dy > 5) {
                          document.removeEventListener("mousemove", handleMouseMove);
                          document.removeEventListener("mouseup", handleMouseUp);
                          (async () => {
                            const originalPath = midi.path;
                            if (!originalPath) return;
                            try {
                              const prepared = await invoke("prepare_drag_file", { path: originalPath }).catch((err) => {
                                console.warn("prepare_drag_file failed:", err);
                                return null;
                              });
                              const p = typeof prepared === "string" ? prepared : String(prepared ?? "");
                              if (p) preparedPathsRef.current[midi.id] = p;
                              const platformStr = ((navigator as any)?.platform || "") + (navigator.userAgent || "");
                              const isMac = /Mac|iPhone|iPad|Macintosh/.test(platformStr);
                              if (!isMac) return;
                              const usable = p || originalPath;
                              try {
                                await startDrag({ item: [usable], icon: TRANSPARENT_PNG });
                              } catch (err) {
                                console.warn("[midi-dragout] startDrag failed:", err);
                              }
                            } catch (err) {
                              console.warn("onMouseDown handler error:", err);
                            }
                          })();
                        }
                      };
                      const handleMouseUp = () => {
                        document.removeEventListener("mousemove", handleMouseMove);
                        document.removeEventListener("mouseup", handleMouseUp);
                      };
                      document.addEventListener("mousemove", handleMouseMove);
                      document.addEventListener("mouseup", handleMouseUp);
                    }}
                    onDragStart={(e) => {
                      const originalPath = midi.path;
                      if (!originalPath) return;
                      const prepared = preparedPathsRef.current[midi.id];
                      const usablePath = prepared ?? originalPath;
                      const isWindows = usablePath.match(/^[A-Z]:/);
                      const fileUrl = isWindows ? `file:///${usablePath.replace(/\\/g, "/")}` : `file://${usablePath}`;
                      try {
                        e.dataTransfer.setData("text/uri-list", fileUrl);
                        e.dataTransfer.setData("text/plain", fileUrl);
                        e.dataTransfer.effectAllowed = "copy";
                      } catch {}
                    }}
                    style={{
                      display: "grid",
                      gridTemplateColumns: colWidths.join(" "),
                      padding: "8px 12px",
                      borderBottom: "1px solid #0d0f16",
                      borderLeft: isSelected ? "2px solid #f97316" : "2px solid transparent",
                      background: isSelected ? "#111827" : "transparent",
                      alignItems: "center",
                      animation: `fadeIn 0.2s ease ${idx * 0.02}s both`,
                      transition: "background 0.1s",
                      cursor: midi.path ? "grab" : "default",
                    }}
                  >
                    <div style={{ fontSize: "14px", color: "#374151" }}>{midi.id}</div>
                    <div>
                      <div style={{ fontSize: "16px", color: "#d1d5db", letterSpacing: "0.02em", marginBottom: 3, wordBreak: "break-word" }}>{midi.file_name}</div>
                    </div>
                    <div onClick={(e) => { e.stopPropagation(); onTagBadgeClick?.(midi); }}>
                      <span style={{ display: "inline-block", background: midi.tag_name ? "#22d3ee18" : "transparent", border: `1px solid ${midi.tag_name ? "#22d3ee55" : "#1a1f2e"}`, borderRadius: 2, color: midi.tag_name ? "#22d3ee" : "#4b5563", fontSize: 11, fontFamily: "'Courier New', monospace", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase", padding: "3px 8px", cursor: "pointer", minWidth: 64, textAlign: "center" }}>{midi.tag_name || "+ tag"}</span>
                    </div>
                    <div style={{ fontSize: 14, color: midi.tempo ? "#22d3ee" : "#374151", textAlign: "right", fontWeight: midi.tempo ? 700 : 400 }}>{midi.tempo ? `${midi.tempo.toFixed(1)} BPM` : "—"}</div>
                    <div style={{ fontSize: 14, color: "#9ca3af", textAlign: "center" }}>{midi.time_signature_numerator}/{midi.time_signature_denominator}</div>
                    <div style={{ fontSize: 14, color: "#a78bfa", textAlign: "right" }}>{midi.track_count ?? "—"}</div>
                    <div style={{ fontSize: 14, color: "#34d399", textAlign: "right" }}>{midi.note_count ?? "—"}</div>
                    <div style={{ fontSize: 14, color: "#fbbf24", textAlign: "center" }}>{midi.key_estimate ?? "—"}</div>
                    <div style={{ fontSize: 14, color: "#9ca3af", textAlign: "right" }}>{midi.duration ? formatDuration(midi.duration) : "—"}</div>
                    <div style={{ display: "flex", gap: 6, justifyContent: "center", position: "relative" }} onMouseDown={(e) => e.stopPropagation()}>
                      <button
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={async (e) => {
                          e.stopPropagation();
                          const path = midi.path;
                          if (path) {
                            let folderPath = path;
                            const lastSlash = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
                            if (lastSlash > 0) folderPath = path.substring(0, lastSlash);
                            try { await invoke("open_folder", { path: folderPath }); } catch (err) { console.error("Failed to open folder:", err); }
                          }
                        }}
                        style={{ background: "transparent", border: "none", color: "#6b7280", cursor: "pointer", padding: "4px", fontSize: "14px", transition: "color 0.15s, transform 0.15s" }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = "#9ca3af"; e.currentTarget.style.transform = "scale(1.15)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = "#6b7280"; e.currentTarget.style.transform = "scale(1)"; }}
                        title="Show in Finder"
                      >📂</button>
                      <button
                        onMouseDown={(e) => e.stopPropagation()}
                        onClick={async (e) => {
                          e.stopPropagation();
                          const path = midi.path;
                          if (path) {
                            try { await invoke("copy_to_clipboard", { text: path }); setToast({ message: "Path copied!", visible: true, midiId: midi.id }); }
                            catch (err) { console.error("Clipboard write failed:", err); setToast({ message: "Copy failed", visible: true, midiId: midi.id }); }
                            setTimeout(() => setToast((p) => ({ ...p, visible: false, midiId: null })), 1500);
                          }
                        }}
                        style={{ background: "transparent", border: "none", color: "#6b7280", cursor: "pointer", padding: "4px", fontSize: "14px", transition: "color 0.15s, transform 0.15s" }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = "#9ca3af"; e.currentTarget.style.transform = "scale(1.15)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = "#6b7280"; e.currentTarget.style.transform = "scale(1)"; }}
                        title="Copy Full Path"
                      >📋</button>
                      {toast.visible && toast.midiId === midi.id && (
                        <div style={{ position: "absolute", right: "60px", background: "#1f2937", color: "#22c55e", padding: "4px 10px", borderRadius: 4, fontSize: 11, fontFamily: "'Courier New', monospace", zIndex: 100, border: "1px solid #22c55e", whiteSpace: "nowrap", animation: "fadeIn 0.15s ease" }}>{toast.message}</div>
                      )}
                      <button onMouseDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onTrashMidi?.(midi.id); }} style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer", padding: "4px", fontSize: "14px", transition: "color 0.15s, transform 0.15s" }} onMouseEnter={(e) => { e.currentTarget.style.color = "#f87171"; e.currentTarget.style.transform = "scale(1.15)"; }} onMouseLeave={(e) => { e.currentTarget.style.color = "#ef4444"; e.currentTarget.style.transform = "scale(1)"; }} title="Send to Trash">🗑</button>
                    </div>
                  </div>
                );
              })}

              <div ref={sentinelRef} aria-hidden style={{ height: 1, width: "100%", visibility: "hidden" }} />
            </div>
          </>
        );
      })()}

      {false && (
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: "12px",
          fontFamily: "'Courier New', monospace",
        }}
      >
        <thead
          style={{
            position: "sticky",
            top: 0,
            background: "#1f2937",
            zIndex: 1,
          }}
        >
          <tr>
            <th style={{ padding: "8px 12px", textAlign: "left", color: "#9ca3af", borderBottom: "1px solid #374151" }}>
              FILE NAME
            </th>
            <th style={{ padding: "8px 12px", textAlign: "left", color: "#9ca3af", borderBottom: "1px solid #374151" }}>
              TAG
            </th>
            <th style={{ padding: "8px 12px", textAlign: "right", color: "#9ca3af", borderBottom: "1px solid #374151" }}>
              TEMPO
            </th>
            <th style={{ padding: "8px 12px", textAlign: "center", color: "#9ca3af", borderBottom: "1px solid #374151" }}>
              TIME SIG
            </th>
            <th style={{ padding: "8px 12px", textAlign: "right", color: "#9ca3af", borderBottom: "1px solid #374151" }}>
              TRACKS
            </th>
            <th style={{ padding: "8px 12px", textAlign: "right", color: "#9ca3af", borderBottom: "1px solid #374151" }}>
              NOTES
            </th>
            <th style={{ padding: "8px 12px", textAlign: "center", color: "#9ca3af", borderBottom: "1px solid #374151" }}>
              KEY
            </th>
            <th style={{ padding: "8px 12px", textAlign: "right", color: "#9ca3af", borderBottom: "1px solid #374151" }}>
              DURATION
            </th>
            <th style={{ padding: "8px 12px", textAlign: "center", color: "#9ca3af", borderBottom: "1px solid #374151" }}>
              
            </th>
          </tr>
        </thead>
        <tbody>
          {midis.map((midi) => {
            const isSelected = selectedMidi?.id === midi.id;
            return (
              <tr
                key={midi.id}
                className={`midi-row ${isSelected ? "active" : ""}`}
                onClick={() => onMidiSelect(midi)}
                style={{
                  background: isSelected ? "#3b82f620" : "transparent",
                  cursor: midi.path ? "grab" : "pointer",
                  transition: "background 0.1s ease",
                }}
                draggable={!!midi.path}
                onMouseDown={(e) => {
                  if (!midi.path || e.button !== 0) return;
                  const startX = e.clientX;
                  const startY = e.clientY;
                  const handleMouseMove = (moveEvent: MouseEvent) => {
                    const dx = Math.abs(moveEvent.clientX - startX);
                    const dy = Math.abs(moveEvent.clientY - startY);
                    if (dx > 5 || dy > 5) {
                      document.removeEventListener('mousemove', handleMouseMove);
                      document.removeEventListener('mouseup', handleMouseUp);
                      (async () => {
                        const originalPath = midi.path;
                        if (!originalPath) return;
                        try {
                          const prepared = await invoke("prepare_drag_file", { path: originalPath }).catch((err) => {
                            console.warn("prepare_drag_file failed:", err);
                            return null;
                          });
                          const p = typeof prepared === "string" ? prepared : String(prepared ?? "");
                          if (p) preparedPathsRef.current[midi.id] = p;
                          const platformStr = ((navigator as any)?.platform || '') + (navigator.userAgent || '');
                          const isMac = /Mac|iPhone|iPad|Macintosh/.test(platformStr);
                          if (!isMac) return;
                          const usable = p || originalPath;
                          try {
                            await startDrag({ item: [usable], icon: TRANSPARENT_PNG });
                          } catch (err) {
                            console.warn("[midi-dragout] startDrag failed:", err);
                          }
                        } catch (err) {
                          console.warn("onMouseDown handler error:", err);
                        }
                      })();
                    }
                  };
                  const handleMouseUp = () => {
                    document.removeEventListener('mousemove', handleMouseMove);
                    document.removeEventListener('mouseup', handleMouseUp);
                  };
                  document.addEventListener('mousemove', handleMouseMove);
                  document.addEventListener('mouseup', handleMouseUp);
                }}
                onDragStart={(e) => {
                  const originalPath = midi.path;
                  if (!originalPath) return;
                  const prepared = preparedPathsRef.current[midi.id];
                  const usablePath = prepared ?? originalPath;
                  const isWindows = usablePath.match(/^[A-Z]:/);
                  const fileUrl = isWindows
                    ? `file:///${usablePath.replace(/\\/g, '/')}`
                    : `file://${usablePath}`;
                  try {
                    e.dataTransfer.setData("text/uri-list", fileUrl);
                    e.dataTransfer.setData("text/plain", fileUrl);
                    e.dataTransfer.effectAllowed = "copy";
                  } catch {}
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.background = "#1f2937";
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) e.currentTarget.style.background = "transparent";
                }}
              >
                <td style={{ padding: "8px 12px", color: "#e2e8f0", borderBottom: "1px solid #1f2937" }}>
                  {midi.file_name}
                </td>
                <td
                  style={{ padding: "8px 8px", borderBottom: "1px solid #1f2937" }}
                  onClick={(e) => { e.stopPropagation(); onTagBadgeClick?.(midi); }}
                >
                  <span
                    style={{
                      display: "inline-block",
                      background: midi.tag_name ? "#22d3ee18" : "transparent",
                      border: `1px solid ${midi.tag_name ? "#22d3ee55" : "#1f2937"}`,
                      borderRadius: "2px",
                      color: midi.tag_name ? "#22d3ee" : "#4b5563",
                      fontSize: "11px",
                      fontFamily: "'Courier New', monospace",
                      fontWeight: 600,
                      letterSpacing: "0.05em",
                      textTransform: "uppercase",
                      padding: "3px 8px",
                      cursor: "pointer",
                      minWidth: "64px",
                      textAlign: "center",
                    }}
                  >
                    {midi.tag_name || "+ tag"}
                  </span>
                </td>
                <td style={{ padding: "8px 12px", color: "#22d3ee", textAlign: "right", borderBottom: "1px solid #1f2937" }}>
                  {midi.tempo ? `${midi.tempo.toFixed(1)} BPM` : "—"}
                </td>
                <td style={{ padding: "8px 12px", color: "#9ca3af", textAlign: "center", borderBottom: "1px solid #1f2937" }}>
                  {midi.time_signature_numerator}/{midi.time_signature_denominator}
                </td>
                <td style={{ padding: "8px 12px", color: "#a78bfa", textAlign: "right", borderBottom: "1px solid #1f2937" }}>
                  {midi.track_count ?? "—"}
                </td>
                <td style={{ padding: "8px 12px", color: "#34d399", textAlign: "right", borderBottom: "1px solid #1f2937" }}>
                  {midi.note_count ?? "—"}
                </td>
                <td style={{ padding: "8px 12px", color: "#fbbf24", textAlign: "center", borderBottom: "1px solid #1f2937" }}>
                  {midi.key_estimate ?? "—"}
                </td>
                <td style={{ padding: "8px 12px", color: "#9ca3af", textAlign: "right", borderBottom: "1px solid #1f2937" }}>
                  {midi.duration ? formatDuration(midi.duration) : "—"}
                </td>
                <td style={{ padding: "8px 12px", borderBottom: "1px solid #1f2937", display: "flex", gap: 6, justifyContent: "center", position: "relative" }} onMouseDown={(e) => e.stopPropagation()}>
                  <button
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={async (e) => {
                      e.stopPropagation();
                      const path = midi.path;
                      if (path) {
                        let folderPath = path;
                        const lastSlash = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\\\"));
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
                    style={{ background: "transparent", border: "none", color: "#6b7280", cursor: "pointer", padding: "4px", fontSize: "14px", transition: "color 0.15s, transform 0.15s" }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = "#9ca3af"; e.currentTarget.style.transform = "scale(1.15)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = "#6b7280"; e.currentTarget.style.transform = "scale(1)"; }}
                    title="Show in Finder"
                  >
                    📂
                  </button>
                  <button
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={async (e) => {
                      e.stopPropagation();
                      const path = midi.path;
                      if (path) {
                        try {
                          await invoke("copy_to_clipboard", { text: path });
                          setToast({ message: "Path copied!", visible: true, midiId: midi.id });
                        } catch (err) {
                          console.error("Clipboard write failed:", err);
                          setToast({ message: "Copy failed", visible: true, midiId: midi.id });
                        }
                        setTimeout(() => {
                          setToast((prev) => ({ ...prev, visible: false, midiId: null }));
                        }, 1500);
                      }
                    }}
                    style={{ background: "transparent", border: "none", color: "#6b7280", cursor: "pointer", padding: "4px", fontSize: "14px", transition: "color 0.15s, transform 0.15s" }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = "#9ca3af"; e.currentTarget.style.transform = "scale(1.15)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = "#6b7280"; e.currentTarget.style.transform = "scale(1)"; }}
                    title="Copy Full Path"
                  >
                    📋
                  </button>
                  {toast.visible && toast.midiId === midi.id && (
                    <div style={{ position: "absolute", right: "60px", background: "#1f2937", color: "#22c55e", padding: "4px 10px", borderRadius: "4px", fontSize: "11px", fontFamily: "'Courier New', monospace", zIndex: 100, border: "1px solid #22c55e", whiteSpace: "nowrap", animation: "fadeIn 0.15s ease" }}>
                      {toast.message}
                    </div>
                  )}
                  <button
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      onTrashMidi?.(midi.id);
                    }}
                    style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer", padding: "4px", fontSize: "14px", transition: "color 0.15s, transform 0.15s" }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = "#f87171"; e.currentTarget.style.transform = "scale(1.15)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = "#ef4444"; e.currentTarget.style.transform = "scale(1)"; }}
                    title="Send to Trash"
                  >
                    🗑
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      )}

      {/* Local HTML5 drag overlay. Render when either the parent forces an
          external app-level drag (externalIsDragOver) or this component sees
          a native HTML5 drag (isDragOver). Render markup to match SampleList
          so integration tests can find a single element with text 'IMPORT'. */}

      {(externalIsDragOver || isDragOver) && (
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

      {/* Sentinel element observed by IntersectionObserver to trigger loading more */}
      <div ref={sentinelRef} aria-hidden style={{ height: 1, width: "100%", visibility: "hidden" }} />

      <div style={{ padding: "8px 12px", textAlign: "center", color: "#9ca3af" }}>
        {isLoadingMore ? (
          <div style={{ fontSize: 13 }}>Loading...</div>
        ) : canLoadMore === false ? (
          <div style={{ fontSize: 13 }}>No more results</div>
        ) : (
          onLoadMore ? (
            <button
              type="button"
              onClick={() => { if (onLoadMore) void onLoadMore(); }}
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
  );
});

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
