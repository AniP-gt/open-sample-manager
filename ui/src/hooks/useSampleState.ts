import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Sample, FilterState, SortState, SampleType, InstrumentTypeRow } from "../types/sample";
import type { Midi } from "../types/midi";
import type { TauriSampleRow } from "../types/tauri";
import { getErrorMessage, mapRowToSample } from "../utils/sampleMapper";
import type { PlayerBarHandle, MidiListHandle } from "../components";
import type { SampleListHandle } from "../components/SampleList/SampleList";

type UseSampleStateParams = {
  setError: (message: string | null) => void;
  sampleListRef: React.RefObject<SampleListHandle | null>;
  midiListRef: React.RefObject<MidiListHandle | null>;
  playerBarRef: React.RefObject<PlayerBarHandle | null>;
  pageLimit: number;
  setMidis: React.Dispatch<React.SetStateAction<Midi[]>>;
  setSelectedMidi: React.Dispatch<React.SetStateAction<Midi | null>>;
  fetchAllMidiPaths: () => Promise<void>;
};

export function useSampleState({
  setError,
  sampleListRef,
  midiListRef,
  playerBarRef,
  pageLimit,
  setMidis,
  setSelectedMidi,
  fetchAllMidiPaths,
}: UseSampleStateParams) {
  const [samples, setSamples] = useState<Sample[]>([]);
  const [selected, setSelected] = useState<Sample | null>(null);
  const [samplePaths, setSamplePaths] = useState<Record<number, string>>({});
  const [filters, setFilters] = useState<FilterState>({
    search: "",
    filterType: "all",
    filterBpmMin: "",
    filterBpmMax: "",
    filterInstrumentType: "",
  });
  const [sort, setSort] = useState<SortState>({ field: "id", direction: "asc" });
  const [scannedPaths, setScannedPaths] = useState<string[]>([]);
  const [allSamplePaths, setAllSamplePaths] = useState<string[]>([]);
  const [lastFetchCount, setLastFetchCount] = useState<number | null>(null);
  const [currentOffset, setCurrentOffset] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isLoadingPrevious, setIsLoadingPrevious] = useState(false);
  const [canLoadMore, setCanLoadMore] = useState(true);
  const [canLoadPrevious, setCanLoadPrevious] = useState(false);
  const [classificationModalOpen, setClassificationModalOpen] = useState(false);
  const [classificationSample, setClassificationSample] = useState<Sample | null>(null);
  const [editInstrumentType, setEditInstrumentType] = useState<string>("");
  const [editSampleType, setEditSampleType] = useState<SampleType>("one-shot");
  const [instrumentTypes, setInstrumentTypes] = useState<InstrumentTypeRow[]>([]);
  const [instrumentTypeModalOpen, setInstrumentTypeModalOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingTrashSampleId, setPendingTrashSampleId] = useState<number | null>(null);
  const [retryAction, setRetryAction] = useState<(() => Promise<void>) | null>(null);

  const handleInvokeError = (e: unknown) => {
    setError(getErrorMessage(e));
  };

  const runSearch = async (query: string) => {
    const rows = await invoke<TauriSampleRow[]>("list_samples_paginated", {
      query: query || null,
      limit: pageLimit,
      offset: 0,
    });
    const nextSamples = rows.map(mapRowToSample);
    const nextPaths: Record<number, string> = {};

    rows.forEach((row) => {
      nextPaths[row.id] = row.path;
    });

    setSamplePaths(nextPaths);
    setSamples(nextSamples);
    setCurrentOffset(0);
    setLastFetchCount(rows.length);
    setCanLoadMore(rows.length >= pageLimit);
    setCanLoadPrevious(false);

    const uniqueDirs = new Set<string>();
    rows.forEach((row) => {
      const pathParts = row.path.split("/");
      if (pathParts.length > 1) {
        let currentPath = "";
        for (let i = 0; i < pathParts.length - 1; i += 1) {
          currentPath += "/" + pathParts[i];
          uniqueDirs.add(currentPath);
        }
      }
    });
    setScannedPaths(Array.from(uniqueDirs).sort());

    setSelected((prev) => {
      if (!prev) {
        return null;
      }
      return nextSamples.find((sample) => sample.id === prev.id) ?? null;
    });
    return nextSamples;
  };

  const fetchAllSamplePaths = async () => {
    try {
      const paths = await invoke<string[]>("list_all_sample_paths");
      setAllSamplePaths(paths);
    } catch (e) {
      console.error("Failed to fetch all sample paths:", e);
    }
  };

  const handleSearch = async (query: string) => {
    const action = async () => {
      await runSearch(query);
    };
    setRetryAction(() => action);

    try {
      await action();
      setError(null);
    } catch (e) {
      handleInvokeError(e);
    }
  };

  const handleFilterChange = (newFilters: Partial<FilterState>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  };

  const handleSampleSelect = async (sample: Sample) => {
    if (selected?.id !== sample.id) {
      playerBarRef.current?.stop();
    }

    const path = samplePaths[sample.id];
    setSelected(sample);
    requestAnimationFrame(() => {
      sampleListRef.current?.focusSelected?.();
    });

    if (!path) {
      return;
    }

    const action = async () => {
      const row = await invoke<TauriSampleRow | null>("get_sample", { path });

      if (!row) {
        return;
      }

      setSelected(mapRowToSample(row));
    };

    setRetryAction(() => action);

    try {
      await action();
      setError(null);
    } catch (e) {
      handleInvokeError(e);
      setSelected(sample);
    }
  };

  const togglePlayback = () => {
    if (!selected) return;
    const playerBar = playerBarRef.current;
    if (!playerBar) return;
    if (playerBar.isPlaying) {
      playerBar.stop();
    } else {
      playerBar.play();
    }
  };

  const loadSampleByPath = async (path: string) => {
    try {
      const row = await invoke<TauriSampleRow | null>("get_sample", { path });
      if (row) {
        const sample = mapRowToSample(row);
        setSamples((prev) => (prev.some((s) => s.id === sample.id) ? prev : [sample, ...prev]));
        setSamplePaths((prev) => ({ ...prev, [row.id]: row.path }));
        setSelected(sample);
      }
    } catch (e) {
      console.error("Failed to load sample:", e);
    }
  };

  const loadMidiByPath = async (path: string) => {
    try {
      const row = await invoke<Midi | null>("get_midi", { path });
      if (!row) return;
      setMidis((prev) => (prev.some((m) => m.id === row.id) ? prev : [row, ...prev]));
      setSelectedMidi(row);
      requestAnimationFrame(() => {
        midiListRef.current?.focusSelected?.();
      });
    } catch (e) {
      console.error("Failed to load MIDI:", e);
    }
  };

  const handleDeleteSample = async (sampleId: number) => {
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
      handleInvokeError(e);
    }
  };

  const handleClearAllSamples = async () => {
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
      handleInvokeError(e);
    }
  };

  const handleTrashSample = async (sampleId: number) => {
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
      handleInvokeError(e);
    } finally {
      setConfirmOpen(false);
      setPendingTrashSampleId(null);
    }
  };

  const requestTrash = (sampleId: number) => {
    setPendingTrashSampleId(sampleId);
    setConfirmOpen(true);
  };

  const confirmTrash = async () => {
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
  };

  const cancelTrash = () => {
    setPendingTrashSampleId(null);
    setConfirmOpen(false);
  };

  const handleRetry = async () => {
    if (!retryAction) {
      return;
    }

    setError(null);

    try {
      await retryAction();
      setError(null);
    } catch (e) {
      handleInvokeError(e);
    }
  };

  const handleTypeClick = (sample: Sample) => {
    setClassificationSample(sample);
    setEditSampleType(sample.sample_type);
    setEditInstrumentType(sample.instrument_type);
    setClassificationModalOpen(true);
  };

  const handleSampleTypeSelect = (type: SampleType) => {
    setEditSampleType(type);
    setEditInstrumentType((prev) => (prev === "kick" ? "other" : prev));
  };

  const handleClassificationSave = async () => {
    if (!classificationSample) return;
    const path = samplePaths[classificationSample.id];

    if (!path) {
      setError("Sample path not available for update");
      return;
    }

    try {
      const payloadPlayback = editSampleType === "loop" ? "loop" : "oneshot";
      const payloadInstrument =
        instrumentTypes.some((t) => t.name === editInstrumentType)
          ? editInstrumentType
          : classificationSample.instrument_type;
      const updateResult = await invoke<number>("update_sample_classification", {
        path,
        playbackType: payloadPlayback,
        instrumentType: payloadInstrument,
      });

      if (updateResult === 0) {
        setError("Sample not found in database. The file may have been moved or deleted.");
        return;
      }
      const refreshedList = await runSearch(filters.search);
      await fetchAllSamplePaths();
      const refreshedSample = refreshedList.find((s) => s.id === classificationSample.id) ?? null;
      setSelected((prev) => (prev?.id === classificationSample.id ? refreshedSample : prev));
      setClassificationModalOpen(false);
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      setError(`Failed to save: ${errorMsg}`);
    }
  };

  const handleAddInstrumentType = async (name: string) => {
    try {
      await invoke<number>("add_instrument_type", { name });
      const updated = await invoke<InstrumentTypeRow[]>("get_instrument_types");
      setInstrumentTypes(updated ?? []);
    } catch (e) {
      setError(`Failed to add instrument type: ${e}`);
    }
  };

  const handleDeleteInstrumentType = async (id: number) => {
    try {
      await invoke<number>("delete_instrument_type", { id });
      const updated = await invoke<InstrumentTypeRow[]>("get_instrument_types");
      setInstrumentTypes(updated ?? []);
    } catch (e) {
      setError(`Failed to delete instrument type: ${e}`);
    }
  };

  const handleUpdateInstrumentType = async (id: number, name: string) => {
    try {
      await invoke<number>("update_instrument_type", { id, name });
      const updated = await invoke<InstrumentTypeRow[]>("get_instrument_types");
      setInstrumentTypes(updated ?? []);
    } catch (e) {
      setError(`Failed to update instrument type: ${e}`);
    }
  };

  const loadMore = async () => {
    if (isLoadingMore || !canLoadMore) return;
    setIsLoadingMore(true);
    try {
      const nextOffset = currentOffset + samples.length;
      const rows = await invoke<TauriSampleRow[]>("list_samples_paginated", {
        query: filters.search || null,
        limit: pageLimit,
        offset: nextOffset,
      });
      const nextSamples = rows.map(mapRowToSample);
      setSamples((prev) => {
        const existingIds = new Set(prev.map((s) => s.id));
        const fresh = nextSamples.filter((s) => !existingIds.has(s.id));
        return [...prev, ...fresh];
      });
      setSamplePaths((prev) => {
        const copy = { ...prev } as Record<number, string>;
        rows.forEach((r) => {
          copy[r.id] = r.path;
        });
        return copy;
      });
      setLastFetchCount(rows.length);
      setCanLoadMore(rows.length >= pageLimit);
      setCanLoadPrevious(currentOffset > 0);
    } catch (e) {
      handleInvokeError(e);
    } finally {
      setIsLoadingMore(false);
    }
  };

  const loadPrevious = async () => {
    if (isLoadingPrevious || !canLoadPrevious || currentOffset === 0) return;
    setIsLoadingPrevious(true);
    try {
      const prevOffset = Math.max(0, currentOffset - pageLimit);
      const rows = await invoke<TauriSampleRow[]>("list_samples_paginated", {
        query: filters.search || null,
        limit: pageLimit,
        offset: prevOffset,
      });
      const nextSamples = rows.map(mapRowToSample);
      setSamples((prev) => {
        const existingIds = new Set(prev.map((s) => s.id));
        const fresh = nextSamples.filter((s) => !existingIds.has(s.id));
        return [...fresh, ...prev];
      });
      setSamplePaths((prev) => {
        const copy = { ...prev } as Record<number, string>;
        rows.forEach((r) => {
          copy[r.id] = r.path;
        });
        return copy;
      });
      setCurrentOffset(prevOffset);
      setCanLoadPrevious(prevOffset > 0);
      setCanLoadMore(true);
      setLastFetchCount(rows.length);
    } catch (e) {
      handleInvokeError(e);
    } finally {
      setIsLoadingPrevious(false);
    }
  };

  const loadAround = async (targetIndex: number) => {
    // Load items around targetIndex (±pageLimit/2 items)
    const halfWindow = Math.floor(pageLimit / 2);
    const aroundOffset = Math.max(0, targetIndex - halfWindow);
    
    setIsLoadingMore(true);
    setIsLoadingPrevious(true);
    try {
      const rows = await invoke<TauriSampleRow[]>("list_samples_paginated", {
        query: filters.search || null,
        limit: pageLimit,
        offset: aroundOffset,
      });
      const nextSamples = rows.map(mapRowToSample);
      const nextPaths: Record<number, string> = {};
      rows.forEach((row) => {
        nextPaths[row.id] = row.path;
      });
      setSamples(nextSamples);
      setSamplePaths(nextPaths);
      setCurrentOffset(aroundOffset);
      setLastFetchCount(rows.length);
      setCanLoadMore(rows.length >= pageLimit);
      setCanLoadPrevious(aroundOffset > 0);
    } catch (e) {
      handleInvokeError(e);
    } finally {
      setIsLoadingMore(false);
      setIsLoadingPrevious(false);
    }
  };

  useEffect(() => {
    invoke<InstrumentTypeRow[]>("get_instrument_types")
      .then((res) => setInstrumentTypes(res ?? []))
      .catch(console.error);
  }, []);

  useEffect(() => {
    void fetchAllSamplePaths();
  }, []);

  useEffect(() => {
    void handleSearch(filters.search);
  }, [filters.search]);

  useEffect(() => {
    const handler = () => {
      setConfirmOpen(true);
      setPendingTrashSampleId(-1);
    };
    window.addEventListener("osm:request-clear-all", handler as EventListener);
    return () => window.removeEventListener("osm:request-clear-all", handler as EventListener);
  }, []);

  return {
    samples,
    selected,
    setSelected,
    samplePaths,
    filters,
    setFilters,
    sort,
    setSort,
    scannedPaths,
    allSamplePaths,
    lastFetchCount,
    isLoadingMore,
    isLoadingPrevious,
    canLoadMore,
    canLoadPrevious,
    classificationModalOpen,
    setClassificationModalOpen,
    classificationSample,
    editInstrumentType,
    setEditInstrumentType,
    editSampleType,
    instrumentTypes,
    instrumentTypeModalOpen,
    setInstrumentTypeModalOpen,
    confirmOpen,
    pendingTrashSampleId,
    runSearch,
    fetchAllSamplePaths,
    handleSampleSelect,
    loadSampleByPath,
    loadMidiByPath,
    handleSearch,
    handleFilterChange,
    handleDeleteSample,
    handleClearAllSamples,
    handleTrashSample,
    requestTrash,
    confirmTrash,
    cancelTrash,
    handleRetry,
    handleTypeClick,
    handleSampleTypeSelect,
    handleClassificationSave,
    handleAddInstrumentType,
    handleDeleteInstrumentType,
    handleUpdateInstrumentType,
    loadMore,
    loadPrevious,
    loadAround,
    setConfirmOpen,
    setPendingTrashSampleId,
    togglePlayback,
  };
}
