import type { FilterState, Sample } from "../types/sample";
import { matchesSampleSearchDsl } from "./searchDsl";

function parseBound(value: string) {
  if (!value.trim()) return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function matchesBpm(sampleBpm: number | null, min: number | null, max: number | null) {
  if (min === null && max === null) return true;
  if (sampleBpm === null) return false;
  if (min !== null && sampleBpm < min) return false;
  if (max !== null && sampleBpm > max) return false;
  return true;
}

function matchesSearch(sample: Sample, query: string, isFavorite: boolean) {
  return matchesSampleSearchDsl(query, sample, isFavorite);
}

export function matchesSampleFilters(sample: Sample, filters: FilterState, isFavorite = false) {
  const minBpm = parseBound(filters.filterBpmMin);
  const maxBpm = parseBound(filters.filterBpmMax);
  const key = filters.filterKey;

  if (filters.filterType !== "all" && sample.sample_type !== filters.filterType) return false;
  if (filters.filterInstrumentType && sample.instrument_type !== filters.filterInstrumentType) return false;
  if (key && key !== "All" && sample.musical_key !== key) return false;
  if (!matchesBpm(sample.bpm, minBpm, maxBpm)) return false;
  return matchesSearch(sample, filters.search, isFavorite);
}
