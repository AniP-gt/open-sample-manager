import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import "./styles/global.css";
import type { Sample, FilterState, SortState } from "./types/sample";
import type { ScanProgress } from "./types/scan";
import { Header, FilterSidebar, SampleList, DetailPanel, ScannerOverlay, SettingsModal, PlayerBar, ClassificationEditModal } from "./components";

type TauriSampleRow = {
  id: number;
  path: string;
  file_name: string;
  duration: number | null;
  bpm: number | null;
  periodicity: number | null;
  low_ratio: number | null;
  attack_slope: number | null;
  decay_time: number | null;
  sample_type: string | null;
  waveform_peaks: string | null;
  playback_type: string;
  instrument_type: string;
};

const normalizeSampleType = (
  sampleType: string | null,
): Sample["sample_type"] => {
  if (sampleType === "kick" || sampleType === "loop") {
    return sampleType;
  }

  if (sampleType === "oneshot" || sampleType === "one-shot") {
    return "one-shot";
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
  const validInstrumentTypes = ["kick", "snare", "hihat", "bass", "synth", "fx", "vocal", "percussion", "other"];
  const instrumentType = validInstrumentTypes.includes(row.instrument_type) 
    ? row.instrument_type as Sample["instrument_type"] 
    : "other";

  return {
    id: row.id,
    file_name: row.file_name,
    duration: row.duration ?? 0,
    bpm: row.bpm,
    periodicity: row.periodicity ?? 0,
    low_ratio: row.low_ratio ?? 0,
    attack_slope: row.attack_slope ?? 0,
    decay_time: row.decay_time,
    sample_type: normalizeSampleType(row.sample_type),
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
  
  // Classification modal state
  const [classificationModalOpen, setClassificationModalOpen] = useState(false);
  const [classificationSample, setClassificationSample] = useState<Sample | null>(null);
  const [editPlaybackType, setEditPlaybackType] = useState<string>("");
  const [editInstrumentType, setEditInstrumentType] = useState<string>("");

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
  };

  const handleInvokeError = (e: unknown) => {
    setError(getErrorMessage(e));
  };

  const handleSearch = async (query: string) => {
    const action = () => runSearch(query);
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

    if (!path) {
      setSelected(sample);
      return;
    }

    const action = async () => {
      const row = await invoke<TauriSampleRow | null>("get_sample", { path });

      if (!row) {
        setSelected(sample);
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
    console.log("handleTypeClick - sample playback/instrument:", sample.playback_type, sample.instrument_type);
    setClassificationSample(sample);
    setEditPlaybackType(sample.playback_type);
    setEditInstrumentType(sample.instrument_type);
    setClassificationModalOpen(true);
  };

  const handleClassificationSave = async () => {
    if (!classificationSample) return;
    
    const path = samplePaths[classificationSample.id];
    if (!path) return;

    try {
      // Log the payload we are sending to the backend for easier tracing
      // eslint-disable-next-line no-console
      console.log("handleClassificationSave - invoking update_sample_classification", { path, playback_type: editPlaybackType, instrument_type: editInstrumentType });

      // Tauri command expects snake_case parameter names (playback_type, instrument_type)
      // (was previously sending camelCase keys which do not map to the Tauri command's parameters)
      await invoke<number>("update_sample_classification", {
        path,
        playback_type: editPlaybackType,
        instrument_type: editInstrumentType,
      });
      
      // Refresh the sample data
      const row = await invoke<TauriSampleRow | null>("get_sample", { path });
      if (row) {
        const updatedSample = mapRowToSample(row);
        setSamples((prev) =>
          prev.map((s) => (s.id === classificationSample.id ? updatedSample : s))
        );
        setSelected((prev) =>
          prev?.id === classificationSample.id ? updatedSample : prev
        );
      }
      setClassificationModalOpen(false);
    } catch (e) {
      handleInvokeError(e);
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
          samples={samples}
          filters={filters}
          scannedPaths={scannedPaths}
          selectedPath={selected ? samplePaths[selected.id] : null}
          onFilterChange={handleFilterChange}
          width={sidebarWidth}
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
          samples={samples}
          samplePaths={samplePaths}
          filters={filters}
          sort={sort}
          selectedSample={selected}
          onSampleSelect={handleSampleSelect}
          onFilterChange={handleFilterChange}
          onSortChange={setSort}
          onDeleteSample={(id) => { void handleDeleteSample(id); }}
          onTypeClick={handleTypeClick}
        />
        {selected && <DetailPanel 
          sample={selected} 
          path={samplePaths[selected.id]}
        />}
      </div>

      {selected && <PlayerBar sample={selected} path={samplePaths[selected.id]} />}

      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onClearAllSamples={handleClearAllSamples}
        sampleCount={samples.length}
      />

      <ClassificationEditModal
        isOpen={classificationModalOpen}
        sample={classificationSample}
        editPlaybackType={editPlaybackType}
        editInstrumentType={editInstrumentType}
        onPlaybackTypeChange={setEditPlaybackType}
        onInstrumentTypeChange={setEditInstrumentType}
        onSave={handleClassificationSave}
        onClose={() => setClassificationModalOpen(false)}
      />

    </div>
  );
}
