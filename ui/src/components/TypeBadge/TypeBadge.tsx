import type { SampleType, TypeBadgeStyle } from "../../types/sample";
import type { InstrumentType } from "../../types/sample";

interface TypeBadgeProps {
  type: SampleType;
  onClick?: () => void;
}

const TYPE_STYLES: Record<SampleType, TypeBadgeStyle> = {
  loop: { bg: "#22d3ee20", color: "#22d3ee", border: "#22d3ee50" },
  "one-shot": { bg: "#a78bfa20", color: "#a78bfa", border: "#a78bfa50" },
};

function styleFor(type: SampleType): TypeBadgeStyle {
  return TYPE_STYLES[type] ?? TYPE_STYLES["one-shot"];
}

export function TypeBadge({ type, onClick }: TypeBadgeProps) {
  const style = styleFor(type);

  return (
    <span
      onClick={onClick}
      style={{
        fontSize: "14px",
        fontFamily: "'Courier New', monospace",
        fontWeight: 700,
        letterSpacing: "0.12em",
        textTransform: "uppercase",
        padding: "2px 6px",
        whiteSpace: "nowrap",
        borderRadius: "2px",
        background: style.bg,
        color: style.color,
        border: `1px solid ${style.border}`,
        cursor: onClick ? "pointer" : "default",
      }}
    >
      {type}
    </span>
  );
}

const INSTRUMENT_STYLES: Record<InstrumentType, TypeBadgeStyle> = {
  kick:       { bg: "#e53e3e20", color: "#e53e3e", border: "#e53e3e50" },
  snare:      { bg: "#ed893620", color: "#ed8936", border: "#ed893650" },
  hihat:      { bg: "#ecc94b20", color: "#ecc94b", border: "#ecc94b50" },
  bass:       { bg: "#48bb7820", color: "#48bb78", border: "#48bb7850" },
  synth:      { bg: "#4299e120", color: "#4299e1", border: "#4299e150" },
  fx:         { bg: "#9f7aea20", color: "#9f7aea", border: "#9f7aea50" },
  vocal:      { bg: "#f687b320", color: "#f687b3", border: "#f687b350" },
  percussion: { bg: "#f6ad5520", color: "#f6ad55", border: "#f6ad5550" },
  other:      { bg: "#a0aec020", color: "#a0aec0", border: "#a0aec050" },
};

export function getInstrumentColor(type: InstrumentType): TypeBadgeStyle {
  return INSTRUMENT_STYLES[type] ?? INSTRUMENT_STYLES.other;
}

interface InstrumentBadgeProps {
  type: InstrumentType;
}

export function InstrumentBadge({ type }: InstrumentBadgeProps) {
  const style = INSTRUMENT_STYLES[type] ?? INSTRUMENT_STYLES.other;
  return (
    <span
      style={{
        fontSize: "11px",
        fontFamily: "'Courier New', monospace",
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        padding: "1px 5px",
        whiteSpace: "nowrap",
        borderRadius: "2px",
        background: style.bg,
        color: style.color,
        border: `1px solid ${style.border}`,
      }}
    >
      {type}
    </span>
  );
}
