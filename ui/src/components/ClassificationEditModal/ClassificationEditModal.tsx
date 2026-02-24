import type { InstrumentType, SampleType, Sample } from "../../types/sample";
import { TypeBadge } from "../TypeBadge/TypeBadge";

interface ClassificationEditModalProps {
  isOpen: boolean;
  sample: Sample | null;
  editInstrumentType: string;
  editSampleType: SampleType;
  onInstrumentTypeChange: (value: string) => void;
  onSampleTypeChange: (value: SampleType) => void;
  onSave: () => void;
  onClose: () => void;
}

const SAMPLE_TYPE_OPTIONS: SampleType[] = ["loop", "one-shot"];

const INSTRUMENT_OPTIONS: InstrumentType[] = [
  "kick",
  "snare",
  "hihat",
  "bass",
  "synth",
  "fx",
  "vocal",
  "percussion",
  "other",
];

export function ClassificationEditModal({
  isOpen,
  sample,
  editInstrumentType,
  editSampleType,
  onInstrumentTypeChange,
  onSampleTypeChange,
  onSave,
  onClose,
}: ClassificationEditModalProps) {
  if (!isOpen || !sample) return null;

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
          minWidth: "420px",
          maxWidth: "500px",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "24px",
            paddingBottom: "16px",
            borderBottom: "1px solid #1f2937",
          }}
        >
          <h2
            style={{
              fontSize: "18px",
              fontWeight: 700,
              letterSpacing: "0.1em",
              color: "#f1f5f9",
              margin: 0,
            }}
          >
            EDIT CLASSIFICATION
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "#6b7280",
              cursor: "pointer",
              fontSize: "20px",
              padding: "4px 8px",
            }}
          >
            ✕
          </button>
        </div>

        {/* Sample name */}
        <div
          style={{
            fontSize: "14px",
            color: "#9ca3af",
            marginBottom: "20px",
            padding: "12px",
            background: "#080a0f",
            borderRadius: "2px",
            wordBreak: "break-all",
          }}
        >
          {sample.file_name}
        </div>

        <div style={{ marginBottom: "24px" }}>
          <h3
            style={{
              fontSize: "14px",
              letterSpacing: "0.1em",
              color: "#9ca3af",
              marginBottom: "12px",
            }}
          >
            CLASS TYPE
          </h3>
          <div style={{ display: "flex", gap: "8px" }}>
            {SAMPLE_TYPE_OPTIONS.map((option) => (
              <button
                key={option}
                onClick={() => onSampleTypeChange(option)}
                style={{
                  flex: 1,
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  padding: "10px",
                  borderRadius: "2px",
                  border: `1px solid ${editSampleType === option ? "#f97316" : "#1f2937"}`,
                  background: editSampleType === option ? "rgba(249, 115, 22, 0.08)" : "#080a0f",
                  cursor: "pointer",
                }}
              >
                <TypeBadge type={option} />
              </button>
            ))}
          </div>
        </div>

        {/* Instrument Type Section */}
        <div style={{ marginBottom: "28px" }}>
          <h3
            style={{
              fontSize: "14px",
              letterSpacing: "0.1em",
              color: "#9ca3af",
              marginBottom: "12px",
            }}
          >
            INSTRUMENT TYPE
          </h3>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "8px",
            }}
          >
            {INSTRUMENT_OPTIONS.map((option) => (
              <button
                key={option}
                onClick={() => onInstrumentTypeChange(option)}
                style={{
                  fontSize: "12px",
                  fontFamily: "'Courier New', monospace",
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                  padding: "10px 8px",
                  borderRadius: "2px",
                  cursor: "pointer",
                  background: editInstrumentType === option ? "#f9731620" : "#080a0f",
                  color: editInstrumentType === option ? "#f97316" : "#6b7280",
                  border: `1px solid ${
                    editInstrumentType === option ? "#f9731650" : "#1f2937"
                  }`,
                  transition: "all 0.15s ease",
                }}
              >
                {option.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            style={{
              fontSize: "12px",
              letterSpacing: "0.1em",
              background: "transparent",
              color: "#6b7280",
              border: "1px solid #1f2937",
              padding: "10px 20px",
              borderRadius: "2px",
              cursor: "pointer",
              fontFamily: "'Courier New', monospace",
            }}
          >
            CANCEL
          </button>
          <button
            onClick={onSave}
            style={{
              fontSize: "12px",
              letterSpacing: "0.1em",
              background: "#22d3ee",
              color: "#080a0f",
              border: "none",
              padding: "10px 20px",
              borderRadius: "2px",
              cursor: "pointer",
              fontFamily: "'Courier New', monospace",
              fontWeight: 700,
            }}
          >
            SAVE
          </button>
        </div>
      </div>
    </div>
  );
}
