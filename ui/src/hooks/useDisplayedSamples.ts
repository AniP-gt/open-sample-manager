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
