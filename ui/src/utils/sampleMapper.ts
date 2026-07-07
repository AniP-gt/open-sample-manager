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


const parseQualityFlags = (value: string | null): string[] => {
  if (!value) return [];

  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((flag): flag is string => typeof flag === "string" && flag.trim() !== "");
  } catch {
    return [];
  }
};

const nullableString = (value: string | null): string | undefined => {
  if (value === null) return undefined;
  const trimmed = value.trim();
  return trimmed === "" ? undefined : trimmed;
};

const nullableNumber = (value: number | null): number | undefined => value ?? undefined;

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
    tags: row.tags,
    waveform_peaks: waveformPeaks,
    playback_type: playbackType,
    instrument_type: instrumentType,
    musical_key: row.musical_key ?? undefined,
    source: nullableString(row.source),
    pack_name: nullableString(row.pack_name),
    license: nullableString(row.license),
    license_url: nullableString(row.license_url),
    license_memo: nullableString(row.license_memo),
    imported_at: nullableString(row.imported_at),
    peak_db: nullableNumber(row.peak_db),
    rms_db: nullableNumber(row.rms_db),
    leading_silence_ms: nullableNumber(row.leading_silence_ms),
    clipping_count: nullableNumber(row.clipping_count),
    channel_count: nullableNumber(row.channel_count),
    bit_depth: nullableNumber(row.bit_depth),
    quality_flags: parseQualityFlags(row.quality_flags),
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
