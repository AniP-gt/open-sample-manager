import type { SampleType, TypeBadgeStyle } from "../../types/sample";

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
