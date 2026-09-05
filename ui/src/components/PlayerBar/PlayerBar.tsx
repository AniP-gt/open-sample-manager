import { forwardRef, useCallback, useImperativeHandle, useState } from "react";
import type WaveSurfer from "wavesurfer.js";
import type { Sample, SampleProcessingSettings } from "../../types/sample";
import { createDefaultSampleProcessingSettings } from "../../utils/sampleProcessing";
import { PlayerBarAdvancedControls } from "./PlayerBarAdvancedControls";
import { PlayerBarControls } from "./PlayerBarControls";
import { PlayerBarWaveform } from "./PlayerBarWaveform";
import { usePlayerBarAudio } from "./usePlayerBarAudio";

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
  playFromStart?: () => void;
  toggle: () => void;
  isPlaying: boolean;
}

export const PlayerBar = forwardRef<PlayerBarHandle, PlayerBarProps>(function PlayerBar({
  sample,
  path,
  onClose,
  autoPlay,
  processingSettings = createDefaultSampleProcessingSettings(),
  onProcessingSettingsChange,
  onProcessingSettingsReset,
  onProcessingSettingsClear,
}, ref) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showSpectrogram, setShowSpectrogram] = useState(false);
  const [wavesurferInstance, setWavesurferInstance] = useState<WaveSurfer | null>(null);
  const clearWaveSurferInstance = useCallback(() => setWavesurferInstance(null), []);
  const trimStart = Math.max(0, processingSettings.trimStartSeconds);
  const trimEnd = processingSettings.trimEndSeconds > trimStart ? processingSettings.trimEndSeconds : 0;
  const playback = usePlayerBarAudio({
    path,
    autoPlay,
    trimStart,
    trimEnd,
    gainDb: processingSettings.gainDb,
    onPathChange: clearWaveSurferInstance,
  });

  useImperativeHandle(
    ref,
    () => ({
      stop: playback.stop,
      play: playback.play,
      playFromStart: playback.playFromStart,
      toggle: playback.toggle,
      isPlaying: playback.playing,
    }),
    [playback.playing, trimStart, trimEnd],
  );

  const handleClose = () => {
    playback.close();
    if (onClose) onClose();
  };

  const handlePlayButtonClick = () => {
    if (playback.loadError) {
      playback.setLoadError(null);
      return;
    }
    if (playback.loading) return;
    if (playback.playing) {
      playback.audio.pause();
    } else {
      playback.play();
    }
  };

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
      <PlayerBarControls
        sample={sample}
        processingSettings={processingSettings}
        autoPlay={autoPlay}
        showAdvanced={showAdvanced}
        playing={playback.playing}
        loading={playback.loading}
        volume={playback.volume}
        currentTime={playback.currentTime}
        duration={playback.duration}
        onPlayButtonClick={handlePlayButtonClick}
        onAdvancedToggle={() => setShowAdvanced((value) => !value)}
        onVolumeChange={playback.setVolume}
      />
      <PlayerBarWaveform
        sample={sample}
        stablePath={playback.stablePath}
        audioUrl={playback.audioUrl}
        autoPlay={autoPlay}
        playing={playback.playing}
        currentTime={playback.currentTime}
        duration={playback.duration}
        onClose={handleClose}
        onSeek={playback.seek}
        onWaveSurferReady={setWavesurferInstance}
      />
      {showAdvanced && (
        <PlayerBarAdvancedControls
          sample={sample}
          duration={playback.duration}
          processingSettings={processingSettings}
          audio={playback.audio}
          wavesurfer={wavesurferInstance}
          showSpectrogram={showSpectrogram}
          playing={playback.playing}
          onSpectrogramToggle={() => setShowSpectrogram((value) => !value)}
          onProcessingSettingsChange={onProcessingSettingsChange}
          onProcessingSettingsReset={onProcessingSettingsReset}
          onProcessingSettingsClear={onProcessingSettingsClear}
        />
      )}
      {playback.loadError && (
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
          {playback.loadError}
        </div>
      )}
    </div>
  );
});
