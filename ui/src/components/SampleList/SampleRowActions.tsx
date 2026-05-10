interface SampleRowActionsProps {
  samplePath?: string;
  onOpenFolder: () => void;
  onCopyPath: () => void;
  onTrashSample?: () => void;
  toast: { message: string; visible: boolean };
}

export function SampleRowActions({
  samplePath,
  onOpenFolder,
  onCopyPath,
  onTrashSample,
  toast,
}: SampleRowActionsProps) {
  return (
    <div onMouseDown={(e) => e.stopPropagation()} style={{ display: "flex", gap: "6px", justifyContent: "center", position: "relative" }}>
      <button
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          if (samplePath) onOpenFolder();
        }}
        style={{
          background: "transparent",
          border: "none",
          color: "#6b7280",
          cursor: "pointer",
          padding: "4px",
          fontSize: "14px",
          transition: "color 0.15s, transform 0.15s",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = "#9ca3af";
          e.currentTarget.style.transform = "scale(1.15)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = "#6b7280";
          e.currentTarget.style.transform = "scale(1)";
        }}
        title="Show in Finder"
      >
        📂
      </button>
      <button
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onCopyPath();
        }}
        style={{
          background: "transparent",
          border: "none",
          color: "#6b7280",
          cursor: "pointer",
          padding: "4px",
          fontSize: "14px",
          transition: "color 0.15s, transform 0.15s",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = "#9ca3af";
          e.currentTarget.style.transform = "scale(1.15)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = "#6b7280";
          e.currentTarget.style.transform = "scale(1)";
        }}
        title="Copy Full Path"
      >
        📋
      </button>
      {toast.visible && (
        <div
          style={{
            position: "absolute",
            right: "60px",
            background: "#1f2937",
            color: "#22c55e",
            padding: "4px 10px",
            borderRadius: "4px",
            fontSize: "11px",
            fontFamily: "'Courier New', monospace",
            zIndex: 100,
            border: "1px solid #22c55e",
            whiteSpace: "nowrap",
            animation: "fadeIn 0.15s ease",
          }}
        >
          {toast.message}
        </div>
      )}
      <button
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => {
          e.stopPropagation();
          onTrashSample?.();
        }}
        style={{
          background: "transparent",
          border: "none",
          color: "#ef4444",
          cursor: "pointer",
          padding: "4px",
          fontSize: "14px",
          transition: "color 0.15s, transform 0.15s",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = "#f87171";
          e.currentTarget.style.transform = "scale(1.15)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = "#ef4444";
          e.currentTarget.style.transform = "scale(1)";
        }}
        title="Send to Trash"
      >
        🗑
      </button>
    </div>
  );
}
