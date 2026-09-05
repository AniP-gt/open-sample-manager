import type { Dispatch, SetStateAction } from "react";
import type { Midi } from "../../types/midi";
import type { FilterState, Sample } from "../../types/sample";
import type { ScanProgress } from "../../types/scan";
import type { ViewMode } from "../../types/viewMode";

export type ScanStateDependencies = {
  readonly getAllSamplePaths: () => string[];
  readonly getFilters: () => FilterState;
  readonly runSearch: (query: string) => Promise<Sample[]>;
  readonly fetchAllSamplePaths: () => Promise<void>;
  readonly fetchAllMidiPaths: () => Promise<void>;
  readonly getMidiDirectoryPath: () => string;
  readonly getMidiTagFilterId: () => number | null;
  readonly viewMode: ViewMode;
  readonly pageLimit: number;
  readonly setMidis: Dispatch<SetStateAction<Midi[]>>;
  readonly setLastFetchCountMidi: Dispatch<SetStateAction<number | null>>;
};

export type ScanStateSetters = {
  readonly setScanning: Dispatch<SetStateAction<boolean>>;
  readonly setScanned: Dispatch<SetStateAction<boolean>>;
  readonly setScanProgress: Dispatch<SetStateAction<ScanProgress | null>>;
  readonly setError: Dispatch<SetStateAction<string | null>>;
};
