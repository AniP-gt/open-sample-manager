import { useState } from "react";
import "./styles/global.css";
import type { Sample, FilterState } from "./types/sample";
import { MOCK_SAMPLES } from "./data/mockSamples";
import {
  Header,
  FilterSidebar,
  SampleList,
  DetailPanel,
  ScannerOverlay,
} from "./components";

export function App() {
  const [samples] = useState<Sample[]>(MOCK_SAMPLES);
  const [selected, setSelected] = useState<Sample>(MOCK_SAMPLES[0]);
  const [filters, setFilters] = useState<FilterState>({
    search: "",
    filterType: "all",
    filterBpmMin: "",
    filterBpmMax: "",
  });
  const [scanning, setScanning] = useState(false);
  const [scanned, setScanned] = useState(false);

  const handleFilterChange = (newFilters: Partial<FilterState>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  };

  const handleSampleSelect = (sample: Sample) => {
    setSelected(sample);
  };

  const handleScanComplete = () => {
    setScanning(false);
    setScanned(true);
  };

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
      {scanning && <ScannerOverlay onDone={handleScanComplete} />}

      <Header
        sampleCount={samples.length}
        scanned={scanned}
        onScanClick={() => setScanning(true)}
      />

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
