import { useMemo } from "react";
import type { Sample, FilterState } from "../types/sample";
import { matchesSampleFilters } from "../utils/sampleFilter";

export function useDisplayedSamples(
  samples: Sample[],
  filters: FilterState,
  favorites: number[],
  avoidUsedSampleIds?: Set<number>
) {
  return useMemo(() => {
    let list = samples;
    if (filters.favoritesOnly) {
      const favSet = new Set(favorites);
      list = list.filter((s) => favSet.has(s.id));
    }
    if (avoidUsedSampleIds) {
      list = list.filter((sample) => !avoidUsedSampleIds.has(sample.id));
    }
    list = list.filter((sample) => matchesSampleFilters(sample, filters));
    return list;
  }, [samples, filters, favorites, avoidUsedSampleIds]);
}
