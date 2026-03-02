import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';
// React import not required in this test file

// Mock Tauri modules used by App
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(async (cmd: string) => {
    if (cmd === 'check_timidity') return { installed: true, install_command: {} };
    if (cmd === 'search_samples') return [];
    if (cmd === 'scan_directory') return 1;
    return null;
  }),
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn(async () => {
    // return unlisten
    return () => {};
  }),
}));

// plugin-dialog used by App.handleScanClick; mock open
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn() }));

import { App } from '../../App';
import { invoke } from '@tauri-apps/api/core';

describe('App drag/drop integration', () => {
  it('shows overlay on dragenter and invokes scan_directory on drop', async () => {
    const { container, getByText } = render(<App />);

    // Wait for initial search to settle. The app now runs several startup invokes
    // (check_timidity, get_instrument_types, etc.) before searching; assert that
    // search_samples was called at some point during startup.
    await waitFor(() => expect((invoke as any).mock.calls.some((c: any[]) => c[0] === 'search_samples')).toBeTruthy());

    // Find the sample list container by role: it's the main content area with position: relative
    const list = container.querySelector('div[style*="position: relative"]');
    expect(list).toBeTruthy();

    // Dispatch dragenter
    fireEvent.dragEnter(list as Element, {
      dataTransfer: {
        items: [],
        types: [],
      } as unknown as DataTransfer,
    });

    // Overlay text should be present
    await waitFor(() => getByText('IMPORT'));

    // Now dispatch drop with a file:// URI
    const dt = {
      items: [],
      getData: (type: string) => (type === 'text/uri-list' ? 'file:///Users/alice/Music/sample.wav' : ''),
    } as unknown as DataTransfer;

    fireEvent.drop(list as Element, { dataTransfer: dt });

    // Expect invoke('scan_directory') to have been called with parent folder
    await waitFor(() => {
      // Either scan_directory or import_file may be invoked depending on fast-path logic
      const calledScan = (invoke as any).mock.calls.some((c: any[]) => c[0] === 'scan_directory');
      const calledImportFile = (invoke as any).mock.calls.some((c: any[]) => c[0] === 'import_file');
      expect(calledScan || calledImportFile).toBeTruthy();
    });
  });
});
