import { useState, useEffect, useRef, forwardRef, useImperativeHandle, lazy, Suspense } from "react";
import { convertFileSrc } from "@tauri-apps/api/core";
import type WaveSurfer from "wavesurfer.js";
import type { Sample } from "../../types/sample";
import type { SampleProcessingSettings } from "../../types/sample";
import { WaveformDisplay } from "../WaveformDisplay/WaveformDisplay";
import { TypeBadge } from "../TypeBadge/TypeBadge";
import { SpectrogramView } from "../WaveSurferPlayer/SpectrogramView";
import { LoopMarker } from "../WaveSurferPlayer/LoopMarker";
import { PitchShiftControl } from "./PitchShiftControl";
import { ProcessingControls } from "./ProcessingControls";
import { createDefaultSampleProcessingSettings, hasSampleProcessingEdits } from "../../utils/sampleProcessing";

const LazyWaveSurferPlayer = lazy(() => import("../WaveSurferPlayer/WaveSurferPlayer").then(m => ({ default: m.WaveSurferPlayer })));

interface PlayerBarProps {
  sample: Sample;
  path?: string;
  onClose?: () => void;
  autoPlay?: boolean;
  processingSettings?: SampleProcessingSettings;
  onProcessingSettingsChange?: (settings: SampleProcessingSettings) => void;
  onProcessingSettingsReset?: () => void;
  onProcessingSettingsClear?: () => void;
}

export interface PlayerBarHandle {
  stop: () => void;
  play: () => void;
  toggle: () => void;
  isPlaying: boolean;
}

// Single persistent Audio element shared across path changes to avoid
// WebKit media resource leaks from repeated new Audio() / destroy cycles.
const sharedAudio = (() => {
  const a = new Audio();
  a.preload = "metadata";
  return a;
})();

