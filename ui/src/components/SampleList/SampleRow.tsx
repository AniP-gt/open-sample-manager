import React, { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { prepareDragFile, startFileDrag } from "../fileDragOut";
import type { VirtualItem } from "@tanstack/react-virtual";
import type { Sample, SampleProcessingSettings } from "../../types/sample";
import { TypeBadge, getInstrumentColor } from "../TypeBadge/TypeBadge";
import { SampleRowActions } from "./SampleRowActions";
import { sampleProcessingSignature } from "../../utils/sampleProcessing";

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
  preparedPathsRef: React.MutableRefObject<Record<string, string>>;
  processingSettings?: SampleProcessingSettings;
  onSampleSelect: (sample: Sample, isShift?: boolean) => void;
  onToggleFavorite: (id: number) => void;
  onTypeClick?: (sample: Sample) => void;
  onMetadataClick?: (sample: Sample) => void;
  onTrashSample?: (id: number) => void;
  showSampleMetadataQuality?: boolean;
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
  processingSettings,
  onSampleSelect,
  onToggleFavorite,
  onTypeClick,
  onMetadataClick,
  onTrashSample,
  showSampleMetadataQuality = true,
}: SampleRowProps) {
  const [toast, setToast] = useState<{ message: string; visible: boolean }>({ message: "", visible: false });
  const dragKey = `${s.id}:${sampleProcessingSignature(processingSettings)}`;

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
        if (e.button === 0) {
          prepareDragFile(samplePath, dragKey, preparedPathsRef, processingSettings);
        }
      }}
      onDragStart={(e) => {
        startFileDrag(e, samplePath, dragKey, preparedPathsRef, dragIconPath, "[dragout-debug]", processingSettings);
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
      {showSampleMetadataQuality && (
        <>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onMetadataClick?.(s); }}
            onMouseDown={(e) => e.stopPropagation()}
            title={[s.license, s.source, s.pack_name].filter(Boolean).join(" / ") || "Edit license metadata"}
            style={{
              minWidth: 0,
              background: "transparent",
              border: "none",
              padding: 0,
              textAlign: "left",
              cursor: "pointer",
              fontFamily: "'Courier New', monospace",
            }}
          >
            <div style={{ fontSize: "11px", color: s.license ? "#22d3ee" : "#374151", fontWeight: 700, letterSpacing: "0.08em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {s.license ?? "NO LIC"}
            </div>
            <div style={{ fontSize: "10px", color: s.source || s.pack_name ? "#6b7280" : "#374151", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {s.pack_name ?? s.source ?? "source"}
            </div>
          </button>
          <div
            title={s.quality_flags.length > 0 ? s.quality_flags.join(", ") : "No quality issues"}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              fontSize: "11px",
              fontFamily: "'Courier New', monospace",
              color: s.quality_flags.length > 0 ? "#f97316" : "#374151",
              fontWeight: 700,
            }}
          >
            <span>{s.quality_flags.length > 0 ? "!" : "OK"}</span>
            {s.clipping_count !== undefined && s.clipping_count > 0 && <span>CLIP</span>}
          </div>
        </>
      )}
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
