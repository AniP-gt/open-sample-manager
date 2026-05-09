import { useState, useMemo } from "react";
import type { Midi } from "../../../types/midi";

export function useMidiSort(midis: Midi[], filterKey: string) {
  const [sortBy, setSortBy] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const filteredMidis = useMemo(() => {
    let result = midis;
    if (filterKey) {
      result = result.filter((m) => {
        if (!m.key_estimate) return false;
        const notePart = m.key_estimate.split(" ")[0];
        return notePart === filterKey;
      });
    }
    return result;
  }, [midis, filterKey]);

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
