import { useEffect, useState, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import "./styles/global.css";
import type { Sample, FilterState, SortState, SampleType, InstrumentTypeRow } from "./types/sample";
import type { ScanProgress } from "./types/scan";
import type { Midi, MidiTagRow } from "./types/midi";
import type { TimidityStatus } from "./types/midi";
import { Header, FilterSidebar, SampleList, MidiList, DetailPanel, ScannerOverlay, SettingsModal, PlayerBar, ClassificationEditModal, ConfirmModal, InstrumentTypeManagementModal, MidiTagManagementModal, MidiTagEditModal, MidiDetailPanel, type PlayerBarHandle, type MidiListHandle } from "./components";
import type { SampleListHandle } from "./components/SampleList/SampleList";

type TauriSampleRow = {
  id: number;
  path: string;
  file_name: string;
  duration: number | null;
  bpm: number | null;
  periodicity: number | null;
  sample_rate: number | null;
  low_ratio: number | null;
  attack_slope: number | null;
  decay_time: number | null;
  sample_type: string | null;
  waveform_peaks: string | null;
  playback_type: string;
  instrument_type: string;
};

const normalizeSampleType = (
  playbackType: string | null,
  sampleType: string | null,
): Sample["sample_type"] => {
  if (playbackType === "loop" || sampleType === "loop") {
    return "loop";
  }

  return "one-shot";
};

const mapRowToSample = (row: TauriSampleRow): Sample => {
  let waveformPeaks: number[] | null = null;
  if (row.waveform_peaks) {
    try {
      waveformPeaks = JSON.parse(row.waveform_peaks);
    } catch {
      waveformPeaks = null;
    }
  }

  // Normalize playback_type
  const playbackType = row.playback_type === "loop" ? "loop" : "oneshot";

  // Accept custom instrument types returned from the DB (lowercase); fall
  // back to "other" when missing. This preserves user-created tags.
  let instrumentType = typeof row.instrument_type === "string" && row.instrument_type.trim() !== ""
    ? (row.instrument_type.toLowerCase() as Sample["instrument_type"]) 
    : "other";

  // Preserve historical mapping where sample_type="kick" -> instrument_type="kick".
  if (instrumentType === "other" && row.sample_type === "kick") {
    instrumentType = "kick";
  }

  return {
    id: row.id,
    file_name: row.file_name,
    duration: row.duration ?? 0,
    bpm: row.bpm,
    periodicity: row.periodicity ?? 0,
    sample_rate: row.sample_rate ?? undefined,
    low_ratio: row.low_ratio ?? 0,
    attack_slope: row.attack_slope ?? 0,
    decay_time: row.decay_time,
    sample_type: normalizeSampleType(row.playback_type, row.sample_type),
    tags: [],
    waveform_peaks: waveformPeaks,
    playback_type: playbackType,
    instrument_type: instrumentType,
  };
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") {
      return message;
    }
  }

  return String(error);
};

