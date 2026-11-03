import type { FilterState } from "../../types/sample";

export const initialFilters: FilterState = {
  search: "",
  filterType: "all",
  filterBpmMin: "",
  filterBpmMax: "",
  filterInstrumentType: "",
  favoritesOnly: false,
  hideDuplicates: false,
  filterKey: "",
  filterLicense: "",
  qualityIssuesOnly: false,
  directoryPath: "",
};

export function withInstrumentFilter(query: string, instrumentType: string) {
  const trimmedQuery = query.trim();
  if (!instrumentType) return trimmedQuery;
  const instrumentClause = `instrument:${instrumentType}`;
  return trimmedQuery ? `${trimmedQuery} ${instrumentClause}` : instrumentClause;
}