export const PlayerBar = forwardRef<PlayerBarHandle, PlayerBarProps>(function PlayerBar({
  sample,
  path,
  onClose,
  autoPlay,
  processingSettings = createDefaultSampleProcessingSettings(),
  onProcessingSettingsChange,
  onProcessingSettingsReset,
  onProcessingSettingsClear,
}: PlayerBarProps, ref) {
  const audioRef = useRef<HTMLAudioElement>(sharedAudio);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [volume, setVolume] = useState(() => audioRef.current.volume);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showSpectrogram, setShowSpectrogram] = useState(false);
  const [wavesurferInstance, setWavesurferInstance] = useState<WaveSurfer | null>(null);

  const gainMultiplier = Math.pow(10, processingSettings.gainDb / 20);
  const effectiveVolume = Math.min(1, Math.max(0, volume * gainMultiplier));
  const trimStart = Math.max(0, processingSettings.trimStartSeconds);
  const trimEnd = processingSettings.trimEndSeconds > trimStart ? processingSettings.trimEndSeconds : 0;

  useEffect(() => {
    audioRef.current.volume = effectiveVolume;
  }, [effectiveVolume]);

  const playFromPreviewStart = () => {
    const audio = audioRef.current;
    if (trimStart > 0 && (audio.currentTime < trimStart || (trimEnd > 0 && audio.currentTime >= trimEnd))) {
      audio.currentTime = trimStart;
      setCurrentTime(trimStart);
    }
    audio.play().catch((err) => {
      setLoadError(err.message);
    });
  };
  const handleClose = () => {
    const audio = audioRef.current;
    audio.pause();
    audio.currentTime = 0;
    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setLoadError(null);
    if (onClose) onClose();
  };

  // Debounce path changes for audio and wavesurfer separately.
  const [stablePath, setStablePath] = useState<string | undefined>(path);
  const pathTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track which path triggered the current audio load so stale callbacks are ignored.
  const loadIdRef = useRef(0);

  const autoPlayRef = useRef(autoPlay);
  autoPlayRef.current = autoPlay;

  useEffect(() => {
    // Stop current audio immediately — reuse the same element
    const audio = audioRef.current;
    audio.pause();

    // The WaveSurfer instance gets recreated whenever the file changes,
    // so drop the stale reference until the next 'ready' event lands.
    setWavesurferInstance(null);

    if (pathTimerRef.current) clearTimeout(pathTimerRef.current);

    pathTimerRef.current = setTimeout(() => {
      setStablePath(path);
    }, autoPlayRef.current ? 250 : 50);

    return () => {
      if (pathTimerRef.current) clearTimeout(pathTimerRef.current);
    };
  }, [path]);

  // Load audio when stable path settles — reuses a single Audio element.
  useEffect(() => {
    const audio = audioRef.current;
    const myLoadId = ++loadIdRef.current;

    if (!stablePath) {
      audio.pause();
      audio.src = "";
      setPlaying(false);
      setCurrentTime(0);
      setDuration(0);
      setLoading(false);
      return;
    }

    const assetUrl = convertFileSrc(stablePath);

    // Detach old handlers before assigning new src
    audio.onloadedmetadata = null;
    audio.onerror = null;
    audio.onended = null;
    audio.onpause = null;
    audio.onplay = null;
    audio.ontimeupdate = null;
    audio.pause();

    setLoading(true);
    setLoadError(null);
    setPlaying(false);
    setCurrentTime(0);

    audio.src = assetUrl;
    audio.playbackRate = 1;

    audio.onloadedmetadata = () => {
      if (loadIdRef.current !== myLoadId) return;
      setDuration(audio.duration);
      setLoading(false);
      if (autoPlayRef.current) {
        if (trimStart > 0) audio.currentTime = trimStart;
        audio.play().catch(() => {});
      }
    };

    audio.onerror = () => {
      if (loadIdRef.current !== myLoadId) return;
      setLoadError("ファイルを読み込めません");
      setLoading(false);
    };

    audio.onended = () => { if (loadIdRef.current === myLoadId) setPlaying(false); };
    audio.onpause = () => { if (loadIdRef.current === myLoadId) setPlaying(false); };
    audio.onplay = () => { if (loadIdRef.current === myLoadId) setPlaying(true); };
    audio.ontimeupdate = () => {
      if (loadIdRef.current !== myLoadId) return;
      if (trimEnd > 0 && audio.currentTime >= trimEnd) {
        audio.pause();
        audio.currentTime = trimEnd;
      }
      setCurrentTime(audio.currentTime);
    };

    return () => {
      audio.onloadedmetadata = null;
      audio.onerror = null;
      audio.onended = null;
      audio.onpause = null;
      audio.onplay = null;
      audio.ontimeupdate = null;
      audio.pause();
    };
  }, [stablePath, trimStart, trimEnd]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 100);
    return `${mins}:${secs.toString().padStart(2, "0")}.${ms.toString().padStart(2, "0")}`;
  };

  // Expose stop method to parent
  useImperativeHandle(
    ref,
    () => ({
      stop: () => {
        if (audioRef.current) {
          audioRef.current.pause();
          audioRef.current.currentTime = 0;
          setPlaying(false);
          setCurrentTime(0);
        }
      },
      play: () => {
        if (audioRef.current?.paused) {
          playFromPreviewStart();
        }
      },
      toggle: () => {
        if (!audioRef.current) return;
        if (audioRef.current.paused) {
          playFromPreviewStart();
        } else {
          audioRef.current.pause();
        }
      },
      isPlaying: playing,
    }),
    [playing, trimStart, trimEnd],
  );

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        height: showAdvanced ? "auto" : "160px",
        background: "linear-gradient(to top, #0a0c12 0%, #0d1019 60%, #0d101999 100%)",
        borderTop: "1px solid #1a1f2e",
        padding: "12px 24px 16px",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        backdropFilter: "blur(12px)",
        zIndex: 100,
      }}
    >
      {/* Sample Info & Controls */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "16px",
        }}
      >
        {/* Play Button */}
        <button
          onClick={() => {
            if (loadError) {
              setLoadError(null);
              return;
            }
            if (!audioRef.current || loading) {
              return;
            }
            if (playing) {
              audioRef.current.pause();
            } else {
              playFromPreviewStart();
            }
          }}
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
            <div
              style={{
                width: "16px",
                height: "16px",
                border: "2px solid #fff",
                borderTopColor: "transparent",
                borderRadius: "50%",
                animation: "spin 1s linear infinite",
              }}
            />
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

        {/* Sample Info */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: "14px",
              color: "#f1f5f9",
              fontWeight: 500,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {sample.file_name}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "2px" }}>
            <TypeBadge type={sample.sample_type} />
            {sample.bpm && (
              <span style={{ fontSize: "12px", color: "#22d3ee", letterSpacing: "0.1em" }}>
                {Math.floor(sample.bpm)} BPM
              </span>
            )}
            {sample.musical_key && (
              <span style={{ fontSize: "12px", color: "#a78bfa", letterSpacing: "0.1em" }}>
                {sample.musical_key}
              </span>
            )}
            <span style={{ fontSize: "12px", color: "#6b7280" }}>
              {sample.duration.toFixed(2)}s
            </span>
          </div>
        </div>

        {/* Time Display */}
        <div
          style={{
            fontFamily: "'Courier New', monospace",
            fontSize: "13px",
            color: "#9ca3af",
            display: "flex",
            gap: "4px",
          }}
        >
          <span style={{ color: playing ? "#f97316" : "#9ca3af" }}>
            {formatTime(currentTime)}
          </span>
          <span style={{ color: "#4b5563" }}>/</span>
          <span>{formatTime(duration || sample.duration)}</span>
        </div>
        {hasSampleProcessingEdits(processingSettings) && (
          <span style={{ fontSize: "11px", color: "#f97316", letterSpacing: "0.12em" }}>
            EDITED
          </span>
        )}

        {/* Advanced Controls Toggle — autoPlay mode has no WaveSurfer instance, so hide */}
        {!autoPlayRef.current && (
          <button
            onClick={() => setShowAdvanced((v) => !v)}
            style={{
              fontSize: "11px",
              color: showAdvanced ? "#a78bfa" : "#6b7280",
              background: "transparent",
              border: `1px solid ${showAdvanced ? "#a78bfa" : "#1f2937"}`,
              borderRadius: "4px",
              padding: "4px 8px",
              cursor: "pointer",
              letterSpacing: "0.1em",
              flexShrink: 0,
            }}
          >
            {showAdvanced ? "▴ CONTROLS" : "▾ CONTROLS"}
          </button>
        )}

        {/* Volume */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
          <span style={{ color: "#6b7280", fontSize: "14px", userSelect: "none" }}>
            {volume === 0 ? "🔇" : volume < 0.5 ? "🔉" : "🔊"}
          </span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              setVolume(v);
              audioRef.current.volume = v;
            }}
            style={{ width: "80px", accentColor: "#f97316", cursor: "pointer" }}
          />
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
        <div style={{ position: "absolute", top: 8, right: 8, zIndex: 200 }}>
          <button
            aria-label="Close waveform UI"
            title="Close waveform UI"
            onClick={handleClose}
            style={{
              background: "transparent",
              border: "none",
              color: "#9ca3af",
              width: 28,
              height: 28,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M6 6L18 18M6 18L18 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        {!autoPlayRef.current && stablePath ? (
          <Suspense fallback={
            <WaveformDisplay
              sample={sample}
              isPlaying={playing}
              currentTime={currentTime}
              duration={duration || sample.duration}
              height={100}
            />
          }>
            <LazyWaveSurferPlayer
              sample={sample}
              filePath={stablePath}
              blobUrl={convertFileSrc(stablePath)}
              isPlaying={playing}
              currentTime={currentTime}
              duration={duration || sample.duration}
              height={100}
              playbackEnabled={true}
              onSeek={(time) => {
                const audio = audioRef.current;
                audio.currentTime = time;
                setCurrentTime(time);
              }}
              onWaveSurferReady={(ws) => setWavesurferInstance(ws)}
            />
          </Suspense>
        ) : (
          <WaveformDisplay
            sample={sample}
            isPlaying={playing}
            currentTime={currentTime}
            duration={duration || sample.duration}
            height={100}
            onSeek={(time) => {
              const audio = audioRef.current;
              audio.currentTime = time;
              setCurrentTime(time);
            }}
          />
        )}

      </div>

      {/* Advanced Controls */}
      {showAdvanced && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            padding: "8px 0",
            borderTop: "1px solid #1a1f2e",
          }}
        >
          <SpectrogramView
            wavesurfer={wavesurferInstance}
            enabled={showSpectrogram}
            onToggle={() => setShowSpectrogram((v) => !v)}
          />
          <LoopMarker wavesurfer={wavesurferInstance} />
          <ProcessingControls
            durationSeconds={duration || sample.duration}
            settings={processingSettings}
            onChange={(settings) => onProcessingSettingsChange?.(settings)}
            onReset={() => onProcessingSettingsReset?.()}
            onClear={() => onProcessingSettingsClear?.()}
          />
          <PitchShiftControl audioElement={audioRef.current} wavesurfer={wavesurferInstance} isPlaying={playing} />
        </div>
      )}

      {/* Error Message */}
      {loadError && (
        <div
          style={{
            position: "absolute",
            top: "-32px",
            left: "50%",
            transform: "translateX(-50%)",
            background: "#ef4444",
            color: "#fff",
            padding: "6px 12px",
            borderRadius: "4px",
            fontSize: "12px",
            whiteSpace: "nowrap",
          }}
        >
          {loadError}
        </div>
      )}
    </div>
  );
});
