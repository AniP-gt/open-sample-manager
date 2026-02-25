import { describe, it, expect, vi } from 'vitest';
import { handleImportPaths } from './handleImportPaths';

describe('handleImportPaths', () => {
  it('invokes scan_directory for resolved directory and runs search', async () => {
    const invoked: Array<{ cmd: string; payload: any }> = [];
    const invokeFn = async (cmd: string, payload: unknown) => {
      invoked.push({ cmd, payload });
      return 1;
    };

    const listenFn = async (_event: string, cb: (e: { payload: any }) => void) => {
      // Immediately call cb with a fake progress, then return unlisten
      cb({ payload: { current: 0, total: 1 } });
      return () => {};
    };

    const runSearchFn = vi.fn(async (_q: string) => []);
    const scans: any[] = [];
    const onScanProgress = (p: any) => scans.push(p);
    const setScanning = vi.fn();
    const setError = vi.fn();

    await handleImportPaths(['/Users/alice/Music/samples/kick.wav'], {
      invokeFn,
      listenFn,
      runSearchFn,
      onScanProgress,
      setScanning,
      setError,
      getSearchQuery: () => 'q',
    });

    expect(invoked.length).toBe(1);
    expect(invoked[0].cmd).toBe('scan_directory');
    expect((invoked[0].payload as any).path).toBe('/Users/alice/Music/samples');
    expect(runSearchFn).toHaveBeenCalledWith('q');
    expect(scans.length).toBeGreaterThan(0);
  });
});
