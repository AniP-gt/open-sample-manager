import type { FilterState } from "../../types/sample";

export const clearedSampleFilters: FilterState = {
  search: "", filterType: "all", filterBpmMin: "", filterBpmMax: "",
  filterInstrumentType: "", filterKey: "", filterLicense: "",
  favoritesOnly: false, hideDuplicates: false, qualityIssuesOnly: false,
  directoryPath: "",
};

type Props = {
  readonly filters: FilterState;
  readonly onChange: (filters: Partial<FilterState>) => void;
  readonly onSearchSubmit?: (query: string) => void;
};

export function getActiveSampleFilters(filters: FilterState) {
  const conditions: { label: string; reset: Partial<FilterState> }[] = [];
  if (filters.search) conditions.push({ label: `Search: ${filters.search}`, reset: { search: "" } });
  if (filters.filterType !== "all") conditions.push({ label: `Type: ${filters.filterType}`, reset: { filterType: "all" } });
  if (filters.filterBpmMin || filters.filterBpmMax) conditions.push({ label: `Tempo: ${filters.filterBpmMin || "Any"}–${filters.filterBpmMax || "Any"} BPM`, reset: { filterBpmMin: "", filterBpmMax: "" } });
  if (filters.filterInstrumentType) conditions.push({ label: `Instrument: ${filters.filterInstrumentType}`, reset: { filterInstrumentType: "" } });
  if (filters.filterKey) conditions.push({ label: `Key: ${filters.filterKey}`, reset: { filterKey: "" } });
  if (filters.filterLicense) conditions.push({ label: `License: ${filters.filterLicense}`, reset: { filterLicense: "" } });
  if (filters.qualityIssuesOnly) conditions.push({ label: "Quality issues", reset: { qualityIssuesOnly: false } });
  if (filters.favoritesOnly) conditions.push({ label: "Favorites", reset: { favoritesOnly: false } });
  if (filters.hideDuplicates) conditions.push({ label: "Duplicates hidden", reset: { hideDuplicates: false } });
  if (filters.directoryPath) conditions.push({ label: `Folder: ${filters.directoryPath}`, reset: { directoryPath: "" } });
  return conditions;
}

export function ActiveSampleFilters({ filters, onChange, onSearchSubmit }: Props) {
  const conditions = getActiveSampleFilters(filters);
  if (conditions.length === 0) return null;
  return <div className="sample-active-filters" aria-label="Active sample filters">
    <span>Active:</span>
    {conditions.map(({ label, reset }) => <button key={label} type="button" aria-label={`Remove ${label}`} onClick={() => {
      onChange(reset);
      if (reset.search !== undefined) onSearchSubmit?.(reset.search);
    }}>{label} ×</button>)}
    <button type="button" onClick={() => { onChange(clearedSampleFilters); onSearchSubmit?.(""); }}>Clear all filters</button>
  </div>;
}
