import { useState, useEffect } from "react";
import type { Sample } from "../../types/sample";
import { TypeBadge } from "../TypeBadge/TypeBadge";
import { WaveformDisplay } from "../WaveformDisplay/WaveformDisplay";
import { AnalysisBar } from "../AnalysisBar/AnalysisBar";

interface DetailPanelProps {
  sample: Sample;
}

export function DetailPanel({ sample }: DetailPanelProps) {
  const [playing, setPlaying] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setTick((t) => t + 1), 50);
    return () => clearInterval(id);
  }, [playing]);

  return (
    <div
      style={{
        width: "260px",
        borderLeft: "1px solid #0f1117",
        background: "#0a0c12",
        padding: "20px 16px",
        display: "flex",
        flexDirection: "column",
        gap: "20px",
        flexShrink: 0,
        overflowY: "auto",
      }}
    >
      
      <div>
        <div
          style={{
            fontSize: "16px",
            color: "#f1f5f9",
            letterSpacing: "0.06em",
            marginBottom: "4px",
            lineHeight: 1.4,
          }}
        >
          {sample.file_name}
        </div>
        <div
          style={{
            display: "flex",
            gap: "6px",
            alignItems: "center",
            marginBottom: "12px",
          }}
        >
          <TypeBadge type={sample.sample_type} />
          {sample.bpm && (
            <span
              style={{
                fontSize: "14px",
                color: "#22d3ee",
                letterSpacing: "0.1em",
              }}
            >
              {sample.bpm} BPM
            </span>
          )}
        </div>
      </div>

      
      <div
        style={{
          background: "#080a0f",
          border: "1px solid #1a1f2e",
          borderRadius: "3px",
          padding: "10px",
        }}
      >
        <div style={{ marginBottom: "8px" }}>
          <WaveformDisplay
            sample={sample}
            isPlaying={playing}
            key={`${sample.id}-${tick}`}
          />
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <button
            onClick={() => setPlaying((p) => !p)}
            style={{
              background: playing ? "#f97316" : "#1f2937",
              border: "none",
              borderRadius: "2px",
              width: "28px",
              height: "28px",
              cursor: "pointer",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {playing ? (
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <rect x="6" y="4" width="4" height="16" />
                <rect x="14" y="4" width="4" height="16" />
              </svg>
            ) : (
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
            )}
          </button>
          <span style={{ fontSize: "14px", color: "#374151" }}>
            {sample.duration.toFixed(3)}s
          </span>
        </div>
      </div>

      
      <div>
        <div
          style={{
            fontSize: "14px",
            color: "#374151",
            letterSpacing: "0.14em",
            marginBottom: "12px",
          }}
        >
          SPECTRAL ANALYSIS
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <AnalysisBar
            label="LOW RATIO"
            value={sample.low_ratio}
            max={1}
            color="#f97316"
          />
          <AnalysisBar
            label="PERIODICITY"
            value={sample.periodicity}
            max={1}
            color="#22d3ee"
          />
          <AnalysisBar
            label="ATTACK SLOPE"
            value={sample.attack_slope}
            max={5}
            color="#a78bfa"
          />
          {sample.decay_time && (
            <AnalysisBar
              label="DECAY (ms)"
              value={sample.decay_time}
              max={600}
              color="#fb923c"
            />
          )}
        </div>
      </div>

      
      {sample.sample_type === "kick" && (
        <div
          style={{
            background: "#f9731610",
            border: "1px solid #f9731630",
            borderRadius: "3px",
            padding: "10px",
          }}
        >
          <div
            style={{
              fontSize: "14px",
              color: "#f97316",
              letterSpacing: "0.12em",
              marginBottom: "8px",
            }}
          >
            KICK DETECTION
          </div>
          <div style={{ fontSize: "14px", color: "#6b7280", lineHeight: 2 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>low_ratio &gt; 0.6</span>
              <span
                style={{
                  color: sample.low_ratio > 0.6 ? "#22d3ee" : "#ef4444",
                }}
              >
                {sample.low_ratio > 0.6 ? "✓" : "✗"}{" "}
                {sample.low_ratio.toFixed(2)}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>attack_slope &gt; θ</span>
              <span
                style={{
                  color: sample.attack_slope > 1.5 ? "#22d3ee" : "#ef4444",
                }}
              >
                {sample.attack_slope > 1.5 ? "✓" : "✗"}{" "}
                {sample.attack_slope.toFixed(2)}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>decay &lt; 400ms</span>
              <span
                style={{
                  color:
                    sample.decay_time && sample.decay_time < 400
                      ? "#22d3ee"
                      : "#ef4444",
                }}
              >
                {sample.decay_time && sample.decay_time < 400 ? "✓" : "✗"}{" "}
                {sample.decay_time}ms
              </span>
            </div>
          </div>
        </div>
      )}

      
      {sample.sample_type === "loop" && (
        <div
          style={{
            background: "#22d3ee10",
            border: "1px solid #22d3ee30",
            borderRadius: "3px",
            padding: "10px",
          }}
        >
          <div
            style={{
              fontSize: "14px",
              color: "#22d3ee",
              letterSpacing: "0.12em",
              marginBottom: "8px",
            }}
          >
            LOOP CLASSIFIER
          </div>
          <div style={{ fontSize: "14px", color: "#6b7280", lineHeight: 2 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>duration &gt; 1.0s</span>
              <span style={{ color: "#22d3ee" }}>✓ {sample.duration.toFixed(2)}s</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>periodicity &gt; 0.3</span>
              <span style={{ color: "#22d3ee" }}>✓ {sample.periodicity.toFixed(2)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>BPM (FFT-ACF)</span>
              <span style={{ color: "#22d3ee" }}>{sample.bpm}</span>
            </div>
          </div>
        </div>
      )}

      
      <div>
        <div
          style={{
            fontSize: "14px",
            color: "#374151",
            letterSpacing: "0.14em",
            marginBottom: "8px",
          }}
        >
          EMBEDDING [64-dim]
        </div>
        <div
          style={{
            display: "flex",
            gap: "1px",
            flexWrap: "wrap",
            opacity: 0.6,
          }}
        >
          {Array.from({ length: 32 }, (_, i) => (
            <div
              key={i}
              style={{
                width: "6px",
                height: "6px",
                background: `hsl(${(sample.id * 37 + i * 11) % 360}, 60%, 40%)`,
                borderRadius: "1px",
              }}
            />
          ))}
        </div>
        <div
          style={{ fontSize: "13px", color: "#374151", marginTop: "6px" }}
        >
          cos-sim search · HNSW ready
        </div>
      </div>

      
      <div
        style={{ borderTop: "1px solid #0f1117", paddingTop: "12px" }}
      >
        <div
          style={{
            fontSize: "13px",
            color: "#374151",
            letterSpacing: "0.08em",
            marginBottom: "4px",
          }}
        >
          PATH
        </div>
        <div
          style={{
            fontSize: "13px",
            color: "#4b5563",
            wordBreak: "break-all",
            lineHeight: 1.6,
          }}
        >
          ~/Samples/Library/{sample.file_name}
        </div>
      </div>
    </div>
  );
}
