import { useState } from "react";
import type React from "react";
import type { Midi } from "../../../types/midi";
import { invoke } from "@tauri-apps/api/core";
import { startDrag } from "@crabnebula/tauri-plugin-drag";

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

interface MidiListRowProps {
  midi: Midi;
  isSelected: boolean;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  virtualRow: { size: number; start: number };
  colWidths: string[];
  onMidiSelect: (midi: Midi, isShift?: boolean) => void;
  onTagBadgeClick?: (midi: Midi) => void;
  onTrashMidi?: (id: number) => void;
  preparedPathsRef: React.MutableRefObject<Record<number, string>>;
  dragIconPathRef: React.MutableRefObject<string>;
}

export function MidiListRow({
  midi,
  isSelected,
  isFavorite = false,
  onToggleFavorite,
  virtualRow,
  colWidths,
  onMidiSelect,
  onTagBadgeClick,
  onTrashMidi,
  preparedPathsRef,
  dragIconPathRef,
}: MidiListRowProps) {
  const [toast, setToast] = useState<{ message: string; visible: boolean; midiId: number | null }>({ message: "", visible: false, midiId: null });

  return (
    <div
      className={`midi-row ${isSelected ? "active" : ""}`}
      draggable={!!midi.path}
      onClick={(e) => onMidiSelect(midi, e.shiftKey)}
      onMouseDown={(e) => {
        if (midi.path && e.button === 0 && !preparedPathsRef.current[midi.id]) {
          void invoke("prepare_drag_file", { path: midi.path }).then((res) => {
            if (typeof res === "string" && res) preparedPathsRef.current[midi.id] = res;
          }).catch(() => {});
        }
      }}
      onDragStart={(e) => {
        const originalPath = midi.path;
        if (!originalPath) { e.preventDefault(); return; }
        e.preventDefault();
        const path = preparedPathsRef.current[midi.id] || originalPath;
        void startDrag({ item: [path], icon: dragIconPathRef.current || "/tmp/osm_drag_icon.png" }).catch((err) => {
          console.warn("[midi-dragout] startDrag failed:", err);
        });
        setTimeout(() => {
          const prepared = preparedPathsRef.current[midi.id];
          if (prepared) {
            void invoke("delete_file", { path: prepared }).catch(() => {});
            delete preparedPathsRef.current[midi.id];
          }
        }, 1500);
      }}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: `${virtualRow.size}px`,
        transform: `translateY(${virtualRow.start}px)`,
        display: "grid",
        gridTemplateColumns: colWidths.join(" "),
        padding: "8px 12px",
        borderBottom: "1px solid #0d0f16",
        borderLeft: isSelected ? "2px solid #f97316" : "2px solid transparent",
        background: isSelected ? "#111827" : "transparent",
        alignItems: "center",
        boxSizing: "border-box",
        cursor: midi.path ? "grab" : "default",
      }}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); onToggleFavorite?.(); }}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
          color: isFavorite ? "#f6e05e" : "#4b5563",
          fontSize: "22px",
        }}
        title={isFavorite ? "Remove from favorites" : "Add to favorites"}
      >
        {isFavorite ? "★" : "☆"}
      </div>
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
}
