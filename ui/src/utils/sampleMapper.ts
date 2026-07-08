import type { Sample } from "../types/sample";
import type { TauriSampleRow } from "../types/tauri";

export type EmbeddingSampleRow = Omit<
  TauriSampleRow,
  | "sample_rate"
  | "musical_key"
  | "tags"
  | "source"
  | "pack_name"
  | "license"
  | "license_url"
  | "license_memo"
  | "imported_at"
  | "peak_db"
  | "rms_db"
  | "leading_silence_ms"
  | "clipping_count"
  | "channel_count"
  | "bit_depth"
  | "quality_flags"
  | "content_hash"
  | "duplicate_count"
> &
  Partial<
    Pick<
      TauriSampleRow,
      | "sample_rate"
      | "musical_key"
      | "tags"
      | "source"
      | "pack_name"
      | "license"
      | "license_url"
      | "license_memo"
      | "imported_at"
      | "peak_db"
      | "rms_db"
      | "leading_silence_ms"
      | "clipping_count"
      | "channel_count"
      | "bit_depth"
      | "quality_flags"
      | "content_hash"
      | "duplicate_count"
    >
  >;

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
    source: row.source ?? null,
    pack_name: row.pack_name ?? null,
    license: row.license ?? null,
    license_url: row.license_url ?? null,
    license_memo: row.license_memo ?? null,
    imported_at: row.imported_at ?? null,
    peak_db: row.peak_db ?? null,
    rms_db: row.rms_db ?? null,
    leading_silence_ms: row.leading_silence_ms ?? null,
    clipping_count: row.clipping_count ?? null,
    channel_count: row.channel_count ?? null,
    bit_depth: row.bit_depth ?? null,
    quality_flags: row.quality_flags ?? null,
    content_hash: row.content_hash ?? null,
    duplicate_count: row.duplicate_count ?? null,
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
    tags: Array.isArray(row.tags) ? row.tags : [],
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
    content_hash: row.content_hash ?? undefined,
    duplicate_count: row.duplicate_count ?? 1,
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
