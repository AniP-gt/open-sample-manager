import { translate } from "../../i18n";
import { useTranslation } from "react-i18next";
import { createPortal } from "react-dom";
import type { Sample } from "../../types/sample";
import { mapEmbeddingRowToSample, type EmbeddingSampleRow } from "../../utils/sampleMapper";

interface EmbeddingResult {
  similarity: number;
  row: EmbeddingSampleRow;
}

interface Props {
  isOpen: boolean;
  results: EmbeddingResult[];
  onClose: () => void;
  // Called when a user selects a result. The modal will not close automatically
  // so the parent can decide how to handle navigation/focus.
  onSelect: (sample: Sample, path?: string) => void;
}

export function EmbeddingResultsModal({ isOpen, results, onClose, onSelect }: Props) {
  useTranslation();
  if (!isOpen) return null;
  // Sort by similarity descending (highest first)
  const sortedResults = [...results].sort((a, b) => (b.similarity ?? 0) - (a.similarity ?? 0));

  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1200,
      }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="embedding-results-title"
        style={{
          width: "720px",
          maxWidth: "calc(100vw - 32px)",
          maxHeight: "min(70vh, calc(100dvh - 32px))",
          boxSizing: "border-box",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          background: "#0f1117",
          border: "1px solid #1f2937",
          borderRadius: 6,
          padding: 16,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", flexShrink: 0, justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <h3 id="embedding-results-title" style={{ margin: 0, color: "#e2e8f0" }}>{translate("similarSamples")}</h3>
          <button aria-label={translate("close")} onClick={onClose} style={{ background: "transparent", border: "none", color: "#b8c2d1", cursor: "pointer", minWidth: 32, minHeight: 32 }}>✕</button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8, minHeight: 0, overflowY: "auto" }}>
          {sortedResults.length === 0 && (
            <div style={{ color: "#9ca3af" }}>{translate("noSimilarSamplesFound")}</div>
          )}

          {sortedResults.map((r) => (
            <div
              key={r.row.id}
              onClick={() => onSelect(mapEmbeddingRowToSample(r.row), r.row.path)}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 12,
                flexShrink: 0,
                padding: "10px",
                background: "#080a0f",
                borderRadius: 4,
                cursor: "pointer",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div title={r.row.file_name} style={{ color: "#d1d5db", fontSize: 15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.row.file_name}</div>
                <div style={{ color: "#b8c2d1", fontSize: 12, overflowWrap: "anywhere" }}>{r.row.path}</div>
              </div>
              <div style={{ color: "#22d3ee", fontWeight: 700, flexShrink: 0, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{typeof r.similarity === "number" ? `${(r.similarity * 100).toFixed(1)}%` : "—"}</div>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}
