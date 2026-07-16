import type { Sample, SampleProcessingSettings } from "../../types/sample";
import { TypeBadge } from "../TypeBadge/TypeBadge";
import { hasSampleProcessingEdits } from "../../utils/sampleProcessing";

interface PlayerBarControlsProps {
  readonly sample: Sample;
  readonly processingSettings: SampleProcessingSettings;
  readonly autoPlay: boolean | undefined;
  readonly showAdvanced: boolean;
  readonly playing: boolean;
  readonly loading: boolean;
  readonly volume: number;
  readonly currentTime: number;
  readonly duration: number;
  readonly onPlayButtonClick: () => void;
  readonly onAdvancedToggle: () => void;
  readonly onVolumeChange: (value: number) => void;
}

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${mins}:${secs.toString().padStart(2, "0")}.${ms.toString().padStart(2, "0")}`;
};

export function PlayerBarControls({
  sample,
  processingSettings,
  autoPlay,
  showAdvanced,
  playing,
  loading,
  volume,
  currentTime,
  duration,
  onPlayButtonClick,
  onAdvancedToggle,
  onVolumeChange,
}: PlayerBarControlsProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "16px",
      }}
    >
      <button
        onClick={onPlayButtonClick}
        style={{
          background: playing ? "#f97316" : loading ? "#374151" : "#1f2937",
          border: "none",
          borderRadius: "50%",
          width: "44px",
          height: "44px",
          cursor: loading ? "not-allowed" : "pointer",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          opacity: loading ? 0.6 : 1,
          flexShrink: 0,
          transition: "all 0.15s ease",
        }}
      >
        {loading ? (
          <div style={{ width: "16px", height: "16px", border: "2px solid #fff", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 1s linear infinite" }} />
        ) : playing ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16" />
            <rect x="14" y="4" width="4" height="16" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
        )}
      </button>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "14px", color: "#f1f5f9", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {sample.file_name}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "2px" }}>
          <TypeBadge type={sample.sample_type} />
          {sample.bpm && <span style={{ fontSize: "12px", color: "#22d3ee", letterSpacing: "0.1em" }}>{Math.floor(sample.bpm)} BPM</span>}
          {sample.musical_key && <span style={{ fontSize: "12px", color: "#a78bfa", letterSpacing: "0.1em" }}>{sample.musical_key}</span>}
          <span style={{ fontSize: "12px", color: "#6b7280" }}>{sample.duration.toFixed(2)}s</span>
        </div>
      </div>

      <div style={{ fontFamily: "'Courier New', monospace", fontSize: "13px", color: "#9ca3af", display: "flex", gap: "4px" }}>
        <span style={{ color: playing ? "#f97316" : "#9ca3af" }}>{formatTime(currentTime)}</span>
        <span style={{ color: "#4b5563" }}>/</span>
        <span>{formatTime(duration || sample.duration)}</span>
      </div>
      {hasSampleProcessingEdits(processingSettings) && <span style={{ fontSize: "11px", color: "#f97316", letterSpacing: "0.12em" }}>EDITED</span>}

      {!autoPlay && (
        <button
          onClick={onAdvancedToggle}
          style={{
            fontSize: "11px", color: showAdvanced ? "#a78bfa" : "#6b7280", background: "transparent", border: `1px solid ${showAdvanced ? "#a78bfa" : "#1f2937"}`,
            borderRadius: "4px", padding: "4px 8px", cursor: "pointer", letterSpacing: "0.1em", flexShrink: 0,
          }}
        >
          {showAdvanced ? "▴ CONTROLS" : "▾ CONTROLS"}
        </button>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
        <span style={{ color: "#6b7280", fontSize: "14px", userSelect: "none" }}>{volume === 0 ? "🔇" : volume < 0.5 ? "🔉" : "🔊"}</span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={volume}
          onChange={(event) => onVolumeChange(parseFloat(event.target.value))}
          style={{ width: "80px", accentColor: "#f97316", cursor: "pointer" }}
        />
      </div>
    </div>
  );
}
