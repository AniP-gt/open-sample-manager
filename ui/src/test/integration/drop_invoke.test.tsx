import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';
// React import not required in this test file

const mockMidiRow = {
  id: 1,
  path: '/Users/alice/Music/drums.mid',
  file_name: 'drums.mid',
  duration: 123,
  tempo: 120,
  time_signature_numerator: 4,
  time_signature_denominator: 4,
  track_count: 1,
  note_count: 48,
  channel_count: 1,
  key_estimate: 'C',
  file_size: 2048,
  created_at: '2026-01-01T00:00:00.000Z',
  modified_at: '2026-01-01T00:00:00.000Z',
  tag_name: '',
};

// Mock Tauri modules used by App
vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(async (cmd: string) => {
    if (cmd === 'check_timidity') return { installed: true, install_command: {} };
    if (cmd === 'get_instrument_types') return [];
    if (cmd === 'list_all_sample_paths') return [];
    if (cmd === 'get_all_midi_paths') return [];
    if (cmd === 'get_midi_tags') return [];
    if (cmd === 'list_samples_paginated') return [];
    if (cmd === 'search_samples') return [];
    if (cmd === 'list_midis_paginated') return [mockMidiRow];
    if (cmd === 'scan_directory') return 1;
    if (cmd === 'scan_midi_directory') return 1;
    if (cmd === 'import_file') return 1;
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
    // The app may call either a legacy 'search_samples' command or the
    // current 'list_samples_paginated' during startup. Accept either.
    await waitFor(() => expect((invoke as any).mock.calls.some((c: any[]) => c[0] === 'search_samples' || c[0] === 'list_samples_paginated')).toBeTruthy());

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

  it('refreshes midi list when dropping while in midi view', async () => {
    const { container, getByText } = render(<App />);

    await waitFor(() => expect((invoke as any).mock.calls.some((c: any[]) => c[0] === 'search_samples' || c[0] === 'list_samples_paginated')).toBeTruthy());

    const midiButton = getByText(/midi list/i);
    fireEvent.click(midiButton);

    await waitFor(() => expect((invoke as any).mock.calls.some((c: any[]) => c[0] === 'list_midis_paginated')).toBeTruthy());

    (invoke as any).mockClear();

    const midiList = container.querySelector('div[style*="position: relative"]');
    expect(midiList).toBeTruthy();

    fireEvent.dragEnter(midiList as Element, {
      dataTransfer: {
        items: [],
        types: [],
      } as unknown as DataTransfer,
    });

    await waitFor(() => getByText('IMPORT'));

    const dt = {
      items: [],
      getData: (type: string) => (type === 'text/uri-list' ? 'file:///Users/alice/Music/drums.mid' : ''),
    } as unknown as DataTransfer;
    fireEvent.drop(midiList as Element, { dataTransfer: dt });

    await waitFor(() => {
      const calls = (invoke as any).mock.calls.map((c: any[]) => c[0]);
      const calledScan = calls.some((cmd: string) => cmd === 'scan_directory');
      const calledImport = calls.some((cmd: string) => cmd === 'import_file');
      expect(calledScan || calledImport).toBeTruthy();
    });

    await waitFor(() => {
      const calls = (invoke as any).mock.calls.map((c: any[]) => c[0]);
      expect(calls.some((cmd: string) => cmd === 'scan_midi_directory')).toBeTruthy();
    });

    await waitFor(() => {
      const calls = (invoke as any).mock.calls.map((c: any[]) => c[0]);
      expect(calls.some((cmd: string) => cmd === 'list_midis_paginated')).toBeTruthy();
    });
  });
});
