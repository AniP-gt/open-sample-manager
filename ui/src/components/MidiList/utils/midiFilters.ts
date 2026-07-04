import type { Midi } from "../../../types/midi";
import { matchesFilenameSubstring } from "../../../utils/search";

export interface MidiFilterState {
  searchText: string;
  filterKey: string;
  tempoMin: string;
  tempoMax: string;
  tagName: string;
}

function parseBound(value: string) {
  if (!value.trim()) return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function matchesTempo(tempo: number | null, min: number | null, max: number | null) {
  if (min === null && max === null) return true;
  if (tempo === null) return false;
  if (min !== null && tempo < min) return false;
  if (max !== null && tempo > max) return false;
  return true;
}

function matchesKey(midi: Midi, filterKey: string) {
  if (!filterKey) return true;
  if (!midi.key_estimate) return false;
  return midi.key_estimate.split(" ")[0] === filterKey;
}

function matchesTag(midi: Midi, tagName: string) {
  if (!tagName) return true;
  return midi.tag_name === tagName;
}

export function matchesMidiFilters(midi: Midi, filters: MidiFilterState) {
  const minTempo = parseBound(filters.tempoMin);
  const maxTempo = parseBound(filters.tempoMax);

  if (!matchesFilenameSubstring(filters.searchText, midi.file_name)) return false;
  if (!matchesKey(midi, filters.filterKey)) return false;
  if (!matchesTempo(midi.tempo, minTempo, maxTempo)) return false;
  return matchesTag(midi, filters.tagName);
}
