interface AnalysisBarProps {
  label: string;
  value: number | null;
  max: number;
  color: string;
}

export function AnalysisBar({ label, value, max, color }: AnalysisBarProps) {
  const displayValue = value ?? 0;
  const percentage = Math.min(100, (displayValue / max) * 100);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span
          style={{
            fontSize: "14px",
            color: "#6b7280",
            fontFamily: "'Courier New', monospace",
            letterSpacing: "0.08em",
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontSize: "14px",
            color: color,
            fontFamily: "'Courier New', monospace",
          }}
        >
          {value !== null ? value.toFixed(2) : "—"}
        </span>
      </div>
      <div
        style={{
          height: "3px",
          background: "#1f2937",
          borderRadius: "2px",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${percentage}%`,
            background: color,
            borderRadius: "2px",
            transition: "width 0.3s ease",
          }}
        />
      </div>
    </div>
  );
}
