export type SampleType = "kick" | "loop" | "one-shot";

export interface Sample {
  id: number;
  file_name: string;
  duration: number;
  bpm: number | null;
  periodicity: number;
  low_ratio: number;
  attack_slope: number;
  decay_time: number | null;
  sample_type: SampleType;
  tags: string[];
}

export interface FilterState {
  search: string;
  filterType: SampleType | "all";
  filterBpmMin: string;
  filterBpmMax: string;
}

export interface TypeBadgeStyle {
  bg: string;
  color: string;
  border: string;
}
