import { resolveDroppedPaths } from './importHelpers';
import type { ScanProgress } from '../types/scan';

export type InvokeFn = (cmd: "scan_directory", payload: { readonly path: string }) => Promise<unknown>;
export type ListenFn = (event: "scan-progress", cb: (e: { readonly payload: ScanProgress }) => void) => Promise<() => void>;
export type RunSearchFn = (query: string) => Promise<unknown>;

export async function handleImportPaths(
  rawPaths: string[],
  options: {
    invokeFn: InvokeFn;
    listenFn: ListenFn;
    runSearchFn: RunSearchFn;
    onScanProgress?: (p: ScanProgress | null) => void;
    setScanning?: (v: boolean) => void;
    setError?: (msg: string | null) => void;
    getSearchQuery?: () => string;
  },
) {
  if (!rawPaths || rawPaths.length === 0) return;

  const {
    invokeFn,
    listenFn,
    runSearchFn,
    onScanProgress,
    setScanning,
    setError,
    getSearchQuery,
  } = options;

  const statFn = undefined; // leave to callers if they want to use plugin-fs

  const uniqueDirs = await resolveDroppedPaths(rawPaths, statFn);

  for (const dir of uniqueDirs) {
    try {
      setScanning?.(true);
      onScanProgress?.(null);
      setError?.(null);

      const unlisten = await listenFn('scan-progress', (e) => {
        onScanProgress?.(e.payload ?? null);
      });

      try {
        await invokeFn('scan_directory', { path: dir });
        const query = getSearchQuery ? getSearchQuery() : '';
        await runSearchFn(query);
      } finally {
        try {
          unlisten();
        } catch {}
      }
    } catch (e) {
      setError?.(e instanceof Error ? e.message : String(e));
    } finally {
      setScanning?.(false);
      onScanProgress?.(null);
    }
  }
}
