import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./styles/global.css";
import type { Sample, FilterState } from "./types/sample";
import { Header, FilterSidebar, SampleList, DetailPanel } from "./components";

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
};

const DEFAULT_SCAN_PATH = "/path";

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

const mapRowToSample = (row: TauriSampleRow): Sample => ({
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
});

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
  const [error, setError] = useState<string | null>(null);
  const [retryAction, setRetryAction] = useState<(() => Promise<void>) | null>(
    null,
  );

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
    const action = async () => {
      setScanning(true);
      await invoke<number>("scan_directory", { path: DEFAULT_SCAN_PATH });
      setScanned(true);
      await runSearch(filters.search);
    };

    setRetryAction(() => action);

    try {
      await action();
      setError(null);
    } catch (e) {
      handleInvokeError(e);
    } finally {
      setScanning(false);
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
        minHeight: "100vh",
        fontFamily: "'Courier New', monospace",
        color: "#e2e8f0",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Header
        sampleCount={samples.length}
        scanned={scanned}
        onScanClick={() => {
          void handleScanClick();
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
        <div
          style={{
            margin: "10px 16px 0",
            padding: "8px 12px",
            border: "1px solid #22d3ee40",
            background: "#082f4920",
            color: "#67e8f9",
          }}
        >
          Scanning sample library...
        </div>
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
          onFilterChange={handleFilterChange}
        />

        <SampleList
          samples={samples}
          filters={filters}
          selectedSample={selected}
          onSampleSelect={handleSampleSelect}
          onFilterChange={handleFilterChange}
        />

        {selected && <DetailPanel sample={selected} />}
      </div>
    </div>
  );
}
