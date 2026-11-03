import { translate, instrumentName } from "../../i18n";
import { useTranslation } from "react-i18next";
import { useMemo } from "react";
import type { FilterState, Sample } from "../../types/sample";
import { KEY_FILTER_OPTIONS } from "../../utils/keyOptions";
import { ActiveSampleFilters } from "./ActiveSampleFilters";
import { SampleListSearch } from "./SampleListSearch";
import { formatNumber } from "../../i18n/formatters";

type Props = {
  readonly samples: readonly Sample[];
  readonly instrumentTypeOptions?: FilterState["filterInstrumentType"][];
  readonly filters: FilterState;
  readonly onFilterChange: (filters: Partial<FilterState>) => void;
  readonly onSearchSubmit?: (query: string) => void;
  readonly showSampleMetadataQuality: boolean;
  readonly resultCount: number;
  readonly onRandom: () => void;
  readonly onRandomBack: () => void;
  readonly canRandomBack: boolean;
  readonly viewMode: "list" | "grid";
  readonly onViewModeChange: (mode: "list" | "grid") => void;
  readonly preserveOrder: boolean;
  readonly onRestoreSearchResults?: () => void;
};

export function SampleListToolbar({ samples, instrumentTypeOptions, filters, onFilterChange, onSearchSubmit, showSampleMetadataQuality, resultCount, onRandom, onRandomBack, canRandomBack, viewMode, onViewModeChange, preserveOrder, onRestoreSearchResults }: Props) {
  useTranslation();
  const instruments = useMemo(() => Array.from(new Set(
    (instrumentTypeOptions?.length ? instrumentTypeOptions : samples.map((sample) => sample.instrument_type)).filter(Boolean),
  )).sort(), [instrumentTypeOptions, samples]);
  const licenses = useMemo(() => Array.from(new Set(samples.flatMap((sample) => sample.license ? [sample.license] : []))).sort(), [samples]);
  return <div className="sample-toolbar">
    <div className="sample-search-row">
      <SampleListSearch appliedQuery={filters.search} onSubmit={onSearchSubmit} />
      <div className="sample-toolbar-actions">
        <span className="sample-result-count" role="status">{translate("resultCount", { visible: formatNumber(resultCount), total: formatNumber(samples.length) })}</span>
        {preserveOrder && onRestoreSearchResults && <button type="button" onClick={onRestoreSearchResults}>{translate("backToSearchResults")}</button>}
        <button type="button" onClick={onRandom} disabled={resultCount === 0} title={translate("selectRandomSample")}>{translate("random")}</button>
        <button type="button" onClick={onRandomBack} disabled={!canRandomBack} title={translate("returnToPreviousRandomSample")}>{translate("back")}</button>
        <button type="button" onClick={() => onViewModeChange("list")} aria-label={translate("listView")} aria-pressed={viewMode === "list"} title={translate("listView")}>☰</button>
        <button type="button" onClick={() => onViewModeChange("grid")} aria-label={translate("gridView")} aria-pressed={viewMode === "grid"} title={translate("gridView")}>▦</button>
      </div>
    </div>
    <div className="sample-filters" aria-label={translate("sampleFilters")}>
      <label>{translate("tempo")}
        <input type="number" value={filters.filterBpmMin} onChange={(event) => onFilterChange({ filterBpmMin: event.target.value })} placeholder={translate("min")} aria-label={translate("sampleBpmMinimum")} />
        <span>–</span>
        <input type="number" value={filters.filterBpmMax} onChange={(event) => onFilterChange({ filterBpmMax: event.target.value })} placeholder={translate("max")} aria-label={translate("sampleBpmMaximum")} />
      </label>
      <label>{translate("type")}<select value={filters.filterType} onChange={(event) => {
        const value = event.target.value;
        if (value === "all" || value === "loop" || value === "one-shot") onFilterChange({ filterType: value });
      }} aria-label={translate("sampleTypeFilter")}>
        <option value="all">{translate("allTypes")}</option><option value="loop">{translate("loop")}</option><option value="one-shot">{translate("oneShot")}</option>
      </select></label>
      <label>{translate("instrument")}<select value={filters.filterInstrumentType} onChange={(event) => {
        const value = instruments.find((instrument) => instrument === event.target.value) ?? "";
        onFilterChange({ filterInstrumentType: value });
      }} aria-label={translate("sampleInstrumentTypeFilter")}>
        <option value="">{translate("allInstruments")}</option>
        {instruments.map((instrument) => <option key={instrument} value={instrument}>{instrumentName(instrument)}</option>)}
      </select></label>
      <label>{translate("key")}<select value={filters.filterKey} onChange={(event) => onFilterChange({ filterKey: event.target.value })} aria-label={translate("sampleKeyFilter")}>
        {KEY_FILTER_OPTIONS.map((key) => <option key={key || "all"} value={key}>{key || translate("allKeys")}</option>)}
      </select></label>
      {showSampleMetadataQuality && <>
        <label>{translate("license")}<select value={filters.filterLicense} onChange={(event) => onFilterChange({ filterLicense: event.target.value })} aria-label={translate("sampleLicenseFilter")}>
          <option value="">{translate("allLicenses")}</option>
          {licenses.map((license) => <option key={license} value={license}>{license}</option>)}
        </select></label>
        <button type="button" aria-pressed={filters.qualityIssuesOnly} title={translate("showSamplesWithQualityFlags")} onClick={() => onFilterChange({ qualityIssuesOnly: !filters.qualityIssuesOnly })}>{translate("qc")}</button>
      </>}
    </div>
    {preserveOrder ? <p className="sample-result-count">{onRestoreSearchResults ? translate("externalResults") : translate("collection")} {translate("searchFiltersApplyAfterReturningToSearchResults")}</p>
      : <ActiveSampleFilters filters={filters} onChange={onFilterChange} onSearchSubmit={onSearchSubmit} />}
  </div>;
}
