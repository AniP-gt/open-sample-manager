
import { useEffect, useImperativeHandle, useRef, forwardRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Midi } from "../../types/midi";
import type { MidiTagRow } from "../../types/midi";

interface MidiListProps {
  midis: Midi[];
  selectedMidi: Midi | null;
  onMidiSelect: (midi: Midi) => void;
  onTagBadgeClick?: (midi: Midi) => void;
  midiTags?: MidiTagRow[];
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
}

export type MidiListHandle = {
  focusSelected: () => void;
};

export const MidiList = forwardRef(function MidiList(
  { midis, selectedMidi, onMidiSelect, onTagBadgeClick, onLoadMore, isLoadingMore, canLoadMore, onTrashMidi }: MidiListProps,
  ref: React.Ref<MidiListHandle>,
) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const [toast, setToast] = useState<{ message: string; visible: boolean; midiId: number | null }>({ message: "", visible: false, midiId: null });

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
      style={{
        flex: 1,
        overflowY: "auto",
        background: "#0a0c12",
        position: "relative",
      }}
    >
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
                  cursor: "pointer",
                  transition: "background 0.1s ease",
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
