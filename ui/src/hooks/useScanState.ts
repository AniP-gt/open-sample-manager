import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { open } from "@tauri-apps/plugin-dialog";
import type { FilterState, Sample } from "../types/sample";
import type { ScanProgress } from "../types/scan";
import type { Midi } from "../types/midi";
import { getErrorMessage } from "../utils/sampleMapper";

type UseScanStateParams = {
  getAllSamplePaths: () => string[];
  getFilters: () => FilterState;
  runSearch: (query: string) => Promise<Sample[]>;
  fetchAllSamplePaths: () => Promise<void>;
  fetchAllMidiPaths: () => Promise<void>;
  viewMode: "sample" | "midi";
  pageLimit: number;
  setMidis: React.Dispatch<React.SetStateAction<Midi[]>>;
  setLastFetchCountMidi: React.Dispatch<React.SetStateAction<number | null>>;
  setSelected: React.Dispatch<React.SetStateAction<Sample | null>>;
};

export function useScanState({
  getAllSamplePaths,
  getFilters,
  runSearch,
  fetchAllSamplePaths,
  fetchAllMidiPaths,
  viewMode,
  pageLimit,
  setMidis,
  setLastFetchCountMidi,
  setSelected,
}: UseScanStateParams) {
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

  const handleInvokeError = (e: unknown) => {
    setError(getErrorMessage(e));
  };

  const performScan = async (scanPath: string) => {
    setScanning(true);
    setScanProgress(null);
    setError(null);

    const unlisten = await listen<ScanProgress>("scan-progress", (event) => {
      setScanProgress(event.payload);
    });

    try {
      await invoke<number>("scan_directory", { path: scanPath });
      setScanned(true);
      await runSearch(getFilters().search);
      await fetchAllSamplePaths();

      try {
        await invoke<number>("scan_midi_directory", { path: scanPath });
        if (viewMode === "midi") {
          const midiList = await invoke<Midi[]>("list_midis_paginated", { limit: pageLimit, offset: 0 });
          setMidis(midiList);
          setLastFetchCountMidi(midiList.length);
          await fetchAllMidiPaths();
        }
      } catch (midiErr) {
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
      const allSamplePaths = getAllSamplePaths();
      if (allSamplePaths && allSamplePaths.length > 0) {
        setRescanPendingPath(scanPath);
        setRescanPromptOpen(true);
        return;
      }

      await performScan(scanPath);
    } catch {
      handleInvokeError(
        new Error("Dialog not available. Please run the app via 'npm run tauri:dev' instead of 'npm run dev'."),
      );
    }
  };

  const handleSidebarImport = async (rawPaths: string[]) => {
    const { handleImportPaths } = await import("../utils/handleImportPaths");
    await handleImportPaths(rawPaths, {
      invokeFn: (cmd, payload) => invoke(cmd as never, payload as never),
      listenFn: (event, cb) => listen(event, cb as never),
      runSearchFn: (q) => runSearch(q),
      onScanProgress: (p) => setScanProgress(p),
      setScanning: (v) => setScanning(v),
      setError: (m) => setError(m),
      getSearchQuery: () => getFilters().search,
    });
    await fetchAllSamplePaths();
    if (viewMode === "midi") {
      const rows = await invoke<Midi[]>("list_midis_paginated", { limit: pageLimit, offset: 0 });
      setMidis(rows);
      setLastFetchCountMidi(rows.length);
      await fetchAllMidiPaths();
    }
  };

  const handleImportPaths = async (paths: string[]) => {
    if (!paths || paths.length === 0) return;

    let statFn: ((p: string) => Promise<{ isDirectory: boolean; isFile: boolean }>) | null = null;
    try {
      const fsMod = await import("@tauri-apps/plugin-fs");
      if (fsMod && typeof fsMod.stat === "function") {
        statFn = async (p: string) => {
          const info = await fsMod.stat(p);
          return { isDirectory: !!info.isDirectory, isFile: !!info.isFile };
        };
      }
    } catch {
      statFn = null;
    }

    type Resolved = { kind: "file" | "dir"; path: string };
    const resolved: Resolved[] = [];
    const results = await Promise.allSettled(
      paths.map(async (p) => {
        if (!p) return null as Resolved | null;
        const normalized = p.replace(/\\/g, "/");

        if (statFn) {
          try {
            const info = await statFn(normalized);
            if (info.isDirectory) return { kind: "dir", path: normalized } as Resolved;
            if (info.isFile) return { kind: "file", path: normalized } as Resolved;
          } catch {}
        }

        const parts = normalized.split("/");
        const last = parts[parts.length - 1] ?? "";
        if (last.includes(".")) {
          return { kind: "file", path: normalized } as Resolved;
        }
        return { kind: "dir", path: normalized } as Resolved;
      }),
    );

    for (const r of results) {
      if (r.status === "fulfilled" && r.value) resolved.push(r.value);
    }

    if (resolved.length === 1 && resolved[0].kind === "file") {
      const filePath = resolved[0].path;
      setScanning(true);
      setScanProgress(null);
      setError(null);

      try {
        await invoke<number>("import_file", { path: filePath });
        setScanned(true);
        await runSearch(getFilters().search);
        await fetchAllSamplePaths();

        try {
          const lower = filePath.toLowerCase();
          if (viewMode === "midi" && (lower.endsWith(".mid") || lower.endsWith(".midi"))) {
            const lastSlash = Math.max(filePath.lastIndexOf("/"), filePath.lastIndexOf("\\"));
            const folderPath = lastSlash > 0 ? filePath.substring(0, lastSlash) : filePath;
            await invoke<number>("scan_midi_directory", { path: folderPath });
            const midiList = await invoke<Midi[]>("list_midis_paginated", { limit: pageLimit, offset: 0 });
            setMidis(midiList);
            setLastFetchCountMidi(midiList.length);
            await fetchAllMidiPaths();
          }
        } catch (mErr) {
          console.warn("MIDI fast-path scan failed:", mErr);
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
        const parts = item.path.split("/");
        normalizedTargets.push(parts.slice(0, -1).join("/") || "/");
      }
    }

    const uniqueDirs = Array.from(new Set(normalizedTargets));
    for (const dir of uniqueDirs) {
      setScanning(true);
      setScanProgress(null);
      setError(null);

      const unlisten = await listen<ScanProgress>("scan-progress", (event) => {
        setScanProgress(event.payload);
      });

      try {
        await invoke<number>("scan_directory", { path: dir });
        setScanned(true);
        await runSearch(getFilters().search);
        await fetchAllSamplePaths();

        try {
          await invoke<number>("scan_midi_directory", { path: dir });
          if (viewMode === "midi") {
            const midiList = await invoke<Midi[]>("list_midis_paginated", { limit: pageLimit, offset: 0 });
            setMidis(midiList);
            setLastFetchCountMidi(midiList.length);
            await fetchAllMidiPaths();
          }
        } catch (midiErr) {
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

  return {
    scanning,
    setScanning,
    scanned,
    setScanned,
    scanProgress,
    setScanProgress,
    rescanPromptOpen,
    setRescanPromptOpen,
    rescanPendingPath,
    setRescanPendingPath,
    confirmOpen,
    setConfirmOpen,
    pendingTrashSampleId,
    setPendingTrashSampleId,
    pendingTrashMidiId,
    setPendingTrashMidiId,
    retryAction,
    setRetryAction,
    error,
    setError,
    performScan,
    handleScanClick,
    handleSidebarImport,
    handleImportPaths,
    handleInvokeError,
    handleRetry,
    setSelected,
  };
}
