import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import "./styles/global.css";
import type { Sample, FilterState } from "./types/sample";
import type { ScanProgress } from "./types/scan";
import { Header, FilterSidebar, SampleList, DetailPanel, ScannerOverlay, SettingsModal } from "./components";

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
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [scannedPaths, setScannedPaths] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [retryAction, setRetryAction] = useState<(() => Promise<void>) | null>(
    null,
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [scanProgress, setScanProgress] = useState<ScanProgress | null>(null);

  const runSearch = async (query: string) => {
    const rows = await invoke<TauriSampleRow[]>("search_samples", { query });
    const nextSamples = rows.map(mapRowToSample);
    const nextPaths: Record<number, string> = {};

    rows.forEach((row) => {
      nextPaths[row.id] = row.path;
    });

    setSamplePaths(nextPaths);
    setSamples(nextSamples);
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
        setScannedPaths((prev) => [...prev, scanPath]);
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
          height: "calc(100vh - 57px)",
        }}
      >
        <FilterSidebar
          samples={samples}
          filters={filters}
          scannedPaths={scannedPaths}
          selectedPath={selected ? samplePaths[selected.id] : null}
          onFilterChange={handleFilterChange}
        />

        <SampleList
          samples={samples}
          samplePaths={samplePaths}
          filters={filters}
          selectedSample={selected}
          onSampleSelect={handleSampleSelect}
          onFilterChange={handleFilterChange}
          onDeleteSample={(id) => { void handleDeleteSample(id); }}
        />
        {selected && <DetailPanel sample={selected} path={samplePaths[selected.id]} />}
      </div>

      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        onClearAllSamples={handleClearAllSamples}
        sampleCount={samples.length}
      />
    </div>
  );
}
