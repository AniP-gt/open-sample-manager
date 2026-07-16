import type WaveSurfer from "wavesurfer.js";
import type { Sample, SampleProcessingSettings } from "../../types/sample";
import { SpectrogramView } from "../WaveSurferPlayer/SpectrogramView";
import { LoopMarker } from "../WaveSurferPlayer/LoopMarker";
import { PitchShiftControl } from "./PitchShiftControl";
import { ProcessingControls } from "./ProcessingControls";

interface PlayerBarAdvancedControlsProps {
  readonly sample: Sample;
  readonly duration: number;
  readonly processingSettings: SampleProcessingSettings;
  readonly audio: HTMLAudioElement;
  readonly wavesurfer: WaveSurfer | null;
  readonly showSpectrogram: boolean;
  readonly playing: boolean;
  readonly onSpectrogramToggle: () => void;
  readonly onProcessingSettingsChange?: (settings: SampleProcessingSettings) => void;
  readonly onProcessingSettingsReset?: () => void;
  readonly onProcessingSettingsClear?: () => void;
}

export function PlayerBarAdvancedControls({
  sample,
  duration,
  processingSettings,
  audio,
  wavesurfer,
  showSpectrogram,
  playing,
  onSpectrogramToggle,
  onProcessingSettingsChange,
  onProcessingSettingsReset,
  onProcessingSettingsClear,
}: PlayerBarAdvancedControlsProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "8px 0", borderTop: "1px solid #1a1f2e" }}>
      <SpectrogramView wavesurfer={wavesurfer} enabled={showSpectrogram} onToggle={onSpectrogramToggle} />
      <LoopMarker wavesurfer={wavesurfer} />
      <ProcessingControls
        durationSeconds={duration || sample.duration}
        settings={processingSettings}
        onChange={(settings) => onProcessingSettingsChange?.(settings)}
        onReset={() => onProcessingSettingsReset?.()}
        onClear={() => onProcessingSettingsClear?.()}
      />
      <PitchShiftControl audioElement={audio} wavesurfer={wavesurfer} isPlaying={playing} />
    </div>
  );
}
