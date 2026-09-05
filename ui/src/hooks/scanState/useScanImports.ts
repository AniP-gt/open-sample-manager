import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { ScanProgress } from "../../types/scan";
import { handleImportPaths as importPaths } from "../../utils/handleImportPaths";
import type { ScanStateDependencies, ScanStateSetters } from "./scanStateTypes";

type ResolvedTarget = { readonly kind: "file" | "dir"; readonly path: string };
type UseScanImportsParams = ScanStateDependencies & ScanStateSetters & {
  readonly handleInvokeError: (error: unknown) => void;
  readonly refreshMidis: () => Promise<void>;
  readonly scanMidiDirectory: (path: string) => Promise<void>;
};

function resolvedTarget(path: string, isDirectory: boolean, isFile: boolean): ResolvedTarget {
  if (isDirectory) return { kind: "dir", path };
  if (isFile || path.split("/").at(-1)?.includes(".")) return { kind: "file", path };
  return { kind: "dir", path };
}

export function useScanImports({
  getFilters, runSearch, fetchAllSamplePaths, viewMode, setScanning,
  setScanned, setScanProgress, setError, handleInvokeError, refreshMidis, scanMidiDirectory,
}: UseScanImportsParams) {
  const handleSidebarImport = async (rawPaths: string[]) => {
    await importPaths(rawPaths, {
      invokeFn: invoke,
      listenFn: listen,
      runSearchFn: runSearch,
      onScanProgress: setScanProgress,
      setScanning,
      setError,
      getSearchQuery: () => getFilters().search,
    });
    await fetchAllSamplePaths();
    if (viewMode === "midi") await refreshMidis();
  };

  const handleImportPaths = async (paths: string[]) => {
    if (paths.length === 0) return;
    const fallbackTargets = paths.filter(Boolean).map((rawPath) => {
      const path = rawPath.replace(/\\/g, "/");
      return resolvedTarget(path, false, false);
    });
    let resolved = fallbackTargets;
    try {
      const { stat } = await import("@tauri-apps/plugin-fs");
      resolved = await Promise.all(paths.filter(Boolean).map(async (rawPath) => {
        const path = rawPath.replace(/\\/g, "/");
        const info = await stat(path);
        return resolvedTarget(path, Boolean(info.isDirectory), Boolean(info.isFile));
      }));
    } catch {
      resolved = fallbackTargets;
    }
    if (resolved.length === 1 && resolved[0]?.kind === "file") {
      const filePath = resolved[0].path;
      setScanning(true); setScanProgress(null); setError(null);
      try {
        await invoke<number>("import_file", { path: filePath });
        setScanned(true); await runSearch(getFilters().search); await fetchAllSamplePaths();
        if (viewMode === "midi" && /\.midi?$/i.test(filePath)) {
          const separator = Math.max(filePath.lastIndexOf("/"), filePath.lastIndexOf("\\"));
          await scanMidiDirectory(separator > 0 ? filePath.slice(0, separator) : filePath);
        }
      } catch (error) {
        handleInvokeError(error);
      } finally {
        setScanning(false); setScanProgress(null);
      }
      return;
    }
    const directories = Array.from(new Set(resolved.map((target) => (
      target.kind === "dir" ? target.path : target.path.split("/").slice(0, -1).join("/") || "/"
    ))));
    for (const directory of directories) {
      setScanning(true); setScanProgress(null); setError(null);
      const unlisten = await listen<ScanProgress>("scan-progress", (event) => setScanProgress(event.payload));
      try {
        await invoke<number>("scan_directory", { path: directory });
        setScanned(true); await runSearch(getFilters().search); await fetchAllSamplePaths();
        await scanMidiDirectory(directory);
      } catch (error) {
        handleInvokeError(error);
      } finally {
        unlisten(); setScanning(false); setScanProgress(null);
      }
    }
  };

  return { handleSidebarImport, handleImportPaths };
}
