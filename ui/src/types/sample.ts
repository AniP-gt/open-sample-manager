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
}

export interface FilterState {
  search: string;
  filterType: SampleType | "all";
  filterBpmMin: string;
  filterBpmMax: string;
  filterInstrumentType: InstrumentType | "";
}

export type SortField = "id" | "file_name" | "sample_type" | "instrument_type" | "bpm" | "duration" | "sample_rate";
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

export interface InstrumentTypeRow {
  id: number;
  name: string;
  created_at: string;
}
