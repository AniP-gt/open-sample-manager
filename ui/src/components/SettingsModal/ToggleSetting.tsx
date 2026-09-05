type ToggleSettingProps = {
  readonly title: string;
  readonly description: string;
  readonly enabled: boolean;
  readonly onChange: (enabled: boolean) => void;
  readonly hasTopMargin?: boolean;
};

export function ToggleSetting({
  title,
  description,
  enabled,
  onChange,
  hasTopMargin = false,
}: ToggleSettingProps) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "12px",
        background: "#080a0f",
        borderRadius: "2px",
        ...(hasTopMargin ? { marginTop: "8px" } : {}),
      }}
    >
      <div>
        <div style={{ fontSize: "14px", color: "#d1d5db" }}>{title}</div>
        <div style={{ fontSize: "12px", color: "#6b7280", marginTop: "4px" }}>{description}</div>
      </div>
      <button
        onClick={() => onChange(!enabled)}
        style={{
          width: "44px",
          height: "24px",
          borderRadius: "12px",
          border: "none",
          cursor: "pointer",
          background: enabled ? "#f97316" : "#374151",
          position: "relative",
          flexShrink: 0,
          transition: "background 0.2s",
        }}
        aria-checked={enabled}
        role="switch"
        aria-label={title}
      >
        <span
          style={{
            position: "absolute",
            top: "3px",
            left: enabled ? "23px" : "3px",
            width: "18px",
            height: "18px",
            borderRadius: "50%",
            background: "#fff",
            transition: "left 0.2s",
          }}
        />
      </button>
    </div>
  );
}
