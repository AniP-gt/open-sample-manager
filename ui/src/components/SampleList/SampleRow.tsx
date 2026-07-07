import React, { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { prepareDragFile, startFileDrag } from "../fileDragOut";
import type { VirtualItem } from "@tanstack/react-virtual";
import type { Sample, SampleProcessingSettings } from "../../types/sample";
import type { ProjectSampleExportVariant } from "../../types/projectUsage";
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
  isUsedInProject?: boolean;
  isInProjectCollection?: boolean;
  onSampleSelect: (sample: Sample, isShift?: boolean) => void;
  onProjectCollectionToggle?: (sampleId: number) => void;
  onProjectExportSuccess?: (sampleId: number, variant: ProjectSampleExportVariant) => void;
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
  processingSettings,
  isUsedInProject = false,
  isInProjectCollection = false,
  onSampleSelect,
  onProjectCollectionToggle,
  onProjectExportSuccess,
  onToggleFavorite,
  onTypeClick,
  onTrashSample,
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
        startFileDrag(e, samplePath, dragKey, preparedPathsRef, dragIconPath, "[dragout-debug]", processingSettings, {
          sampleId: s.id,
          onExportSuccess: onProjectExportSuccess,
        });
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
        {(isUsedInProject || isInProjectCollection) && (
          <div style={{ display: "flex", gap: "4px", marginBottom: "3px" }}>
            {isUsedInProject && (
              <span style={{ fontSize: "10px", color: "#22d3ee", letterSpacing: "0.08em" }}>USED</span>
            )}
            {isInProjectCollection && (
              <span style={{ fontSize: "10px", color: "#f97316", letterSpacing: "0.08em" }}>PROJECT</span>
            )}
          </div>
        )}
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
      {onProjectCollectionToggle && (
        <button
          type="button"
          title={isInProjectCollection ? "Remove from project collection" : "Add to project collection"}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onProjectCollectionToggle(s.id);
          }}
          style={{
            width: "24px",
            height: "24px",
            borderRadius: "2px",
            border: "1px solid #1f2937",
            background: isInProjectCollection ? "#1f2937" : "transparent",
            color: isInProjectCollection ? "#f97316" : "#4b5563",
            cursor: "pointer",
            fontFamily: "'Courier New', monospace",
            fontSize: "12px",
          }}
        >
          P
        </button>
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
