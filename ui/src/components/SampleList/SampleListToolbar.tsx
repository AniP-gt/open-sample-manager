import { useMemo } from "react";
import type { FilterState, Sample } from "../../types/sample";
import { KEY_FILTER_OPTIONS } from "../../utils/keyOptions";
import { ActiveSampleFilters } from "./ActiveSampleFilters";
import { SampleListSearch } from "./SampleListSearch";

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
  const instruments = useMemo(() => Array.from(new Set(
    (instrumentTypeOptions?.length ? instrumentTypeOptions : samples.map((sample) => sample.instrument_type)).filter(Boolean),
  )).sort(), [instrumentTypeOptions, samples]);
  const licenses = useMemo(() => Array.from(new Set(samples.flatMap((sample) => sample.license ? [sample.license] : []))).sort(), [samples]);
  return <div className="sample-toolbar">
    <div className="sample-search-row">
      <SampleListSearch appliedQuery={filters.search} onSubmit={onSearchSubmit} />
      <div className="sample-toolbar-actions">
        <span className="sample-result-count" role="status">{resultCount}/{samples.length} results</span>
        {preserveOrder && onRestoreSearchResults && <button type="button" onClick={onRestoreSearchResults}>Back to search results</button>}
        <button type="button" onClick={onRandom} disabled={resultCount === 0} title="Select random sample">Random</button>
        <button type="button" onClick={onRandomBack} disabled={!canRandomBack} title="Return to previous random sample">Back</button>
        <button type="button" onClick={() => onViewModeChange("list")} aria-label="List view" aria-pressed={viewMode === "list"} title="List view">☰</button>
        <button type="button" onClick={() => onViewModeChange("grid")} aria-label="Grid view" aria-pressed={viewMode === "grid"} title="Grid view">▦</button>
      </div>
    </div>
    <div className="sample-filters" aria-label="Sample filters">
      <label>Tempo
        <input type="number" value={filters.filterBpmMin} onChange={(event) => onFilterChange({ filterBpmMin: event.target.value })} placeholder="Min" aria-label="Sample BPM minimum" />
        <span>–</span>
        <input type="number" value={filters.filterBpmMax} onChange={(event) => onFilterChange({ filterBpmMax: event.target.value })} placeholder="Max" aria-label="Sample BPM maximum" />
      </label>
      <label>Type<select value={filters.filterType} onChange={(event) => {
        const value = event.target.value;
        if (value === "all" || value === "loop" || value === "one-shot") onFilterChange({ filterType: value });
      }} aria-label="Sample type filter">
        <option value="all">All types</option><option value="loop">loop</option><option value="one-shot">one-shot</option>
      </select></label>
      <label>Instrument<select value={filters.filterInstrumentType} onChange={(event) => {
        const value = instruments.find((instrument) => instrument === event.target.value) ?? "";
        onFilterChange({ filterInstrumentType: value });
      }} aria-label="Sample instrument type filter">
        <option value="">All instruments</option>
        {instruments.map((instrument) => <option key={instrument} value={instrument}>{instrument}</option>)}
      </select></label>
      <label>Key<select value={filters.filterKey} onChange={(event) => onFilterChange({ filterKey: event.target.value })} aria-label="Sample key filter">
        {KEY_FILTER_OPTIONS.map((key) => <option key={key || "all"} value={key}>{key || "All keys"}</option>)}
      </select></label>
      {showSampleMetadataQuality && <>
        <label>License<select value={filters.filterLicense} onChange={(event) => onFilterChange({ filterLicense: event.target.value })} aria-label="Sample license filter">
          <option value="">All licenses</option>
          {licenses.map((license) => <option key={license} value={license}>{license}</option>)}
        </select></label>
        <button type="button" aria-pressed={filters.qualityIssuesOnly} title="Show samples with quality flags" onClick={() => onFilterChange({ qualityIssuesOnly: !filters.qualityIssuesOnly })}>QC</button>
      </>}
    </div>
    {preserveOrder ? <p className="sample-result-count">{onRestoreSearchResults ? "External results" : "Collection"} · Search filters apply after returning to search results.</p>
      : <ActiveSampleFilters filters={filters} onChange={onFilterChange} onSearchSubmit={onSearchSubmit} />}
  </div>;
}
