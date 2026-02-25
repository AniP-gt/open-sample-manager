import { resolveDroppedPaths } from './importHelpers';
import type { ScanProgress } from '../types/scan';

export type InvokeFn = (cmd: string, payload: unknown) => Promise<any>;
export type ListenFn = <T = any>(event: string, cb: (e: { payload: T }) => void) => Promise<() => void>;
export type RunSearchFn = (query: string) => Promise<any>;

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

  const uniqueDirs = await resolveDroppedPaths(rawPaths, statFn as any);

  for (const dir of uniqueDirs) {
    try {
      setScanning?.(true);
      onScanProgress?.(null);
      setError?.(null);

      const unlisten = await listenFn<ScanProgress>('scan-progress', (e) => {
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
