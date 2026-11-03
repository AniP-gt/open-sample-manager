import type { Sample, SortState } from "../../types/sample";

export function sortSampleRows(filtered: readonly Sample[], sort: SortState): Sample[] {
  const copy = [...filtered];
  const dir = sort.direction === "asc" ? 1 : -1;
  copy.sort((a, b) => {
    switch (sort.field) {
      case "id": return (a.id - b.id) * dir;
      case "file_name": return a.file_name.localeCompare(b.file_name) * dir;
      case "sample_type": return a.sample_type.localeCompare(b.sample_type) * dir;
      case "instrument_type": return a.instrument_type.localeCompare(b.instrument_type) * dir;
      case "bpm": return ((a.bpm ?? 0) - (b.bpm ?? 0)) * dir;
      case "duration": return (a.duration - b.duration) * dir;
      case "sample_rate": return ((a.sample_rate ?? 0) - (b.sample_rate ?? 0)) * dir;
      case "musical_key": return (a.musical_key ?? "").localeCompare(b.musical_key ?? "") * dir;
      case "license": return (a.license ?? "").localeCompare(b.license ?? "") * dir;
      case "source": return (a.source ?? "").localeCompare(b.source ?? "") * dir;
      case "quality_flags": return (a.quality_flags.length - b.quality_flags.length) * dir;
      default: return 0;
    }
  });
  return copy;
}
