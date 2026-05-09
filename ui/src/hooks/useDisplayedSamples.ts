import { useMemo } from "react";
import type { Sample, FilterState } from "../types/sample";
import type { Midi } from "../types/midi";

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
    const key = filters.filterKey;
    if (key && key !== "All") {
      list = list.filter((s) => s.musical_key === key);
    }
    return list;
  }, [samples, filters.favoritesOnly, filters.filterKey, favorites]);
}

export function useFilteredMidis(
  midis: Midi[],
  midiTagFilterId: number | null,
  midiTags: { id: number; name: string }[]
) {
  return useMemo(() => {
    if (!midiTagFilterId) return midis;
    const tagName = midiTags.find((t) => t.id === midiTagFilterId)?.name ?? "";
    return midis.filter((m) => m.tag_name === tagName);
  }, [midis, midiTagFilterId, midiTags]);
}
