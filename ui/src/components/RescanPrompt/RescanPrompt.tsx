import React from "react";

export interface RescanPromptProps {
  isOpen: boolean;
  path: string | null;
  onRescan: () => Promise<void> | void;
  onSkip: () => void;
  isIncremental?: boolean;
}

export const RescanPrompt: React.FC<RescanPromptProps> = ({ isOpen, path, onRescan, onSkip, isIncremental = true }) => {
  const [loading, setLoading] = React.useState(false);

  if (!isOpen) return null;

  const handleRescan = async () => {
    try {
      setLoading(true);
      await Promise.resolve(onRescan());
    } finally {
      setLoading(false);
    }
  };

  const modeText = isIncremental
    ? "Only new files will be added (existing files in the library are skipped)."
    : "All files will be analyzed again (useful for updating metadata like key detection).";

  return (
    <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.6)", zIndex: 1100 }}>
      <div style={{ background: "#0b1220", padding: "20px", borderRadius: "6px", width: "520px", color: "#e5e7eb", boxShadow: "0 10px 30px rgba(0,0,0,0.6)" }}>
        <div style={{ fontSize: 18, marginBottom: 8 }}>Library Already Exists</div>
        <div style={{ marginBottom: 16, color: "#d1d5db" }}>
          A library already exists. Do you want to scan <strong>{path ?? "selected folder"}</strong>?
          <br />
          <span style={{ fontSize: 13, color: "#6b7280" }}>{modeText}</span>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={onSkip} disabled={loading} style={{ background: "transparent", border: "1px solid #374151", color: "#cbd5e1", padding: "8px 14px", cursor: loading ? "default" : "pointer", borderRadius: 3 }}>
            Skip
          </button>

          <button onClick={handleRescan} disabled={loading} style={{ background: "#f97316", border: "none", color: "black", padding: "8px 14px", cursor: loading ? "default" : "pointer", borderRadius: 3, fontWeight: 600 }}>
            {loading ? "Scanning..." : isIncremental ? "Scan (Add New)" : "ReScan"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RescanPrompt;
