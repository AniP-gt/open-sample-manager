import type { Sample } from "../../types/sample";

type MetadataField = "source" | "packName" | "license" | "licenseUrl" | "licenseMemo";

type MetadataForm = Record<MetadataField, string>;

interface SampleMetadataEditModalProps {
  isOpen: boolean;
  sample: Sample | null;
  targetIds?: number[];
  form: MetadataForm;
  onFieldChange: (field: MetadataField, value: string) => void;
  onSave: () => void;
  onClose: () => void;
}

const inputStyle = {
  width: "100%",
  boxSizing: "border-box" as const,
  background: "#080a0f",
  border: "1px solid #1f2937",
  borderRadius: "2px",
  color: "#d1d5db",
  fontFamily: "'Courier New', monospace",
  fontSize: "12px",
  padding: "9px 10px",
  outline: "none",
};

const labelStyle = {
  display: "block",
  fontSize: "11px",
  letterSpacing: "0.12em",
  color: "#6b7280",
  marginBottom: "6px",
  fontFamily: "'Courier New', monospace",
};

export function SampleMetadataEditModal({
  isOpen,
  sample,
  targetIds = [],
  form,
  onFieldChange,
  onSave,
  onClose,
}: SampleMetadataEditModalProps) {
  if (!isOpen || !sample) return null;

  const isBulk = targetIds.length > 1;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: "rgba(0, 0, 0, 0.8)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#0f1117",
          border: "1px solid #1f2937",
          borderRadius: "4px",
          padding: "24px",
          minWidth: "460px",
          maxWidth: "560px",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "20px",
            paddingBottom: "16px",
            borderBottom: "1px solid #1f2937",
          }}
        >
          <h2 style={{ fontSize: "18px", fontWeight: 700, letterSpacing: "0.1em", color: "#f1f5f9", margin: 0 }}>
            {isBulk ? `EDIT METADATA (${targetIds.length})` : "EDIT METADATA"}
          </h2>
          <button
            onClick={onClose}
            style={{ background: "transparent", border: "none", color: "#6b7280", cursor: "pointer", fontSize: "20px", padding: "4px 8px" }}
          >
            ✕
          </button>
        </div>

        <div style={{ fontSize: "13px", color: "#9ca3af", marginBottom: "18px", padding: "12px", background: "#080a0f", borderRadius: "2px", wordBreak: "break-all" }}>
          {isBulk ? `${targetIds.length} samples selected` : sample.file_name}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
          <label>
            <span style={labelStyle}>SOURCE</span>
            <input value={form.source} onChange={(e) => onFieldChange("source", e.target.value)} style={inputStyle} />
          </label>
          <label>
            <span style={labelStyle}>PACK</span>
            <input value={form.packName} onChange={(e) => onFieldChange("packName", e.target.value)} style={inputStyle} />
          </label>
          <label>
            <span style={labelStyle}>LICENSE</span>
            <input value={form.license} onChange={(e) => onFieldChange("license", e.target.value)} style={inputStyle} />
          </label>
          <label>
            <span style={labelStyle}>LICENSE URL</span>
            <input value={form.licenseUrl} onChange={(e) => onFieldChange("licenseUrl", e.target.value)} style={inputStyle} />
          </label>
        </div>

        <label>
          <span style={labelStyle}>MEMO</span>
          <textarea
            value={form.licenseMemo}
            onChange={(e) => onFieldChange("licenseMemo", e.target.value)}
            rows={4}
            style={{ ...inputStyle, resize: "vertical", minHeight: "84px" }}
          />
        </label>

        <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end", marginTop: "22px" }}>
          <button
            onClick={onClose}
            style={{ fontSize: "12px", letterSpacing: "0.1em", background: "transparent", color: "#6b7280", border: "1px solid #1f2937", padding: "10px 20px", borderRadius: "2px", cursor: "pointer", fontFamily: "'Courier New', monospace" }}
          >
            CANCEL
          </button>
          <button
            onClick={onSave}
            style={{ fontSize: "12px", letterSpacing: "0.1em", background: "#22d3ee", color: "#080a0f", border: "none", padding: "10px 20px", borderRadius: "2px", cursor: "pointer", fontFamily: "'Courier New', monospace", fontWeight: 700 }}
          >
            SAVE
          </button>
        </div>
      </div>
    </div>
  );
}
