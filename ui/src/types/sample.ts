// Historically some rows stored "kick" in sample_type; the UI now normalizes
// all non-loop samples to "one-shot" for consistency.
export type SampleType = "loop" | "one-shot";

export type PlaybackType = "loop" | "oneshot";

export type InstrumentType =
  | "kick"
  | "snare"
  | "hihat"
  | "bass"
  | "synth"
  | "fx"
  | "vocal"
  | "percussion"
  | "other";

export interface Sample {
  id: number;
  file_name: string;
  duration: number;
  bpm: number | null;
  periodicity: number;
  low_ratio: number;
  sample_rate?: number; // new: sample rate in Hz
  file_size?: number;
  artist?: string;
  attack_slope: number;
  decay_time: number | null;
  sample_type: SampleType;
  tags: string[];
  waveform_peaks: number[] | null;
  playback_type: PlaybackType;
  instrument_type: InstrumentType;
  /** Detected musical key (pitch class only: "C", "C#", ..., "B"). */
  musical_key?: string;
  source?: string;
  pack_name?: string;
  license?: string;
  license_url?: string;
  license_memo?: string;
  imported_at?: string;
  peak_db?: number;
  rms_db?: number;
  leading_silence_ms?: number;
  clipping_count?: number;
  channel_count?: number;
  bit_depth?: number;
  quality_flags: string[];
  content_hash?: string;
  duplicate_count?: number;
}

export interface SampleProcessingSettings {
  trimStartSeconds: number;
  trimEndSeconds: number;
  fadeInSeconds: number;
  fadeOutSeconds: number;
  gainDb: number;
}

export interface FilterState {
  search: string;
  filterType: SampleType | "all";
  filterBpmMin: string;
  filterBpmMax: string;
  filterInstrumentType: InstrumentType | "";
  favoritesOnly: boolean;
  hideDuplicates?: boolean;
  /** Pitch class filter (e.g. "C", "C#"); empty string = no filter. */
  filterKey: string;
  filterLicense: string;
  qualityIssuesOnly: boolean;
  directoryPath?: string;
}

export type SortField = "id" | "file_name" | "sample_type" | "instrument_type" | "bpm" | "duration" | "sample_rate" | "musical_key" | "license" | "source" | "quality_flags";
export type SortDirection = "asc" | "desc";

export interface SortState {
  field: SortField;
  direction: SortDirection;
}

export interface SampleCollection {
  id: number;
  name: string;
  description: string | null;
  sample_count: number;
  created_at: string;
  updated_at: string;
}

export interface SavedSearch {
  id: number;
  name: string;
  search: string;
  filter_type: FilterState["filterType"];
  filter_bpm_min: string;
  filter_bpm_max: string;
  filter_instrument_type: FilterState["filterInstrumentType"];
  favorites_only: boolean;
  filter_key: string;
  directory_path: string;
  sort_field: SortState["field"];
  sort_direction: SortState["direction"];
  created_at: string;
  updated_at: string;
}

export interface TypeBadgeStyle {
  bg: string;
  color: string;
  border: string;
}

export interface InstrumentTypeRow {
  id: number;
  name: string;
  created_at: string;
}
