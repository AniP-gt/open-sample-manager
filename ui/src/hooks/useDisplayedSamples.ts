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
    if (filters.favoritesOnly) {
      const favSet = new Set(favorites);
      list = list.filter((s) => favSet.has(s.id));
    }
    list = list.filter((sample) => matchesSampleFilters(sample, filters));
    if (filters.hideDuplicates) {
      const seenHashes = new Set<string>();
      list = list.filter((sample) => {
        if (!sample.content_hash || (sample.duplicate_count ?? 1) <= 1) return true;
        if (seenHashes.has(sample.content_hash)) return false;
        seenHashes.add(sample.content_hash);
        return true;
      });
    }
    return list;
  }, [samples, filters, favorites]);
}
