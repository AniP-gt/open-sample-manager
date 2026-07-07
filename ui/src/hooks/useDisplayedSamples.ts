import { useMemo } from "react";
import type { Sample, FilterState } from "../types/sample";
import { matchesSampleFilters } from "../utils/sampleFilter";

export function useDisplayedSamples(
  samples: Sample[],
  filters: FilterState,
  favorites: number[]
) {
  return useMemo(() => {
    let list = samples;
    const favSet = new Set(favorites);
    if (filters.favoritesOnly) {
      list = list.filter((s) => favSet.has(s.id));
    }
    list = list.filter((sample) => matchesSampleFilters(sample, filters, favSet.has(sample.id)));
    return list;
  }, [samples, filters, favorites]);
}
