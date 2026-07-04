import type { SampleProcessingSettings } from "../../types/sample";
import { hasSampleProcessingEdits } from "../../utils/sampleProcessing";

interface ProcessingControlsProps {
  durationSeconds: number;
  settings: SampleProcessingSettings;
  onChange: (settings: SampleProcessingSettings) => void;
  onReset: () => void;
  onClear: () => void;
}

type ProcessingField = keyof SampleProcessingSettings;

const fieldLabels: Array<{ field: ProcessingField; label: string; min: number; max: (duration: number) => number; step: number; unit: string }> = [
  { field: "trimStartSeconds", label: "TRIM START", min: 0, max: (duration) => duration, step: 0.01, unit: "s" },
  { field: "trimEndSeconds", label: "TRIM END", min: 0, max: (duration) => duration, step: 0.01, unit: "s" },
  { field: "fadeInSeconds", label: "FADE IN", min: 0, max: (duration) => duration, step: 0.01, unit: "s" },
  { field: "fadeOutSeconds", label: "FADE OUT", min: 0, max: (duration) => duration, step: 0.01, unit: "s" },
  { field: "gainDb", label: "GAIN", min: -24, max: () => 24, step: 0.1, unit: "dB" },
];

export function ProcessingControls({ durationSeconds, settings, onChange, onReset, onClear }: ProcessingControlsProps) {
  const edited = hasSampleProcessingEdits(settings);
  const updateField = (field: ProcessingField, value: number) => {
    onChange({ ...settings, [field]: value });
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        flexWrap: "wrap",
        padding: "8px 10px",
        background: "#080a0f",
        border: "1px solid #1a1f2e",
        borderRadius: "4px",
      }}
    >
      <span style={{ fontSize: "11px", color: edited ? "#f97316" : "#374151", letterSpacing: "0.14em" }}>
        PROCESS
      </span>
      {fieldLabels.map(({ field, label, min, max, step, unit }) => (
        <label key={field} style={{ display: "flex", alignItems: "center", gap: "5px", color: "#6b7280", fontSize: "11px", letterSpacing: "0.08em", whiteSpace: "nowrap" }}>
          {label}
          <input
            aria-label={label}
            type="number"
            min={min}
            max={max(durationSeconds)}
            step={step}
            value={settings[field]}
            onChange={(event) => updateField(field, Number(event.target.value))}
            style={{
              width: field === "gainDb" ? "58px" : "64px",
              background: "#0d1019",
              border: "1px solid #1f2937",
              color: "#d1d5db",
              borderRadius: "3px",
              padding: "3px 5px",
              fontFamily: "'Courier New', monospace",
              fontSize: "12px",
            }}
          />
          <span style={{ color: "#374151" }}>{unit}</span>
        </label>
      ))}
      <span style={{ fontSize: "11px", color: "#6b7280", whiteSpace: "nowrap" }}>
        FADES: DRAG EXPORT ONLY
      </span>
      <button type="button" onClick={onReset} style={buttonStyle}>
        RESET
      </button>
      <button type="button" onClick={onClear} disabled={!edited} style={{ ...buttonStyle, color: edited ? "#f97316" : "#374151", cursor: edited ? "pointer" : "not-allowed" }}>
        CLEAR EDIT
      </button>
    </div>
  );
}

const buttonStyle = {
  fontSize: "11px",
  color: "#9ca3af",
  background: "transparent",
  border: "1px solid #1f2937",
  borderRadius: "4px",
  padding: "4px 8px",
  cursor: "pointer",
  letterSpacing: "0.12em",
  fontFamily: "inherit",
  whiteSpace: "nowrap",
};
