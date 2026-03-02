import React from "react";

export interface RescanPromptProps {
  isOpen: boolean;
  path: string | null;
  onRescan: () => Promise<void> | void;
  onSkip: () => void;
}

export const RescanPrompt: React.FC<RescanPromptProps> = ({ isOpen, path, onRescan, onSkip }) => {
  const [loading, setLoading] = React.useState(false);

  if (!isOpen) return null;

  const handleRescan = async () => {
    try {
      setLoading(true);
      // support both sync and async
      await Promise.resolve(onRescan());
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.6)", zIndex: 1100 }}>
      <div style={{ background: "#0b1220", padding: "20px", borderRadius: "6px", width: "480px", color: "#e5e7eb", boxShadow: "0 10px 30px rgba(0,0,0,0.6)" }}>
        <div style={{ fontSize: 18, marginBottom: 8 }}>Existing Library Detected</div>
        <div style={{ marginBottom: 16, color: "#d1d5db" }}>
          A previously scanned library exists in the application's index. Do you want to perform a full re-scan of the selected folder (<strong>{path ?? "selected folder"}</strong>) or skip scanning?
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
          <button onClick={onSkip} disabled={loading} style={{ background: "transparent", border: "1px solid #374151", color: "#cbd5e1", padding: "6px 12px", cursor: loading ? "default" : "pointer", borderRadius: 3 }}>
            Skip
          </button>

          <button onClick={handleRescan} disabled={loading} style={{ background: "#ef4444", border: "none", color: "white", padding: "6px 12px", cursor: loading ? "default" : "pointer", borderRadius: 3 }}>
            {loading ? "Working..." : "ReScan"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default RescanPrompt;
