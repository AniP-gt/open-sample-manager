import type { Midi } from "../../../types/midi";
import { matchesFilenameSubstring } from "../../../utils/search";

export interface MidiFilterState {
  searchText: string;
  filterKey: string;
  tempoMin: string;
  tempoMax: string;
  tagName: string;
  musicalRole: string;
  polyphony: string;
  density: string;
  register: string;
  barCount: string;
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

function matchesClassification(midi: Midi, filters: MidiFilterState) {
  if (filters.musicalRole && midi.musical_role !== filters.musicalRole) return false;
  if (filters.polyphony && midi.polyphony !== filters.polyphony) return false;
  if (filters.density && midi.density !== filters.density) return false;
  if (filters.register && midi.register !== filters.register) return false;
  if (filters.barCount) {
    if (midi.bar_count === null) return false;
    if (Math.round(midi.bar_count) !== Number(filters.barCount)) return false;
  }
  return true;
}

export function matchesMidiFilters(midi: Midi, filters: MidiFilterState) {
  const minTempo = parseBound(filters.tempoMin);
  const maxTempo = parseBound(filters.tempoMax);

  if (!matchesFilenameSubstring(filters.searchText, midi.file_name)) return false;
  if (!matchesKey(midi, filters.filterKey)) return false;
  if (!matchesTempo(midi.tempo, minTempo, maxTempo)) return false;
  if (!matchesTag(midi, filters.tagName)) return false;
  return matchesClassification(midi, filters);
}
