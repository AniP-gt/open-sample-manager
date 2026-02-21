import { useState, useEffect } from "react";

interface ScannerOverlayProps {
  onDone: () => void;
}

const SCAN_FILES = [
  "Scanning /Samples/Drums/Kicks...",
  "Analyzing spectral content: Kick_Deep_909.wav",
  "Computing FFT autocorrelation...",
  "Detecting onset envelopes...",
  "Classifying: loop vs one-shot...",
  "Building FTS5 index...",
  "Generating embeddings [64-dim]...",
  "Writing to SQLite cache...",
  "Scan complete. 12 samples indexed.",
];

export function ScannerOverlay({ onDone }: ScannerOverlayProps) {
  const [progress, setProgress] = useState(0);
  const [currentFile, setCurrentFile] = useState("Initializing scanner...");

  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      i++;
      setProgress((i / SCAN_FILES.length) * 100);
      setCurrentFile(SCAN_FILES[Math.min(i, SCAN_FILES.length - 1)]);
      if (i >= SCAN_FILES.length) {
        clearInterval(interval);
        setTimeout(onDone, 600);
      }
    }, 300);
    return () => clearInterval(interval);
  }, [onDone]);

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
              background: "#f97316",
              boxShadow: "0 0 8px #f97316",
              animation: "pulse 1s infinite",
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
            SCANNING LIBRARY
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
              width: `${progress}%`,
              background: "linear-gradient(90deg, #f97316, #fb923c)",
              borderRadius: "1px",
              transition: "width 0.3s ease",
            }}
          />
        </div>
        <div
          style={{
            textAlign: "right",
            fontFamily: "'Courier New', monospace",
            fontSize: "15px",
            color: "#374151",
          }}
        >
          {Math.round(progress)}%
        </div>
      </div>
    </div>
  );
}
