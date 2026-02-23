import { useEffect, useState } from "react";
import type { ScanProgress } from "../../types/scan";

interface ScannerOverlayProps {
  progress: ScanProgress | null;
  onDone: () => void;
}

export function ScannerOverlay({ progress, onDone }: ScannerOverlayProps) {
  const [isComplete, setIsComplete] = useState(false);

  useEffect(() => {
    if (progress?.stage === "complete" && !isComplete) {
      setIsComplete(true);
      // Small delay before closing to show 100%
      setTimeout(onDone, 500);
    }
  }, [progress, onDone, isComplete]);

  // Calculate percentage from real progress
  const percentage = progress && progress.total > 0 
    ? (progress.current / progress.total) * 100 
    : 0;

  const currentFile = progress?.currentFile ?? "Initializing scanner...";

  // Stage indicator
  const stageLabel = progress?.stage === "discovering" 
    ? "DISCOVERING FILES" 
    : progress?.stage === "analyzing" 
      ? "ANALYZING SAMPLES" 
      : "SCANNING LIBRARY";

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#00000090",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
      }}
    >
      <div
        style={{
          background: "#0f1117",
          border: "1px solid #1f2937",
          padding: "32px",
          width: "420px",
          borderRadius: "4px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            marginBottom: "20px",
          }}
        >
          <div
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: isComplete ? "#22c55e" : "#f97316",
              boxShadow: `0 0 8px ${isComplete ? "#22c55e" : "#f97316"}`,
              animation: isComplete ? "none" : "pulse 1s infinite",
            }}
          />
          <span
            style={{
              color: "#f1f5f9",
              fontFamily: "'Courier New', monospace",
              fontSize: "18px",
              letterSpacing: "0.06em",
            }}
          >
            {stageLabel}
          </span>
        </div>
        <div
          style={{
            fontFamily: "'Courier New', monospace",
            fontSize: "16px",
            color: "#6b7280",
            marginBottom: "16px",
            minHeight: "16px",
          }}
        >
          {currentFile}
        </div>
        <div
          style={{
            height: "2px",
            background: "#1f2937",
            borderRadius: "1px",
            marginBottom: "8px",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${percentage}%`,
              background: "linear-gradient(90deg, #f97316, #fb923c)",
              borderRadius: "1px",
              transition: "width 0.2s ease",
            }}
          />
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontFamily: "'Courier New', monospace",
            fontSize: "15px",
            color: "#374151",
          }}
        >
          <span>
            {progress?.current ?? 0} / {progress?.total ?? 0} files
          </span>
          <span>
            {Math.round(percentage)}%
          </span>
        </div>
      </div>
    </div>
  );
}
