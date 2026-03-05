import type { Sample } from "../types/sample";
import type { TauriSampleRow } from "../types/tauri";

export const normalizeSampleType = (
  playbackType: string | null,
  sampleType: string | null,
): Sample["sample_type"] => {
  if (playbackType === "loop" || sampleType === "loop") {
    return "loop";
  }

  return "one-shot";
};

export const mapRowToSample = (row: TauriSampleRow): Sample => {
  let waveformPeaks: number[] | null = null;
  if (row.waveform_peaks) {
    try {
      waveformPeaks = JSON.parse(row.waveform_peaks);
    } catch {
      waveformPeaks = null;
    }
  }

  const playbackType = row.playback_type === "loop" ? "loop" : "oneshot";

  let instrumentType =
    typeof row.instrument_type === "string" && row.instrument_type.trim() !== ""
      ? (row.instrument_type.toLowerCase() as Sample["instrument_type"])
      : "other";

  if (instrumentType === "other" && row.sample_type === "kick") {
    instrumentType = "kick";
  }

  return {
    id: row.id,
    file_name: row.file_name,
    duration: row.duration ?? 0,
    bpm: row.bpm,
    periodicity: row.periodicity ?? 0,
    sample_rate: row.sample_rate ?? undefined,
    low_ratio: row.low_ratio ?? 0,
    attack_slope: row.attack_slope ?? 0,
    decay_time: row.decay_time,
    sample_type: normalizeSampleType(row.playback_type, row.sample_type),
    tags: [],
    waveform_peaks: waveformPeaks,
    playback_type: playbackType,
    instrument_type: instrumentType,
  };
};

export const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") {
      return message;
    }
  }

  return String(error);
};
