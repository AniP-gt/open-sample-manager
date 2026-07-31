import { useState, useMemo } from "react";
import type { Midi } from "../../../types/midi";
import { matchesMidiFilters } from "../utils/midiFilters";

export function useMidiSort(
  midis: Midi[],
  filterKey: string,
  searchText: string,
  tempoMin: string,
  tempoMax: string,
  tagName: string,
  musicalRole: string,
  polyphony: string,
  density: string,
  register: string,
  barCount: string,
) {
  const [sortBy, setSortBy] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const filteredMidis = useMemo(() => {
    return midis.filter((midi) => matchesMidiFilters(midi, {
      searchText,
      filterKey,
      tempoMin,
      tempoMax,
      tagName,
      musicalRole,
      polyphony,
      density,
      register,
      barCount,
    }));
  }, [midis, filterKey, searchText, tempoMin, tempoMax, tagName, musicalRole, polyphony, density, register, barCount]);

  const headerClick = (key: string) => {
    if (sortBy === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(key);
      setSortDir("asc");
    }
  };

  const headerKeyDown = (e: React.KeyboardEvent, key: string) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      headerClick(key);
    }
  };

  const getSortValue = (m: Midi, key: string): number | string | null => {
    switch (key) {
      case "id":
        return m.id;
      case "file_name":
        return m.file_name?.toLowerCase() ?? "";
      case "tag_name":
        return m.tag_name?.toLowerCase() ?? null;
      case "musical_role":
        return m.musical_role;
      case "polyphony":
        return m.polyphony;
      case "bar_count":
        return m.bar_count;
      case "suggested_instrument":
        return m.suggested_instrument;
      case "tempo":
        return m.tempo ?? null;
      case "time_sig":
        return m.time_signature_numerator != null ? (m.time_signature_numerator * 1000 + (m.time_signature_denominator ?? 0)) : null;
      case "track_count":
        return m.track_count ?? null;
      case "note_count":
        return m.note_count ?? null;
      case "key_estimate":
        return m.key_estimate?.toLowerCase() ?? null;
      case "duration":
        return m.duration ?? null;
      default:
        return null;
    }
  };

  const sortedMidis = useMemo(() => {
    if (!sortBy) return filteredMidis;
    const copy = [...filteredMidis];
    copy.sort((a, b) => {
      const av = getSortValue(a, sortBy);
      const bv = getSortValue(b, sortBy);
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;

      if (typeof av === "number" && typeof bv === "number") {
        return sortDir === "asc" ? av - bv : bv - av;
      }
      const as = String(av);
      const bs = String(bv);
      const cmp = as.localeCompare(bs);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredMidis, sortBy, sortDir]);

  return {
    sortBy,
    sortDir,
    filteredMidis,
    sortedMidis,
    headerClick,
    headerKeyDown,
  };
}
