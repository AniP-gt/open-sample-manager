// MIDI type definitions matching backend MidiRow

export interface Midi {
  id: number;
  path: string;
  file_name: string;
  duration: number | null;
  tempo: number | null;
  time_signature_numerator: number;
  time_signature_denominator: number;
  track_count: number | null;
  note_count: number | null;
  channel_count: number | null;
  key_estimate: string | null;
  file_size: number | null;
  created_at: string;
  modified_at: string;
}

/// Response for TiMidity availability check.
export interface TimidityStatus {
  installed: boolean;
  install_command: string;
}
