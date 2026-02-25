import { useEffect, useState, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import "./styles/global.css";
import type { Sample, FilterState, SortState, SampleType } from "./types/sample";
import type { ScanProgress } from "./types/scan";
import { Header, FilterSidebar, SampleList, DetailPanel, ScannerOverlay, SettingsModal, PlayerBar, ClassificationEditModal, ConfirmModal } from "./components";
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

  // Normalize instrument_type
  const validInstrumentTypes = [
    "kick",
    "snare",
    "hihat",
    "bass",
    "synth",
    "fx",
    "vocal",
    "percussion",
    "other",
  ];

  // Prefer explicit instrument_type from the row. If missing but the
  // backend stored "kick" in sample_type historically, map it to the
  // instrument_type so the UI preserves the previous classification.
  let instrumentType = validInstrumentTypes.includes(row.instrument_type)
    ? (row.instrument_type as Sample["instrument_type"])
    : "other";

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
  });
  const [sort, setSort] = useState<SortState>({ field: "id", direction: "asc" });
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [scannedPaths, setScannedPaths] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [retryAction, setRetryAction] = useState<(() => Promise<void>) | null>(
    null,
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(180);
  const [isResizing, setIsResizing] = useState(false);
  const sampleListRef = useRef<SampleListHandle | null>(null);
  
  // Classification modal state
  const [classificationModalOpen, setClassificationModalOpen] = useState(false);
  const [classificationSample, setClassificationSample] = useState<Sample | null>(null);
  const [editInstrumentType, setEditInstrumentType] = useState<string>("");
  const [editSampleType, setEditSampleType] = useState<SampleType>("one-shot");

  // Confirm modal state for trash actions
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingTrashSampleId, setPendingTrashSampleId] = useState<number | null>(null);

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
    const rows = await invoke<TauriSampleRow[]>("search_samples", { query });
    const nextSamples = rows.map(mapRowToSample);
    const nextPaths: Record<number, string> = {};

    rows.forEach((row) => {
      nextPaths[row.id] = row.path;
    });

    setSamplePaths(nextPaths);
    setSamples(nextSamples);
    
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

  const handleDeleteSample = async (sampleId: number) => {
    const path = samplePaths[sampleId];
    if (!path) return;

    try {
      await invoke<number>("delete_sample", { path });
      await runSearch(filters.search);
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
      const allowedInstruments = [
        "kick",
        "snare",
        "hihat",
        "bass",
        "synth",
        "fx",
        "vocal",
        "percussion",
        "other",
      ];
      // Always send explicit values to backend. If the editing state is empty or
      // invalid, fall back to the currently opened sample's values so backend
      // receives a concrete value rather than `null`.
      const payloadPlayback = editSampleType === "loop" ? "loop" : "oneshot";
      const payloadInstrument =
        allowedInstruments.includes(editInstrumentType)
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

  useEffect(() => {
    void handleSearch(filters.search);
  }, [filters.search]);

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
      }}
    >
      <Header
        sampleCount={samples.length}
        scanned={scanned}
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
          height: selected ? "calc(100vh - 57px - 160px)" : "calc(100vh - 57px)",
          transition: "height 0.3s ease",
        }}
      >
        <FilterSidebar
          scannedPaths={scannedPaths}
          filePaths={samples.map((s) => samplePaths[s.id]).filter(Boolean)}
          selectedPath={selected ? samplePaths[selected.id] : null}
          onFilterChange={handleFilterChange}
          onPathSelect={(path) => {
            // When a file path is clicked in the sidebar, find the corresponding
            // sample (by matching samplePaths) and focus/select it in the list.
            const matching = samples.find((s) => samplePaths[s.id] === path);
            if (matching) {
              void handleSampleSelect(matching);
            }
          }}
          width={sidebarWidth}
          bottomInset={selected ? 160 : 0}
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
        />
        {selected && (
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
          />
        )}
      </div>

      {selected && <PlayerBar sample={selected} path={samplePaths[selected.id]} />}

          <SettingsModal
            isOpen={settingsOpen}
            onClose={() => setSettingsOpen(false)}
            sampleCount={samples.length}
          />

      {/* Confirm modal for trashing samples */}
      <ConfirmModal
        isOpen={confirmOpen}
        title={pendingTrashSampleId === -1 ? "Clear All Samples" : "Move to Trash"}
        message={
          pendingTrashSampleId === -1
            ? "Are you sure you want to clear all samples from the library index? This will remove all samples from the application's index (your sample files on disk will NOT be deleted). This action cannot be undone in the app."
            : `Are you sure you want to move '${samples.find(s => s.id === pendingTrashSampleId)?.file_name ?? 'this file'}' to the Trash?`
        }
        danger={pendingTrashSampleId === -1}
        onConfirm={async () => { await confirmTrash(); }}
        onCancel={() => { cancelTrash(); }}
      />

      <ClassificationEditModal
        isOpen={classificationModalOpen}
        sample={classificationSample}
        editInstrumentType={editInstrumentType}
        editSampleType={editSampleType}
        onInstrumentTypeChange={setEditInstrumentType}
        onSampleTypeChange={handleSampleTypeSelect}
        onSave={handleClassificationSave}
        onClose={() => setClassificationModalOpen(false)}
      />

    </div>
  );
}