export function App() {
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
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [scannedPaths, setScannedPaths] = useState<string[]>([]);
  const [midiScannedPaths, setMidiScannedPaths] = useState<string[]>([]);
  // All sample paths from database (independent of filters/pagination)
  const [allSamplePaths, setAllSamplePaths] = useState<string[]>([]);
  const [allMidiPaths, setAllMidiPaths] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [retryAction, setRetryAction] = useState<(() => Promise<void>) | null>(
    null,
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(180);
  const [isResizing, setIsResizing] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const sampleListRef = useRef<SampleListHandle | null>(null);
  const midiListRef = useRef<MidiListHandle | null>(null);
  const playerBarRef = useRef<PlayerBarHandle | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isLoadingMoreMidi, setIsLoadingMoreMidi] = useState(false);
  // Sample/MIDI view mode
  const [viewMode, setViewMode] = useState<'sample' | 'midi'>('sample');
  const [midis, setMidis] = useState<Midi[]>([]);
  const [selectedMidi, setSelectedMidi] = useState<Midi | null>(null);
  const [timidityStatus, setTimidityStatus] = useState<TimidityStatus | null>(null);
  const [isMidiPlaying, setIsMidiPlaying] = useState(false);
  // keep error state for tests / debugging but avoid unused variable error
  const [midiTags, setMidiTags] = useState<MidiTagRow[]>([]);
  const [midiTagFilterId, setMidiTagFilterId] = useState<number | null>(null);
  const [midiSearch, setMidiSearch] = useState("");
  const [midiTagModalOpen, setMidiTagModalOpen] = useState(false);
  const [midiTagEditOpen, setMidiTagEditOpen] = useState(false);
  const [midiTagEditTarget, setMidiTagEditTarget] = useState<Midi | null>(null);

  // Check TiMidity status on mount
  useEffect(() => {
    invoke<TimidityStatus>('check_timidity')
      .then(setTimidityStatus)
      .catch(console.error);
  }, []);

  // Load MIDI list when switching to MIDI view
  useEffect(() => {
    if (viewMode === 'midi') {
      invoke<Midi[]>('list_midis_paginated', { limit: pageLimit, offset: 0 })
        .then((rows) => {
          setMidis(rows);
          setLastFetchCountMidi(rows.length);
        })
        .catch(console.error);
      void fetchAllMidiPaths();
      invoke<MidiTagRow[]>('get_midi_tags')
        .then(setMidiTags)
        .catch(console.error);
    }
  }, [viewMode]);

  const handleViewModeChange = (mode: 'sample' | 'midi') => {
    // Stop any playing MIDI when switching views
    if (isMidiPlaying) {
      void invoke('stop_midi').finally(() => setIsMidiPlaying(false));
    }
    // When switching to MIDI view, ensure any sample waveform UI / player is closed
    if (mode === 'midi') {
      try {
        // Stop and reset the PlayerBar if it's active
        playerBarRef.current?.stop();
      } catch (e) {
        // defensive: log but don't throw
        console.warn('Failed to stop PlayerBar when switching to MIDI view', e);
      }
      // Clear selected sample so the PlayerBar and DetailPanel hide
      setSelected(null);
    }
    // Reset MIDI search when switching away from MIDI view
    setMidiSearch("");
    setViewMode(mode);
  };
  const [lastFetchCount, setLastFetchCount] = useState<number | null>(null);
  const [lastFetchCountMidi, setLastFetchCountMidi] = useState<number | null>(null);
  const pageLimit = 20;
  
  // Classification modal state
  const [classificationModalOpen, setClassificationModalOpen] = useState(false);
  const [classificationSample, setClassificationSample] = useState<Sample | null>(null);
  const [editInstrumentType, setEditInstrumentType] = useState<string>("");
  const [editSampleType, setEditSampleType] = useState<SampleType>("one-shot");

  // Confirm modal state for trash actions
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingTrashSampleId, setPendingTrashSampleId] = useState<number | null>(null);
  // For pending MIDI trash actions
  const [pendingTrashMidiId, setPendingTrashMidiId] = useState<number | null>(null);
  // Instrument type management
  const [instrumentTypes, setInstrumentTypes] = useState<InstrumentTypeRow[]>([]);
  const [instrumentTypeModalOpen, setInstrumentTypeModalOpen] = useState(false);

  // Resize handler for sidebar
  const handleMouseDown = () => {
    setIsResizing(true);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizing) return;
    const newWidth = Math.max(100, Math.min(400, e.clientX));
    setSidebarWidth(newWidth);
  };

  const handleMouseUp = () => {
    setIsResizing(false);
  };

  // Add global event listeners for resize
  useEffect(() => {
    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isResizing]);

  // Load instrument types on mount
  useEffect(() => {
    invoke<InstrumentTypeRow[]>("get_instrument_types")
      .then((res) => setInstrumentTypes(res ?? []))
      .catch(console.error);
  }, []);

  // Load all sample paths on mount (for sidebar)
  useEffect(() => {
    fetchAllSamplePaths();
  }, []);
  // Listen for the SettingsModal's clear-all event and open the centralized confirm modal
  useEffect(() => {
    const handler = () => {
      setConfirmOpen(true);
      // mark a special sentinel to indicate 'clear all' rather than a single sample
      setPendingTrashSampleId(-1);
    };
    window.addEventListener("confirm-clear-all", handler as EventListener);
    return () => window.removeEventListener("confirm-clear-all", handler as EventListener);
  }, []);

  const runSearch = async (query: string) => {
    // Use paginated listing to avoid returning the entire DB to the renderer.
    const limit = 20;
    const rows = await invoke<TauriSampleRow[]>("list_samples_paginated", { query: query || null, limit, offset: 0 });
    const nextSamples = rows.map(mapRowToSample);
    const nextPaths: Record<number, string> = {};

    rows.forEach((row) => {
      nextPaths[row.id] = row.path;
    });

    setSamplePaths(nextPaths);
    setSamples(nextSamples);
    setLastFetchCount(rows.length);
    
    // Extract unique parent directories from sample paths for file tree
    const uniqueDirs = new Set<string>();
    rows.forEach((row) => {
      const pathParts = row.path.split("/");
      if (pathParts.length > 1) {
        // Get all parent directory paths
        let currentPath = "";
        for (let i = 0; i < pathParts.length - 1; i++) {
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

  // Fetch all sample paths from database (independent of pagination/filter)
  const fetchAllSamplePaths = async () => {
    try {
      const paths = await invoke<string[]>("list_all_sample_paths");
      setAllSamplePaths(paths);
    } catch (e) {
      console.error("Failed to fetch all sample paths:", e);
    }
  };

  const fetchAllMidiPaths = async () => {
    try {
      const paths = await invoke<string[]>("get_all_midi_paths");
      setAllMidiPaths(paths);
    } catch (e) {
      console.error("Failed to fetch all MIDI paths:", e);
    }
  };

  const requestTrashMidi = (id: number) => {
    // Open confirm modal and record pending midi id
    setPendingTrashMidiId(id);
    setConfirmOpen(true);
  };

  const confirmTrashMidi = async () => {
    if (pendingTrashMidiId == null) return;
    const midiRow = midis.find((m) => m.id === pendingTrashMidiId);
    const path = midiRow?.path;
    if (!path) {
      setConfirmOpen(false);
      setPendingTrashMidiId(null);
      return;
    }

    try {
      await invoke<string>("send_to_trash", { path });
      // refresh midi list
      const rows = await invoke<Midi[]>("list_midis_paginated", { limit: pageLimit, offset: 0 });
      setMidis(rows);
      setLastFetchCountMidi(rows.length);
      await fetchAllMidiPaths();
      if (selectedMidi?.id === pendingTrashMidiId) setSelectedMidi(null);
    } catch (e) {
      handleInvokeError(e);
    } finally {
      setConfirmOpen(false);
      setPendingTrashMidiId(null);
    }
  };

  useEffect(() => {
    if (viewMode !== 'midi') return;
    const uniqueDirs = new Set<string>();
    for (const fullPath of allMidiPaths) {
      const pathParts = fullPath.split("/");
      if (pathParts.length > 1) {
        let currentPath = "";
        for (let i = 0; i < pathParts.length - 1; i++) {
          currentPath += "/" + pathParts[i];
          uniqueDirs.add(currentPath);
        }
      }
    }
    setMidiScannedPaths(Array.from(uniqueDirs).sort());
  }, [allMidiPaths, viewMode]);

  const runMidiSearch = async (query: string) => {
    try {
      if (query.trim()) {
        const rows = await invoke<Midi[]>('search_midis', { query });
        setMidis(rows);
        setLastFetchCountMidi(rows.length);
      } else {
        const rows = await invoke<Midi[]>('list_midis_paginated', { limit: pageLimit, offset: 0 });
        setMidis(rows);
        setLastFetchCountMidi(rows.length);
      }
    } catch (e) {
      console.error('MIDI search failed:', e);
    }
  };
  // Load more results (append next page) - exposed for SampleList to render a "Load more" control
  const loadMore = async () => {
    setIsLoadingMore(true);
    try {
      const limit = pageLimit;
      const offset = samples.length;
      const rows = await invoke<TauriSampleRow[]>("list_samples_paginated", { query: filters.search || null, limit, offset });
      const nextSamples = rows.map(mapRowToSample);
      setSamples((prev) => {
        const existingIds = new Set(prev.map((s) => s.id));
        const fresh = nextSamples.filter((s) => !existingIds.has(s.id));
        return [...prev, ...fresh];
      });
      setSamplePaths((prev) => {
        const copy = { ...prev } as Record<number, string>;
        rows.forEach((r) => (copy[r.id] = r.path));
        return copy;
      });
      setLastFetchCount(rows.length);
    } catch (e) {
      handleInvokeError(e);
    } finally {
      setIsLoadingMore(false);
    }
  };

  // (Dev helper was removed in favor of prop-driven pagination)

  const handleInvokeError = (e: unknown) => {
    setError(getErrorMessage(e));
  };

  const handleSearch = async (query: string) => {
    // Wrap runSearch in a void-returning wrapper for retryAction to satisfy
    // the expected type `() => Promise<void>` used by the retry mechanism.
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
    // Stop playback when selecting a different sample
    if (selected?.id !== sample.id) {
      playerBarRef.current?.stop();
    }

    const path = samplePaths[sample.id];

    // Immediately set the selected sample so the SampleList can focus/scroll
    // to the row right away. We will refresh/replace the selected item with
    // the backend's canonical row once the invoke completes.
    setSelected(sample);
    // After updating selection state, ensure the SampleList focuses the selected row.
    // Use requestAnimationFrame so the DOM updates have a chance to paint before
    // attempting to focus the element.
    requestAnimationFrame(() => {
      sampleListRef.current?.focusSelected?.();
    });

    if (!path) {
      return;
    }

    const action = async () => {
      const row = await invoke<TauriSampleRow | null>("get_sample", { path });

      if (!row) {
        // Keep the optimistic selection; backend didn't return details.
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

  // Load sample by path from DB (used when clicking sidebar file not in loaded list)
  const loadSampleByPath = async (path: string) => {
    try {
      const row = await invoke<TauriSampleRow | null>("get_sample", { path });
      if (row) {
        const sample = mapRowToSample(row);
        setSamples((prev) => prev.some((s) => s.id === sample.id) ? prev : [sample, ...prev]);
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

  const handleScanClick = async () => {
    try {
      const selectedPath = await open({
        directory: true,
        multiple: false,
        title: "Select Sample Library Folder",
      });

      if (!selectedPath) {
        return;
      }

      const scanPath = typeof selectedPath === "string" ? selectedPath : selectedPath[0];

      setScanning(true);
      setScanProgress(null);
      setError(null);

      const unlisten = await listen<ScanProgress>("scan-progress", (event) => {
        setScanProgress(event.payload);
      });

        try {
          await invoke<number>("scan_directory", { path: scanPath });
          setScanned(true);
          await runSearch(filters.search);
          await fetchAllSamplePaths();

          // Also scan for MIDI files in the same directory. Keep failures
          // isolated so a MIDI scan error doesn't undo the sample scan result.
          try {
            await invoke<number>("scan_midi_directory", { path: scanPath });
            if (viewMode === 'midi') {
              const midiList = await invoke<Midi[]>("list_midis_paginated", { limit: pageLimit, offset: 0 });
              setMidis(midiList);
              setLastFetchCountMidi(midiList.length);
              await fetchAllMidiPaths();
            }
          } catch (midiErr) {
            // Non-fatal: log and continue
            // eslint-disable-next-line no-console
            console.warn("MIDI scan failed:", midiErr);
          }
      } catch (e) {
        handleInvokeError(e);
      } finally {
        unlisten();
        setScanning(false);
        setScanProgress(null);
      }
    } catch (e) {
      handleInvokeError(new Error("Dialog not available. Please run the app via 'npm run tauri:dev' instead of 'npm run dev'."));
    }
  };

  // Exposed callback forwarded into FilterSidebar so sidebar folder drops
  // can reuse the same scanning/import orchestration as the main list.
  const handleSidebarImport = async (rawPaths: string[]) => {
    const { handleImportPaths } = await import("./utils/handleImportPaths");
    await handleImportPaths(rawPaths, {
      invokeFn: (cmd, payload) => invoke(cmd as any, payload as any),
      listenFn: (event, cb) => listen(event, cb as any),
      runSearchFn: (q) => runSearch(q),
      onScanProgress: (p) => setScanProgress(p),
      setScanning: (v) => setScanning(v),
      setError: (m) => setError(m),
      getSearchQuery: () => filters.search,
    });
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
      setSamples([]);
      setSamplePaths({});
      setSelected(null);
      setScanned(false);
      setScannedPaths([]);
    } catch (e) {
      handleInvokeError(e);
    }
  };

  const handleTrashSample = async (sampleId: number) => {
    const path = samplePaths[sampleId];
    if (!path) return;

    try {
      // invoke returns a promise - ConfirmModal now shows a loading state while this runs
      await invoke<string>("send_to_trash", { path });
      await runSearch(filters.search);
      await fetchAllSamplePaths();
      if (selected?.id === sampleId) {
        setSelected(null);
      }
    } catch (e) {
      handleInvokeError(e);
    } finally {
      // Close confirm modal after action
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
      // special sentinel: clear all samples
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
    // Log incoming sample values to help debug modal default issues
    // (helps verify whether the sample.playback_type/instrument_type are correct when opening)
    // eslint-disable-next-line no-console
    console.log(
      "handleTypeClick - sample summary:",
      sample.sample_type,
      sample.playback_type,
      sample.instrument_type,
    );
    setClassificationSample(sample);
    setEditSampleType(sample.sample_type);
    setEditInstrumentType(sample.instrument_type);
    setClassificationModalOpen(true);
  };

  const handleSampleTypeSelect = (type: SampleType) => {
    setEditSampleType(type);
    // If the currently selected instrument was previously 'kick' but the
    // user changed the top-level sample type, avoid leaving instrument as
    // kick (kick is now an instrument tag). Convert it to 'other' so the
    // user consciously selects a proper instrument if desired.
    setEditInstrumentType((prev) => (prev === "kick" ? "other" : prev));
  };

  const handleClassificationSave = async () => {
    if (!classificationSample) return;
    const path = samplePaths[classificationSample.id];

    // Early exit for missing path
    if (!path) {
      setError("Sample path not available for update");
      return;
    }

    try {
      // Build payload: send null for empty strings so Rust receives Option::None
      // Also normalize values to allowed backend strings to avoid accidental mismatches.
      // Always send explicit values to backend. If the editing state is empty or
      // invalid, fall back to the currently opened sample's values so backend
      // receives a concrete value rather than `null`.
      const payloadPlayback = editSampleType === "loop" ? "loop" : "oneshot";
      const payloadInstrument =
        instrumentTypes.some((t) => t.name === editInstrumentType)
          ? editInstrumentType
          : classificationSample.instrument_type;
      console.log("handleClassificationSave - invoking update_sample_classification", { path, playback_type: payloadPlayback, instrument_type: payloadInstrument });
      const updateResult = await invoke<number>("update_sample_classification", {
        path,
        playbackType: payloadPlayback,
        instrumentType: payloadInstrument,
      });
      // Debug output: make it obvious in renderer console and optionally alert if no rows changed.
      // eslint-disable-next-line no-console
      console.log("update_sample_classification result:", updateResult);
      if (updateResult === 0) {
        setError("Sample not found in database. The file may have been moved or deleted.");
        return;
      }
      const refreshedList = await runSearch(filters.search);
      await fetchAllSamplePaths();
      console.log("refreshedList length:", refreshedList.length);
      const refreshedSample = refreshedList.find((s) => s.id === classificationSample.id) ?? null;
      console.log("refreshedSample:", refreshedSample);
      console.log("classificationSample.id:", classificationSample.id);
      console.log("samples state length:", samples.length);
      console.log("sample with same id in samples:", samples.find(s => s.id === classificationSample.id));
      console.log("refreshedSample.sample_type:", refreshedSample?.sample_type);
      console.log("refreshedSample.playback_type:", refreshedSample?.playback_type);
      setSelected((prev) =>
        prev?.id === classificationSample.id ? refreshedSample : prev
      );
      setClassificationModalOpen(false);
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      setError(`Failed to save: ${errorMsg}`);
    }
  };
  // Instrument type management functions
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

  // MIDI tag management functions
  const handleAddMidiTag = async (name: string) => {
    try {
      await invoke<number>('add_midi_tag', { name });
      const updated = await invoke<MidiTagRow[]>('get_midi_tags');
      setMidiTags(updated ?? []);
    } catch (e) {
      setError(`Failed to add MIDI tag: ${e}`);
    }
  };

  const handleDeleteMidiTag = async (id: number) => {
    try {
      await invoke<number>('delete_midi_tag', { id });
      const updated = await invoke<MidiTagRow[]>('get_midi_tags');
      setMidiTags(updated ?? []);
    } catch (e) {
      setError(`Failed to delete MIDI tag: ${e}`);
    }
  };

  const handleUpdateMidiTag = async (id: number, name: string) => {
    try {
      await invoke<number>('update_midi_tag', { id, name });
      const updated = await invoke<MidiTagRow[]>('get_midi_tags');
      setMidiTags(updated ?? []);
    } catch (e) {
      setError(`Failed to update MIDI tag: ${e}`);
    }
  };

  const handleMidiTagChange = async (midiId: number, tagId: number | null) => {
    try {
      await invoke('set_midi_file_tag', { midiId, tagId });
      const tagName = tagId != null ? (midiTags.find(t => t.id === tagId)?.name ?? '') : '';
      setMidis(prev => prev.map(m => m.id === midiId ? { ...m, tag_name: tagName } : m));
    } catch (e) {
      setError(`Failed to set MIDI tag: ${e}`);
    }
  };
  useEffect(() => {
    void handleSearch(filters.search);
  }, [filters.search]);
  useEffect(() => { if (viewMode === 'midi') { void runMidiSearch(midiSearch); } }, [midiSearch, viewMode]);

  // Fallback: Listen to Tauri-native drag/drop events when running inside
  // the Tauri webview. This is deterministic for obtaining full filesystem
  // paths from Finder/Explorer. If not running in Tauri (browser), this
  // will silently fail and the HTML5 drop handlers in SampleList remain.
  useEffect(() => {
    let unlistenEnter: (() => void) | null = null;
    let unlistenOver: (() => void) | null = null;
    let unlistenLeave: (() => void) | null = null;
    let unlistenDrop: (() => void) | null = null;

    const setup = async () => {
      try {
        // Drag enter - show visual affordance
        unlistenEnter = await listen<{ paths?: string[] }>("tauri://drag-enter", () => {
          setIsDragOver(true);
        });

        // Drag over (movement) - keep the visual state
        unlistenOver = await listen("tauri://drag-over", () => {
          setIsDragOver(true);
        });

        // Drag leave
        unlistenLeave = await listen("tauri://drag-leave", () => {
          setIsDragOver(false);
        });

        // Drop - payload contains `paths: string[]`
        unlistenDrop = await listen<{ paths?: string[] }>("tauri://drag-drop", (e) => {
          setIsDragOver(false);
          const paths = e.payload?.paths ?? [];
          if (paths.length > 0) {
            void handleImportPaths(paths);
          }
        });
      } catch (err) {
        // Not running in Tauri or event listen not available; ignore.
      }
    };

    void setup();

    return () => {
      try {
        unlistenEnter?.();
      } catch {}
      try {
        unlistenOver?.();
      } catch {}
      try {
        unlistenLeave?.();
      } catch {}
      try {
        unlistenDrop?.();
      } catch {}
    };
  }, [filters.search]);

  // Handle import paths (from SampleList drop or Tauri-native listener)
  const handleImportPaths = async (paths: string[]) => {
    if (!paths || paths.length === 0) return;

    // Dev-time trace to help manual verification: print incoming raw paths.
    // This makes it trivial to confirm a Finder/Explorer drop arrived in the
    // renderer and what the app will attempt to scan. Safe to leave in — it's
    // a low-noise console.debug that helps reproducibility.
    // eslint-disable-next-line no-console
    console.debug('handleImportPaths: received raw paths ->', paths);

    // Attempt to use @tauri-apps/plugin-fs.stat for deterministic file vs
    // directory detection when running inside Tauri. Fall back to a
    // heuristic (file if last path segment contains a dot) if stat isn't
    // available or fails for any entry.
    let statFn: ((p: string) => Promise<{ isDirectory: boolean; isFile: boolean }>) | null = null;
    try {
      // dynamic import keeps module resolution safe in non-Tauri test envs
      // and avoids top-level import causing bundlers to include native
      // plugin stubs unnecessarily.
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const fsMod = await import("@tauri-apps/plugin-fs");
      if (fsMod && typeof fsMod.stat === "function") {
        statFn = async (p: string) => {
          try {
            const info = await fsMod.stat(p as string);
            return { isDirectory: !!info.isDirectory, isFile: !!info.isFile };
          } catch {
            // stat failed for this path (allowlist or other); surface as unknown
            throw new Error("stat-failed");
          }
        };
      }
    } catch {
      statFn = null;
    }

    type Resolved = { kind: "file" | "dir"; path: string };
    const resolved: Resolved[] = [];

    // Process all dropped paths in parallel where possible
    const results = await Promise.allSettled(
      paths.map(async (p) => {
        if (!p) return null as Resolved | null;
        const normalized = p.replace(/\\/g, "/");

        if (statFn) {
          try {
            const info = await statFn(normalized);
            if (info.isDirectory) return { kind: "dir", path: normalized } as Resolved;
            if (info.isFile) return { kind: "file", path: normalized } as Resolved;
          } catch {
            // stat failed; fall back to heuristic below
          }
        }

        // Heuristic fallback: treat last segment with a dot as file
        const parts = normalized.split("/");
        const last = parts[parts.length - 1] ?? "";
        if (last.includes(".")) {
          return { kind: "file", path: normalized } as Resolved;
        }
        return { kind: "dir", path: normalized } as Resolved;
      }),
    );

    for (const r of results) {
      if (r.status === "fulfilled" && r.value) resolved.push(r.value as Resolved);
    }

    // If a single file was dropped, use the import_file fast-path. Otherwise
    // continue with directory dedupe/scan as before.
    if (resolved.length === 1 && resolved[0].kind === "file") {
      const filePath = resolved[0].path;
      setScanning(true);
      setScanProgress(null);
      setError(null);

      try {
        // Call new import_file command which analyzes and inserts a single file.
        await invoke<number>("import_file", { path: filePath });
        // eslint-disable-next-line no-console
        console.debug("handleImportPaths: invoked import_file for", filePath);
        setScanned(true);
        await runSearch(filters.search);
        await fetchAllSamplePaths();

        // If a single MIDI file was dropped while the app is in MIDI view,
        // also trigger a MIDI-specific scan so the MIDI list refreshes.
        try {
          const lower = filePath.toLowerCase();
          if (viewMode === 'midi' && (lower.endsWith('.mid') || lower.endsWith('.midi'))) {
            const lastSlash = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
            const folderPath = lastSlash > 0 ? filePath.substring(0, lastSlash) : filePath;
            await invoke<number>('scan_midi_directory', { path: folderPath });
            const midiList = await invoke<Midi[]>('list_midis_paginated', { limit: pageLimit, offset: 0 });
            setMidis(midiList);
            setLastFetchCountMidi(midiList.length);
            await fetchAllMidiPaths();
          }
        } catch (mErr) {
          // Non-fatal: log and continue
          console.warn('MIDI fast-path scan failed:', mErr);
        }
      } catch (e) {
        handleInvokeError(e);
      } finally {
        setScanning(false);
        setScanProgress(null);
      }
      return;
    }

    const normalizedTargets: string[] = [];
    for (const item of resolved) {
      if (item.kind === "dir") normalizedTargets.push(item.path);
      if (item.kind === "file") {
        // Convert file to parent directory for bulk scan flow
        const parts = item.path.split("/");
        normalizedTargets.push(parts.slice(0, -1).join("/") || "/");
      }
    }

    // Deduplicate while preserving order
    const uniqueDirs = Array.from(new Set(normalizedTargets));

    // Debug output for manual testing: show the final directories that will be
    // scanned and emitted to the backend. This helps confirm path normalization
    // without stepping through the full native flow.
    // eslint-disable-next-line no-console
    console.debug('handleImportPaths: normalized uniqueDirs ->', uniqueDirs);

    for (const dir of uniqueDirs) {
      setScanning(true);
      setScanProgress(null);
      setError(null);

      const unlisten = await listen<ScanProgress>("scan-progress", (event) => {
        setScanProgress(event.payload);
      });

        try {
          await invoke<number>("scan_directory", { path: dir });
          // eslint-disable-next-line no-console
          console.debug('handleImportPaths: invoked scan_directory for', dir);
          setScanned(true);
          await runSearch(filters.search);
          await fetchAllSamplePaths();

          // Also scan for MIDI files in this directory. Keep failures isolated
          // so MIDI errors don't undo the successful sample scan.
          try {
            await invoke<number>("scan_midi_directory", { path: dir });
            if (viewMode === 'midi') {
              const midiList = await invoke<Midi[]>("list_midis_paginated", { limit: pageLimit, offset: 0 });
              setMidis(midiList);
              setLastFetchCountMidi(midiList.length);
              await fetchAllMidiPaths();
            }
          } catch (midiErr) {
            // eslint-disable-next-line no-console
            console.warn("MIDI scan failed:", midiErr);
          }
      } catch (e) {
        handleInvokeError(e);
      } finally {
        try {
          unlisten();
        } catch {}
        setScanning(false);
        setScanProgress(null);
      }
    }
  };

  return (
    <div
      style={{
        background: "#080a0f",
        height: "100vh",
        fontFamily: "'Courier New', monospace",
        color: "#e2e8f0",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        minWidth: 0,
      }}
    >
      <Header
        sampleCount={samples.length}
        scanned={scanned}
        isDragOver={isDragOver}
        viewMode={viewMode}
        onViewModeChange={handleViewModeChange}
        onScanClick={() => {
          void handleScanClick();
        }}
        onSettingsClick={() => setSettingsOpen(true)}
        onReload={() => {
          void handleSearch(filters.search);
        }}
      />

      {error && (
        <div
          style={{
            margin: "10px 16px 0",
            padding: "10px 12px",
            border: "1px solid #ef444480",
            background: "#7f1d1d55",
            color: "#fecaca",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <span>{error}</span>
          <button
            type="button"
            onClick={() => {
              void handleRetry();
            }}
            style={{
              background: "#ef4444",
              border: "none",
              borderRadius: "2px",
              color: "#fff",
              fontFamily: "'Courier New', monospace",
              padding: "4px 10px",
              cursor: "pointer",
            }}
          >
            RETRY
          </button>
        </div>
      )}

        {scanning && (
          <ScannerOverlay progress={scanProgress} onDone={() => {}} />
        )}

      <div
        style={{
          display: "flex",
          flex: 1,
          overflow: "hidden",
          minWidth: 0,
          height: selected ? "calc(100vh - 57px - 160px)" : "calc(100vh - 57px)",
          transition: "height 0.3s ease",
        }}
      >
        <FilterSidebar
          scannedPaths={viewMode === 'midi' ? midiScannedPaths : scannedPaths}
          filePaths={viewMode === 'midi' ? allMidiPaths : allSamplePaths}
          selectedPath={viewMode === 'midi'
            ? (selectedMidi ? selectedMidi.path : null)
            : (selected ? samplePaths[selected.id] : null)
          }
          onFilterChange={handleFilterChange}
          onPathSelect={(path) => {
            // When a file path is clicked in the sidebar, find the corresponding
            // sample (by matching samplePaths) and focus/select it in the list.
            if (viewMode === 'midi') {
              const matchingMidi = midis.find((m) => m.path === path);
              if (matchingMidi) {
                if (isMidiPlaying) {
                  void invoke('stop_midi').finally(() => setIsMidiPlaying(false));
                }
                setSelectedMidi(matchingMidi);
                requestAnimationFrame(() => {
                  midiListRef.current?.focusSelected?.();
                });
              } else {
                void loadMidiByPath(path);
              }
              return;
            }

            const matching = samples.find((s) => samplePaths[s.id] === path);
            if (matching) {
              void handleSampleSelect(matching);
              return;
            }

            // Sample not in loaded list - fetch from DB
            void loadSampleByPath(path);
          }}
          onImportPaths={handleSidebarImport}
          width={sidebarWidth}
          bottomInset={(viewMode === 'sample' && selected) || (viewMode === 'midi' && selectedMidi) ? 160 : 0}
        />

        {/* Resize handle - simple inline handle kept for now */}
        <div
          onMouseDown={handleMouseDown}
          style={{
            width: "4px",
            background: isResizing ? "#f97316" : "#1f2937",
            cursor: "col-resize",
            transition: "background 0.2s",
            flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            if (!isResizing) e.currentTarget.style.background = "#374151";
          }}
          onMouseLeave={(e) => {
            if (!isResizing) e.currentTarget.style.background = "#1f2937";
          }}
        />

        {viewMode === 'sample' ? (
          <SampleList
            ref={sampleListRef}
            samples={samples}
            samplePaths={samplePaths}
            filters={filters}
            sort={sort}
            selectedSample={selected}
            onSampleSelect={handleSampleSelect}
            onFilterChange={handleFilterChange}
            onSortChange={setSort}
            onDeleteSample={(id) => { void handleDeleteSample(id); }}
            onTrashSample={(id) => { requestTrash(id); }}
            onTypeClick={handleTypeClick}
            onImportPaths={handleImportPaths}
            onLoadMore={loadMore}
            isLoadingMore={isLoadingMore}
            canLoadMore={lastFetchCount === null ? true : lastFetchCount === pageLimit}
          />
        ) : (
          <>
            <MidiList
              ref={midiListRef}
              midis={midiTagFilterId ? midis.filter(m => m.tag_name === (midiTags.find(t => t.id === midiTagFilterId)?.name ?? '')) : midis}
              selectedMidi={selectedMidi}
              onMidiSelect={(midi) => {
                if (isMidiPlaying) {
                  void invoke('stop_midi').finally(() => setIsMidiPlaying(false));
                }
                setSelectedMidi(midi);
                requestAnimationFrame(() => {
                  midiListRef.current?.focusSelected?.();
                });
              }}
              onTagBadgeClick={(midi) => { setMidiTagEditTarget(midi); setMidiTagEditOpen(true); }}
              midiTags={midiTags}
              onTagFilterChange={(id: number | null) => setMidiTagFilterId(id)}
              tagFilterId={midiTagFilterId}
              onTrashMidi={(id) => { requestTrashMidi(id); }}
              onLoadMore={async () => {
                setIsLoadingMoreMidi(true);
                try {
                  const limit = pageLimit;
                  const offset = midis.length;
                  const rows = await invoke<Midi[]>('list_midis_paginated', { limit, offset });
                  // append unique
                  setMidis((prev) => {
                    const existing = new Set(prev.map((m) => m.id));
                    const fresh = rows.filter((r) => !existing.has(r.id));
                    return [...prev, ...fresh];
                  });
                  setLastFetchCountMidi(rows.length);
                } catch (e) {
                  handleInvokeError(e);
                } finally {
                  setIsLoadingMoreMidi(false);
                }
              }}
              isLoadingMore={isLoadingMoreMidi}
              canLoadMore={lastFetchCountMidi === null ? true : lastFetchCountMidi === pageLimit}
              onImportPaths={handleImportPaths}
              externalIsDragOver={isDragOver}
              midiSearch={midiSearch}
              onMidiSearchChange={setMidiSearch}
            />
          
            {selectedMidi && viewMode === 'midi' && (
              <div style={{ position: 'relative', width: 'min(260px, 40vw)' }}>
                <MidiDetailPanel midi={selectedMidi} midiTags={midiTags} tagFilterId={midiTagFilterId ?? null} onTagFilterChange={(id: number | null) => setMidiTagFilterId(id)} onManageTags={() => setMidiTagModalOpen(true)} bottomInset={160} />
              </div>
            )}
          </>
        )}
        {/* MIDI Preview Bar - show when MIDI is selected */}
        {selectedMidi && viewMode === 'midi' && (
          <div
            style={{
              padding: "12px 20px",
              background: timidityStatus?.installed ? "#1f2937" : "#7f1d1d",
              borderTop: "1px solid #374151",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ color: "#e2e8f0", fontSize: "13px", fontFamily: "'Courier New', monospace" }}>
              ▶ {selectedMidi.file_name}
            </div>
            {timidityStatus?.installed ? (
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      if (isMidiPlaying) {
                        await invoke("stop_midi");
                        setIsMidiPlaying(false);
                      } else {
                        await invoke("play_midi", { path: selectedMidi.path });
                        setIsMidiPlaying(true);
                      }
                    } catch (e) {
                      setError(getErrorMessage(e));
                      setIsMidiPlaying(false);
                    }
                  }}
                  style={{
                    background: isMidiPlaying ? "#ef4444" : "#3b82f6",
                    border: "none",
                    color: "white",
                    padding: "6px 16px",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "12px",
                    fontFamily: "'Courier New', monospace",
                  }}
                >
                  {isMidiPlaying ? "Stop" : "Play"}
                </button>

              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ color: "#fca5a5", fontSize: "12px", fontFamily: "'Courier New', monospace" }}>
                  TiMidity not installed
                </span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(timidityStatus?.install_command || "");
                  }}
                  style={{
                    background: "#374151",
                    border: "1px solid #4b5563",
                    color: "#9ca3af",
                    padding: "4px 12px",
                    borderRadius: "4px",
                    cursor: "pointer",
                    fontSize: "11px",
                    fontFamily: "'Courier New', monospace",
                  }}
                >
                  Copy Install Command
                </button>
              </div>
            )}
          </div>
        )}
        {selected && viewMode === 'sample' && (
          <DetailPanel
            sample={selected}
            path={samplePaths[selected.id]}
            onSelect={(s) => {
              void handleSampleSelect(s);
            }}
            // Provide moved filter controls data + handler so DetailPanel can render them
            samples={samples}
            filters={filters}
            onFilterChange={handleFilterChange}
            onError={(message) => {
              setError(message);
            }}
            bottomInset={selected ? 160 : 0}
          />
        )}
      </div>

      {selected && (
        <PlayerBar
          ref={playerBarRef}
          sample={selected}
          path={samplePaths[selected.id]}
          onClose={() => {
            playerBarRef.current?.stop();
            setSelected(null);
          }}
        />
      )}

          <SettingsModal
            isOpen={settingsOpen}
            onClose={() => setSettingsOpen(false)}
            sampleCount={samples.length}
          />

      {/* Confirm modal for trashing samples */}
      <ConfirmModal
        isOpen={confirmOpen}
        title={pendingTrashSampleId === -1 ? "Clear All Samples" : (pendingTrashMidiId ? "Move MIDI to Trash" : "Move to Trash")}
        message={
          pendingTrashSampleId === -1
            ? "Are you sure you want to clear all samples from the library index? This will remove all samples from the application's index (your sample files on disk will NOT be deleted). This action cannot be undone in the app."
            : pendingTrashMidiId ? `Are you sure you want to move '${midis.find(m => m.id === pendingTrashMidiId)?.file_name ?? 'this MIDI file'}' to the Trash?` : `Are you sure you want to move '${samples.find(s => s.id === pendingTrashSampleId)?.file_name ?? 'this file'}' to the Trash?`
        }
        danger={pendingTrashSampleId === -1}
        onConfirm={async () => { if (pendingTrashMidiId) { await confirmTrashMidi(); } else { await confirmTrash(); } }}
        onCancel={() => { if (pendingTrashMidiId) { setPendingTrashMidiId(null); setConfirmOpen(false); } else { cancelTrash(); } }}
      />

      <ClassificationEditModal
        isOpen={classificationModalOpen}
        sample={classificationSample}
        editInstrumentType={editInstrumentType}
        editSampleType={editSampleType}
        instrumentTypes={instrumentTypes.map(t => t.name)}
        onInstrumentTypeChange={setEditInstrumentType}
        onSampleTypeChange={handleSampleTypeSelect}
        onSave={handleClassificationSave}
        onClose={() => setClassificationModalOpen(false)}
        onManageClick={() => setInstrumentTypeModalOpen(true)}
      />

      <InstrumentTypeManagementModal
        isOpen={instrumentTypeModalOpen}
        instrumentTypes={instrumentTypes}
        onAdd={handleAddInstrumentType}
        onDelete={handleDeleteInstrumentType}
        onUpdate={handleUpdateInstrumentType}
        onClose={() => setInstrumentTypeModalOpen(false)}
      />

      <MidiTagManagementModal
        isOpen={midiTagModalOpen}
        midiTags={midiTags}
        onAdd={handleAddMidiTag}
        onDelete={handleDeleteMidiTag}
        onUpdate={handleUpdateMidiTag}
        onClose={() => setMidiTagModalOpen(false)}
      />

      <MidiTagEditModal
        isOpen={midiTagEditOpen}
        midi={midiTagEditTarget}
        midiTags={midiTags}
        onSave={handleMidiTagChange}
        onClose={() => setMidiTagEditOpen(false)}
        onManageClick={() => { setMidiTagEditOpen(false); setMidiTagModalOpen(true); }}
      />

    </div>
  );
}
