import type { Sample } from "../types/sample";
import type { TauriSampleRow } from "../types/tauri";

export type EmbeddingSampleRow = Omit<TauriSampleRow, "sample_rate" | "musical_key" | "tags"> &
  Partial<Pick<TauriSampleRow, "sample_rate" | "musical_key" | "tags">>;

export const normalizeSampleType = (
  playbackType: string | null,
  sampleType: string | null,
): Sample["sample_type"] => {
  if (playbackType === "loop" || sampleType === "loop") {
    return "loop";
  }

  return "one-shot";
};

const normalizeInstrumentType = (instrumentType: string | null, sampleType: string | null): Sample["instrument_type"] => {
  const normalized = typeof instrumentType === "string" && instrumentType.trim() !== ""
    ? instrumentType.toLowerCase()
    : "other";

  if (
    normalized === "kick" ||
    normalized === "snare" ||
    normalized === "hihat" ||
    normalized === "bass" ||
    normalized === "synth" ||
    normalized === "fx" ||
    normalized === "vocal" ||
    normalized === "percussion" ||
    normalized === "other"
  ) {
    if (normalized === "other" && sampleType === "kick") {
      return "kick";
    }

    return normalized;
  }

  return sampleType === "kick" ? "kick" : "other";
};

export const mapEmbeddingRowToSample = (row: EmbeddingSampleRow): Sample => {
  return mapRowToSample({
    ...row,
    sample_rate: row.sample_rate ?? null,
    musical_key: row.musical_key ?? null,
    tags: row.tags ?? [],
  });
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

  const instrumentType = normalizeInstrumentType(row.instrument_type, row.sample_type);

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
    tags: row.tags,
    waveform_peaks: waveformPeaks,
    playback_type: playbackType,
    instrument_type: instrumentType,
    musical_key: row.musical_key ?? undefined,
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
