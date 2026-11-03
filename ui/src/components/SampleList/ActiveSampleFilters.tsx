import { translate, instrumentName, translateLabel } from "../../i18n";
import { useTranslation } from "react-i18next";
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
  if (filters.search) conditions.push({ label: translate("filterSearch", { query: filters.search }), reset: { search: "" } });
  if (filters.filterType !== "all") conditions.push({ label: translate("filterType", { type: translateLabel(filters.filterType) }), reset: { filterType: "all" } });
  if (filters.filterBpmMin || filters.filterBpmMax) conditions.push({ label: translate("filterTempo", { min: filters.filterBpmMin || translate("any"), max: filters.filterBpmMax || translate("any") }), reset: { filterBpmMin: "", filterBpmMax: "" } });
  if (filters.filterInstrumentType) conditions.push({ label: translate("filterInstrument", { instrument: instrumentName(filters.filterInstrumentType) }), reset: { filterInstrumentType: "" } });
  if (filters.filterKey) conditions.push({ label: translate("filterKey", { key: filters.filterKey }), reset: { filterKey: "" } });
  if (filters.filterLicense) conditions.push({ label: translate("filterLicense", { license: filters.filterLicense }), reset: { filterLicense: "" } });
  if (filters.qualityIssuesOnly) conditions.push({ label: translate("qualityIssues"), reset: { qualityIssuesOnly: false } });
  if (filters.favoritesOnly) conditions.push({ label: translate("favoritesLabel"), reset: { favoritesOnly: false } });
  if (filters.hideDuplicates) conditions.push({ label: translate("duplicatesHidden"), reset: { hideDuplicates: false } });
  if (filters.directoryPath) conditions.push({ label: translate("filterFolder", { path: filters.directoryPath }), reset: { directoryPath: "" } });
  return conditions;
}

export function ActiveSampleFilters({ filters, onChange, onSearchSubmit }: Props) {
  useTranslation();
  const conditions = getActiveSampleFilters(filters);
  if (conditions.length === 0) return null;
  return <div className="sample-active-filters" aria-label={translate("activeSampleFilters")}>
    <span>{translate("active")}</span>
    {conditions.map(({ label, reset }) => <button key={label} type="button" aria-label={translate("removeActiveFilter", { label: label })} onClick={() => {
      onChange(reset);
      if (reset.search !== undefined) onSearchSubmit?.(reset.search);
    }}>{label} ×</button>)}
    <button type="button" onClick={() => { onChange(clearedSampleFilters); onSearchSubmit?.(""); }}>{translate("clearAllFilters")}</button>
  </div>;
}
