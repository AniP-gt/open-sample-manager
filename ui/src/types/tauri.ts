export type TauriSampleRow = {
  id: number;
  path: string;
  file_name: string;
  duration: number | null;
  bpm: number | null;
  periodicity: number | null;
  sample_rate: number | null;
  low_ratio: number | null;
  attack_slope: number | null;
  decay_time: number | null;
  sample_type: string | null;
  waveform_peaks: string | null;
  playback_type: string;
  instrument_type: string;
  musical_key: string | null;
  source: string | null;
  pack_name: string | null;
  license: string | null;
  license_url: string | null;
  license_memo: string | null;
  imported_at: string | null;
  peak_db: number | null;
  rms_db: number | null;
  leading_silence_ms: number | null;
  clipping_count: number | null;
  channel_count: number | null;
  bit_depth: number | null;
  quality_flags: string | null;
  content_hash: string | null;
  duplicate_count: number | null;
  tags: string[];
};

export type DuplicateGroup = {
  content_hash: string;
  sample_count: number;
  total_file_size: number;
  samples: TauriSampleRow[];
};

export type LibraryExportSummary = {
  readonly folder_path: string;
  readonly database_path: string;
  readonly sample_count: number;
  readonly midi_count: number;
};

export type LibraryImportSummary = {
  readonly folder_path: string;
  readonly sample_count: number;
  readonly midi_count: number;
};
