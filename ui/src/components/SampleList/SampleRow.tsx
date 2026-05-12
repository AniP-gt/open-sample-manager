import React, { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { startDrag } from "@crabnebula/tauri-plugin-drag";
import type { VirtualItem } from "@tanstack/react-virtual";
import type { Sample } from "../../types/sample";
import { TypeBadge, getInstrumentColor } from "../TypeBadge/TypeBadge";
import { SampleRowActions } from "./SampleRowActions";

interface SampleRowProps {
  sample: Sample;
  virtualRow: VirtualItem;
  colWidths: string[];
  rowHeight: number;
  isSelected: boolean;
  samplePath?: string;
  isFavorite: boolean;
  instrumentColorCoding: boolean;
  dragIconPath: string;
  preparedPathsRef: React.MutableRefObject<Record<number, string>>;
  onSampleSelect: (sample: Sample, isShift?: boolean) => void;
  onToggleFavorite: (id: number) => void;
  onTypeClick?: (sample: Sample) => void;
  onTrashSample?: (id: number) => void;
}

export function SampleRow({
  sample: s,
  virtualRow,
  colWidths,
  rowHeight,
  isSelected,
  samplePath,
  isFavorite,
  instrumentColorCoding,
  dragIconPath,
  preparedPathsRef,
  onSampleSelect,
  onToggleFavorite,
  onTypeClick,
  onTrashSample,
}: SampleRowProps) {
  const [toast, setToast] = useState<{ message: string; visible: boolean }>({ message: "", visible: false });

  const showToast = (message: string) => {
    setToast({ message, visible: true });
    setTimeout(() => {
      setToast({ message: "", visible: false });
    }, 1500);
  };

  return (
    <div
      data-index={virtualRow.index}
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: `${rowHeight}px`,
        transform: `translateY(${virtualRow.start}px)`,
        display: "grid",
        gridTemplateColumns: colWidths.join(" "),
        padding: "6px 12px",
        boxSizing: "border-box",
        borderBottom: "1px solid #0d0f16",
        borderLeft: isSelected ? "2px solid #f97316" : "2px solid transparent",
        background: isSelected
          ? instrumentColorCoding
            ? `linear-gradient(${getInstrumentColor(s.instrument_type).bg}, ${getInstrumentColor(s.instrument_type).bg}), #111827`
            : "#111827"
          : instrumentColorCoding
            ? getInstrumentColor(s.instrument_type).bg
            : "transparent",
        alignItems: "center",
        transition: "background 0.1s",
        cursor: samplePath ? "grab" : "default",
      }}
      className={`sample-row ${isSelected ? "active" : ""}`}
      draggable={!!samplePath}
      onMouseDown={(e) => {
        if (samplePath && e.button === 0 && !preparedPathsRef.current[s.id]) {
          void invoke("prepare_drag_file", { path: samplePath }).then((res) => {
            if (typeof res === "string" && res) preparedPathsRef.current[s.id] = res;
          }).catch(() => {});
        }
      }}
      onDragStart={(e) => {
        if (!samplePath) { e.preventDefault(); return; }
        e.preventDefault();
        const path = preparedPathsRef.current[s.id] || samplePath;
        void startDrag({ item: [path], icon: dragIconPath || "/tmp/osm_drag_icon.png" }).catch((err) => {
          console.warn("[dragout-debug] startDrag failed:", err);
        });
        setTimeout(() => {
          const prepared = preparedPathsRef.current[s.id];
          if (prepared) {
            void invoke("delete_file", { path: prepared }).catch(() => {});
            delete preparedPathsRef.current[s.id];
          }
        }, 1500);
      }}
      onClick={(e) => onSampleSelect(s, e.shiftKey)}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => { e.stopPropagation(); onToggleFavorite(s.id); }}
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
      <div style={{ fontSize: "14px", color: "#374151" }}>{s.id}</div>
      <div style={{ overflow: "hidden", minWidth: 0 }}>
        <div
          style={{
            fontSize: "16px",
            color: "#d1d5db",
            letterSpacing: "0.02em",
            marginBottom: "3px",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {s.file_name}
        </div>
        <div style={{ display: "flex", gap: "4px", overflow: "hidden" }}>
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
            color: instrumentColorCoding ? getInstrumentColor(s.instrument_type).color : "#f97316",
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
      <div
        style={{
          fontSize: "14px",
          fontFamily: "'Courier New', monospace",
          fontWeight: 600,
          letterSpacing: "0.08em",
          color: s.musical_key ? "#a78bfa" : "#374151",
        }}
      >
        {s.musical_key ?? "-"}
      </div>
      <SampleRowActions
        samplePath={samplePath}
        onOpenFolder={async () => {
          let folderPath = samplePath as string;
          const lastSlash = Math.max(folderPath.lastIndexOf("/"), folderPath.lastIndexOf("\\"));
          if (lastSlash > 0) {
            folderPath = folderPath.substring(0, lastSlash);
          }
          try {
            await invoke("open_folder", { path: folderPath });
          } catch (err) {
            console.error("Failed to open folder:", err);
          }
        }}
        onCopyPath={async () => {
          if (!samplePath) return;
          try {
            await invoke("copy_to_clipboard", { text: samplePath });
            showToast("Path copied!");
          } catch (err) {
            console.error("Clipboard write failed:", err);
            showToast("Copy failed");
          }
        }}
        onTrashSample={onTrashSample ? () => onTrashSample(s.id) : undefined}
        toast={toast}
      />
    </div>
  );
}
