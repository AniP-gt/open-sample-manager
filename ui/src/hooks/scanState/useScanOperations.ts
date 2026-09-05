import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import type { Midi } from "../../types/midi";
import type { ScanProgress } from "../../types/scan";
import { getErrorMessage } from "../../utils/sampleMapper";
import type { ScanStateDependencies, ScanStateSetters } from "./scanStateTypes";

type UseScanOperationsParams = ScanStateDependencies & ScanStateSetters & {
  readonly setRescanPendingPath: (path: string | null) => void;
  readonly setRescanPromptOpen: (open: boolean) => void;
};

export function useScanOperations({
  getAllSamplePaths, getFilters, runSearch, fetchAllSamplePaths, fetchAllMidiPaths,
  getMidiDirectoryPath, getMidiTagFilterId, viewMode, pageLimit, setMidis,
  setLastFetchCountMidi, setScanning, setScanned, setScanProgress, setError,
  setRescanPendingPath, setRescanPromptOpen,
}: UseScanOperationsParams) {
  const handleInvokeError = (error: unknown) => setError(getErrorMessage(error));

  const refreshMidis = async () => {
    if (viewMode !== "midi") return;
    const midis = await invoke<Midi[]>("list_midis_paginated", {
      limit: pageLimit, offset: 0, directoryPath: getMidiDirectoryPath() || null, tagId: getMidiTagFilterId(),
    });
    setMidis(midis);
    setLastFetchCountMidi(midis.length);
    await fetchAllMidiPaths();
  };

  const scanMidiDirectory = async (path: string) => {
    try {
      await invoke<number>("scan_midi_directory", { path });
      await refreshMidis();
    } catch (error) {
      console.warn("MIDI scan failed:", error);
    }
  };

  const performScan = async (scanPath: string) => {
    setScanning(true); setScanProgress(null); setError(null);
    let lastProgressUpdate = 0;
    const unlisten = await listen<ScanProgress>("scan-progress", (event) => {
      const now = Date.now();
      if (now - lastProgressUpdate >= 100) { lastProgressUpdate = now; setScanProgress(event.payload); }
    });
    try {
      await invoke<number>("scan_directory", { path: scanPath });
      setScanned(true);
      await runSearch(getFilters().search);
      await fetchAllSamplePaths();
      await scanMidiDirectory(scanPath);
    } catch (error) {
      handleInvokeError(error);
    } finally {
      unlisten();
      setScanning(false); setScanProgress(null);
    }
  };

  const handleScanClick = async () => {
    try {
      const selectedPath = await open({ directory: true, multiple: false, title: "Select Sample Library Folder" });
      if (!selectedPath) return;
      const scanPath = typeof selectedPath === "string" ? selectedPath : selectedPath[0];
      if (getAllSamplePaths().length > 0) {
        setRescanPendingPath(scanPath); setRescanPromptOpen(true); return;
      }
      await performScan(scanPath);
    } catch {
      handleInvokeError(new Error("Dialog not available. Please run the app via 'npm run tauri:dev' instead of 'npm run dev'."));
    }
  };

  const handleReScanClick = async () => {
    setScanning(true); setScanProgress(null); setError(null);
    let lastProgressUpdate = 0;
    try {
      const unlisten = await listen<ScanProgress>("scan-progress", (event) => {
        const now = Date.now();
        if (now - lastProgressUpdate >= 100) { lastProgressUpdate = now; setScanProgress(event.payload); }
      });
      const count = await invoke<number>("re_scan_all_samples");
      setScanned(true); await runSearch(getFilters().search); await fetchAllSamplePaths();
      setScanProgress({ stage: "complete", current: 0, total: 0, currentFile: `Re-scanned ${count} samples` });
      unlisten();
    } catch (error) {
      handleInvokeError(error);
    } finally {
      setScanning(false); setScanProgress(null);
    }
  };

  return { performScan, handleScanClick, handleReScanClick, handleInvokeError, refreshMidis, scanMidiDirectory };
}
