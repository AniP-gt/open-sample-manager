import { useCallback, useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Dispatch, SetStateAction } from "react";
import type { Midi } from "../../types/midi";
import type { FilterState, Sample } from "../../types/sample";
import type {
  FetchAllSamplePaths,
  InvokeErrorHandler,
  NullableSampleSetter,
  RetryAction,
  RunSampleSearch,
  SamplePathMapSetter,
  SampleStateSetter,
  StringArraySetter,
} from "./sampleStateTypes";
import type { SamplePathMap } from "./samplePathHelpers";

type UseSampleTrashParams = {
  samplePaths: SamplePathMap;
  selected: Sample | null;
  setSelected: NullableSampleSetter;
  filters: FilterState;
  runSearch: RunSampleSearch;
  fetchAllSamplePaths: FetchAllSamplePaths;
  setSamples: SampleStateSetter;
  setSamplePaths: SamplePathMapSetter;
  setScannedPaths: StringArraySetter;
  setAllSamplePaths: StringArraySetter;
  setMidis: Dispatch<SetStateAction<Midi[]>>;
  setSelectedMidi: Dispatch<SetStateAction<Midi | null>>;
  fetchAllMidiPaths: () => Promise<void>;
  retryAction: RetryAction | null;
  setError: (message: string | null) => void;
  onInvokeError: InvokeErrorHandler;
};

export function useSampleTrash({
  samplePaths,
  selected,
  setSelected,
  filters,
  runSearch,
  fetchAllSamplePaths,
  setSamples,
  setSamplePaths,
  setScannedPaths,
  setAllSamplePaths,
  setMidis,
  setSelectedMidi,
  fetchAllMidiPaths,
  retryAction,
  setError,
  onInvokeError,
}: UseSampleTrashParams) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingTrashSampleId, setPendingTrashSampleId] = useState<number | null>(null);

  const handleDeleteSample = useCallback(
    async (sampleId: number) => {
      const path = samplePaths[sampleId];
      if (!path) return;

      try {
        await invoke<number>("delete_sample", { path });
        await runSearch(filters.search);
        await fetchAllSamplePaths();
        if (selected?.id === sampleId) {
          setSelected(null);
        }
      } catch (e) {
        onInvokeError(e);
      }
    },
    [fetchAllSamplePaths, filters.search, onInvokeError, runSearch, samplePaths, selected?.id, setSelected],
  );

  const handleClearAllSamples = useCallback(async () => {
    try {
      await invoke<number>("clear_all_samples");
      await invoke<number>("clear_all_midis");
      setSamples([]);
      setSamplePaths({});
      setSelected(null);
      setScannedPaths([]);
      setAllSamplePaths([]);
      setMidis([]);
      setSelectedMidi(null);
      await fetchAllMidiPaths();
    } catch (e) {
      onInvokeError(e);
    }
  }, [
    fetchAllMidiPaths,
    onInvokeError,
    setAllSamplePaths,
    setMidis,
    setSamplePaths,
    setSamples,
    setScannedPaths,
    setSelected,
    setSelectedMidi,
  ]);

  const handleTrashSample = useCallback(
    async (sampleId: number) => {
      const path = samplePaths[sampleId];
      if (!path) return;

      try {
        await invoke<string>("send_to_trash", { path });
        await runSearch(filters.search);
        await fetchAllSamplePaths();
        if (selected?.id === sampleId) {
          setSelected(null);
        }
      } catch (e) {
        onInvokeError(e);
      } finally {
        setConfirmOpen(false);
        setPendingTrashSampleId(null);
      }
    },
    [fetchAllSamplePaths, filters.search, onInvokeError, runSearch, samplePaths, selected?.id, setSelected],
  );

  const requestTrash = useCallback((sampleId: number) => {
    setPendingTrashSampleId(sampleId);
    setConfirmOpen(true);
  }, []);

  const confirmTrash = useCallback(async () => {
    if (pendingTrashSampleId == null) return;
    if (pendingTrashSampleId === -1) {
      try {
        await handleClearAllSamples();
      } finally {
        setConfirmOpen(false);
        setPendingTrashSampleId(null);
      }
      return;
    }

    await handleTrashSample(pendingTrashSampleId);
  }, [handleClearAllSamples, handleTrashSample, pendingTrashSampleId]);

  const cancelTrash = useCallback(() => {
    setPendingTrashSampleId(null);
    setConfirmOpen(false);
  }, []);

  const handleRetry = useCallback(async () => {
    if (!retryAction) {
      return;
    }

    setError(null);

    try {
      await retryAction();
      setError(null);
    } catch (e) {
      onInvokeError(e);
    }
  }, [onInvokeError, retryAction, setError]);

  useEffect(() => {
    const handler = () => {
      setConfirmOpen(true);
      setPendingTrashSampleId(-1);
    };
    window.addEventListener("osm:request-clear-all", handler as EventListener);
    return () => window.removeEventListener("osm:request-clear-all", handler as EventListener);
  }, []);

  return {
    confirmOpen,
    setConfirmOpen,
    pendingTrashSampleId,
    setPendingTrashSampleId,
    handleDeleteSample,
    handleClearAllSamples,
    handleTrashSample,
    requestTrash,
    confirmTrash,
    cancelTrash,
    handleRetry,
  };
}
