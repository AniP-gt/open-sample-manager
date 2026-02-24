import type { SampleType, TypeBadgeStyle } from "../../types/sample";

interface TypeBadgeProps {
  type: SampleType;
  onClick?: () => void;
}

const TYPE_STYLES: Record<Exclude<SampleType, "kick">, TypeBadgeStyle> & { kick?: TypeBadgeStyle } = {
  loop: { bg: "#22d3ee20", color: "#22d3ee", border: "#22d3ee50" },
  "one-shot": { bg: "#a78bfa20", color: "#a78bfa", border: "#a78bfa50" },
};

// Provide a runtime-safe accessor that falls back to one-shot style for unknowns
function styleFor(type: SampleType): TypeBadgeStyle {
  if (type === "kick") {
    return TYPE_STYLES["one-shot"];
  }
  return TYPE_STYLES[type as Exclude<SampleType, "kick">];
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
