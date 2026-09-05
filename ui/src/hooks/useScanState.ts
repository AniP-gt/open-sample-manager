import { useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { Midi } from "../types/midi";
import type { FilterState, Sample } from "../types/sample";
import type { ScanProgress } from "../types/scan";
import type { ViewMode } from "../types/viewMode";
import { useScanImports } from "./scanState/useScanImports";
import { useScanOperations } from "./scanState/useScanOperations";

type UseScanStateParams = {
  readonly getAllSamplePaths: () => string[];
  readonly getFilters: () => FilterState;
  readonly runSearch: (query: string) => Promise<Sample[]>;
  readonly fetchAllSamplePaths: () => Promise<void>;
  readonly fetchAllMidiPaths: () => Promise<void>;
  readonly getMidiDirectoryPath?: () => string;
  readonly getMidiTagFilterId?: () => number | null;
  readonly viewMode: ViewMode;
  readonly pageLimit: number;
  readonly setMidis: Dispatch<SetStateAction<Midi[]>>;
  readonly setLastFetchCountMidi: Dispatch<SetStateAction<number | null>>;
  readonly setSelected: Dispatch<SetStateAction<Sample | null>>;
};

export function useScanState({ getMidiDirectoryPath = () => "", getMidiTagFilterId = () => null, ...params }: UseScanStateParams) {
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null);
  const [rescanPromptOpen, setRescanPromptOpen] = useState(false);
  const [rescanPendingPath, setRescanPendingPath] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingTrashSampleId, setPendingTrashSampleId] = useState<number | null>(null);
  const [pendingTrashMidiId, setPendingTrashMidiId] = useState<number | null>(null);
  const [retryAction, setRetryAction] = useState<(() => Promise<void>) | null>(null);
  const [error, setError] = useState<string | null>(null);
  const dependencies = { ...params, getMidiDirectoryPath, getMidiTagFilterId };
  const setters = { setScanning, setScanned, setScanProgress, setError };
  const operations = useScanOperations({ ...dependencies, ...setters, setRescanPendingPath, setRescanPromptOpen });
  const imports = useScanImports({ ...dependencies, ...setters, ...operations });
  const handleRetry = async () => {
    if (!retryAction) return;
    setError(null);
    try { await retryAction(); setError(null); } catch (invokeError) { operations.handleInvokeError(invokeError); }
  };

  return {
    scanning, setScanning, scanned, setScanned, scanProgress, setScanProgress, rescanPromptOpen, setRescanPromptOpen,
    rescanPendingPath, setRescanPendingPath, confirmOpen, setConfirmOpen, pendingTrashSampleId, setPendingTrashSampleId,
    pendingTrashMidiId, setPendingTrashMidiId, retryAction, setRetryAction, error, setError,
    ...operations, ...imports, handleRetry, setSelected: params.setSelected,
  };
}
