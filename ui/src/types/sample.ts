// Historically some records used "kick" in the sample_type field; keep it
// in the union for backward compatibility with older DB rows and UI
// components that may still check for it.
export type SampleType = "loop" | "one-shot" | "kick";

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
  attack_slope: number;
  decay_time: number | null;
  sample_type: SampleType;
  tags: string[];
  waveform_peaks: number[] | null;
  playback_type: PlaybackType;
  instrument_type: InstrumentType;
}

export interface FilterState {
  search: string;
  filterType: SampleType | "all";
  filterBpmMin: string;
  filterBpmMax: string;
}

export type SortField = "id" | "file_name" | "sample_type" | "bpm" | "duration" | "sample_rate";
export type SortDirection = "asc" | "desc";

export interface SortState {
  field: SortField;
  direction: SortDirection;
}

export interface TypeBadgeStyle {
  bg: string;
  color: string;
  border: string;
}
