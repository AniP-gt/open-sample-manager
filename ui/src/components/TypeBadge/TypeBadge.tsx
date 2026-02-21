import type { SampleType, TypeBadgeStyle } from "../../types/sample";

interface TypeBadgeProps {
  type: SampleType;
}

const TYPE_STYLES: Record<SampleType, TypeBadgeStyle> = {
  kick: { bg: "#f9731620", color: "#f97316", border: "#f9731650" },
  loop: { bg: "#22d3ee20", color: "#22d3ee", border: "#22d3ee50" },
  "one-shot": { bg: "#a78bfa20", color: "#a78bfa", border: "#a78bfa50" },
};

export function TypeBadge({ type }: TypeBadgeProps) {
  const style = TYPE_STYLES[type] || TYPE_STYLES["one-shot"];

  return (
    <span
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
      }}
    >
      {type}
    </span>
  );
}
