import { useState, useEffect, useRef } from "react";
import { readFile } from "@tauri-apps/plugin-fs";
import type { Sample } from "../../types/sample";
import { TypeBadge } from "../TypeBadge/TypeBadge";
import { WaveformDisplay } from "../WaveformDisplay/WaveformDisplay";
import { AnalysisBar } from "../AnalysisBar/AnalysisBar";

interface DetailPanelProps {
  sample: Sample;
  path?: string;
}

export function DetailPanel({ sample, path }: DetailPanelProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Reset state when path changes
  useEffect(() => {
    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setLoading(false);
    setLoadError(null);
  }, [path]);

  // Create audio element when path changes
  useEffect(() => {
    if (!path) {
      audioRef.current = null;
      return;
    }

    let isMounted = true;
    let currentAudioUrl: string | null = null;

    const loadAudio = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        console.log("[Audio] Loading from path:", path);
        // Read file as binary
        const fileData = await readFile(path);
        console.log("[Audio] File data length:", fileData?.length);
        if (!isMounted) return;

        // Create blob URL from binary data
        const blob = new Blob([fileData], { type: "audio/wav" });
        const audioUrl = URL.createObjectURL(blob);
        currentAudioUrl = audioUrl;
        if (!isMounted) {
          URL.revokeObjectURL(audioUrl);
          return;
        }

        const audio = new Audio(audioUrl);
        audio.onended = () => setPlaying(false);
        audio.onpause = () => setPlaying(false);
        audio.onplay = () => setPlaying(true);
        audio.ontimeupdate = () => setCurrentTime(audio.currentTime);
        audio.onloadedmetadata = () => setDuration(audio.duration);
        audioRef.current = audio;
        setLoading(false);
        console.log("[Audio] Audio element created successfully");
      } catch (err) {
        console.error("[Audio] Failed to load audio:", err);
        
        // Detect file not found errors and show user-friendly message
        const errorMessage = err instanceof Error ? err.message : String(err);
        const isFileNotFound = 
          errorMessage.includes("not found") ||
          errorMessage.includes("No such file") ||
          errorMessage.includes("ENOENT") ||
          errorMessage.includes("path does not exist");
        
        if (isFileNotFound) {
          setLoadError("ファイルパスが見つかりません");
        } else {
          setLoadError(errorMessage);
        }
        setLoading(false);
      }
    };

    loadAudio();

    return () => {
      isMounted = false;
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
        audioRef.current = null;
      }
      if (currentAudioUrl) {
        URL.revokeObjectURL(currentAudioUrl);
      }
    };
  }, [path]);

  return (
    <div
      style={{
        position: "sticky",
        top: 0,
        height: "100%",
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
              {Math.floor(sample.bpm)} BPM
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
            currentTime={currentTime}
            duration={duration}
            onSeek={(time) => {
              if (audioRef.current) {
                audioRef.current.currentTime = time;
                setCurrentTime(time);
              }
            }}
          />
        </div>
        
        {/* Error message display */}
        {loadError && (
          <div
            style={{
              background: "#ef444420",
              border: "1px solid #ef444450",
              borderRadius: "3px",
              padding: "8px",
              marginBottom: "8px",
              fontSize: "12px",
              color: "#fca5a5",
            }}
          >
            <div style={{ fontWeight: "bold", marginBottom: "4px" }}>再生できません</div>
            <div>{loadError}</div>
            <div style={{ marginTop: "6px", fontSize: "11px", color: "#9ca3af" }}>
              外部メディアの場合、Driveが接続されているか確認してください
            </div>
          </div>
        )}
        
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <button
            onClick={() => {
              console.log("[Audio] Button clicked, playing:", playing, "loading:", loading, "audioRef:", !!audioRef.current);
              // If there's an error, clear it and try again
              if (loadError) {
                console.log("[Audio] Clearing error and retrying");
                setLoadError(null);
                return;
              }
              if (!audioRef.current || loading) {
                console.log("[Audio] Cannot play: no audio ref or loading");
                return;
              }
              if (playing) {
                console.log("[Audio] Pausing");
                audioRef.current.pause();
              } else {
                console.log("[Audio] Playing...");
                audioRef.current.play().then(() => {
                  console.log("[Audio] Play started successfully");
                }).catch((err) => {
                  console.error("[Audio] Play failed:", err);
                  setLoadError(err.message);
                });
              }
            }}
            style={{
              background: playing ? "#f97316" : loading ? "#374151" : "#1f2937",
              border: "none",
              borderRadius: "2px",
              width: "28px",
              height: "28px",
              cursor: "pointer",
              color: "#fff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              opacity: loading ? 0.5 : 1,
            }}
          >
            {loading ? (
              <div
                style={{
                  width: "10px",
                  height: "10px",
                  border: "2px solid #fff",
                  borderTopColor: "transparent",
                  borderRadius: "50%",
                  animation: "spin 1s linear infinite",
                }}
              />
            ) : playing ? (
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
              <span style={{ color: "#22d3ee" }}>{sample.bpm ? Math.floor(sample.bpm) : '—'}</span>
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
          {path || "—"}
        </div>
      </div>
    </div>
  );
}
