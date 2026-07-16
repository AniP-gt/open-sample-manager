import { useCallback, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { Sample, FilterState, SortState } from "../../types/sample";
import type { ExternalSampleResults } from "../useExternalApiCommands";
import type { SamplePathMap } from "./samplePathHelpers";
import type { NullableSampleSetter, SamplePathMapSetter, SampleStateSetter } from "./sampleStateTypes";

type NormalSearchSnapshot = {
  readonly samples: Sample[];
  readonly samplePaths: SamplePathMap;
  readonly filters: FilterState;
  readonly sort: SortState;
  readonly selected: Sample | null;
};

type UseExternalResultStateParams = {
  readonly samples: Sample[];
  readonly samplePaths: SamplePathMap;
  readonly filters: FilterState;
  readonly sort: SortState;
  readonly selected: Sample | null;
  readonly setSamples: SampleStateSetter;
  readonly setSamplePaths: SamplePathMapSetter;
  readonly setFilters: Dispatch<SetStateAction<FilterState>>;
  readonly setSort: Dispatch<SetStateAction<SortState>>;
  readonly setSelected: NullableSampleSetter;
  readonly selectSample: (sample: Sample) => Promise<void>;
};

export function useExternalResultState({
  samples,
  samplePaths,
  filters,
  sort,
  selected,
  setSamples,
  setSamplePaths,
  setFilters,
  setSort,
  setSelected,
  selectSample,
}: UseExternalResultStateParams) {
  const [externalResults, setExternalResults] = useState<ExternalSampleResults | null>(null);
  const [snapshot, setSnapshot] = useState<NormalSearchSnapshot | null>(null);

  const showExternalResults = useCallback((results: ExternalSampleResults) => {
    const normalSnapshot = { samples, samplePaths, filters, sort, selected };
    setSnapshot((previous) => previous ?? normalSnapshot);
    setExternalResults(results);
    const selectedResult = results.selectedId === null ? null : results.samples.find((sample) => sample.id === results.selectedId) ?? null;
    if (selectedResult) {
      void selectSample(selectedResult);
    } else {
      setSelected(null);
    }
  }, [filters, samplePaths, samples, selectSample, selected, setSelected, sort]);

  const restoreSearchResults = useCallback(() => {
    if (!snapshot) return;
    setSamples(snapshot.samples);
    setSamplePaths(snapshot.samplePaths);
    setFilters(snapshot.filters);
    setSort(snapshot.sort);
    setSelected(snapshot.selected);
    setExternalResults(null);
    setSnapshot(null);
  }, [setFilters, setSamplePaths, setSamples, setSort, snapshot]);

  return { externalResults, showExternalResults, restoreSearchResults };
}
