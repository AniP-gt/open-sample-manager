import type { SampleProcessingSettings } from "../types/sample";

export const DEFAULT_SAMPLE_PROCESSING_SETTINGS: SampleProcessingSettings = {
  trimStartSeconds: 0,
  trimEndSeconds: 0,
  fadeInSeconds: 0,
  fadeOutSeconds: 0,
  gainDb: 0,
};

export type ProcessedDragParams = {
  trim_start_seconds: number;
  trim_end_seconds: number | null;
  fade_in_seconds: number;
  fade_out_seconds: number;
  gain_db: number;
};

export function createDefaultSampleProcessingSettings(): SampleProcessingSettings {
  return { ...DEFAULT_SAMPLE_PROCESSING_SETTINGS };
}

export function hasSampleProcessingEdits(settings?: SampleProcessingSettings): boolean {
  if (!settings) return false;
  return (
    settings.trimStartSeconds !== 0 ||
    settings.trimEndSeconds !== 0 ||
    settings.fadeInSeconds !== 0 ||
    settings.fadeOutSeconds !== 0 ||
    settings.gainDb !== 0
  );
}

export function toProcessedDragParams(settings: SampleProcessingSettings): ProcessedDragParams {
  return {
    trim_start_seconds: settings.trimStartSeconds,
    trim_end_seconds: settings.trimEndSeconds > settings.trimStartSeconds ? settings.trimEndSeconds : null,
    fade_in_seconds: settings.fadeInSeconds,
    fade_out_seconds: settings.fadeOutSeconds,
    gain_db: settings.gainDb,
  };
}

export function sampleProcessingSignature(settings?: SampleProcessingSettings): string {
  if (!hasSampleProcessingEdits(settings)) return "raw";
  const s = settings;
  if (!s) return "raw";
  return [s.trimStartSeconds, s.trimEndSeconds, s.fadeInSeconds, s.fadeOutSeconds, s.gainDb].join(":");
}

export function clampSampleProcessingSettings(
  settings: SampleProcessingSettings,
  durationSeconds: number,
): SampleProcessingSettings {
  const duration = Math.max(0, durationSeconds);
  const trimStartSeconds = clamp(settings.trimStartSeconds, 0, duration);
  const trimEndSeconds = clamp(settings.trimEndSeconds, 0, duration);
  return {
    trimStartSeconds,
    trimEndSeconds,
    fadeInSeconds: clamp(settings.fadeInSeconds, 0, duration),
    fadeOutSeconds: clamp(settings.fadeOutSeconds, 0, duration),
    gainDb: clamp(settings.gainDb, -24, 24),
  };
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}
