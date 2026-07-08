import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { App } from '../App';

const mockResponse = {
  arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
  blob: () => Promise.resolve(new Blob()),
  ok: true,
  clone: function() { return this; }
};

vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));

class MockAudioContext {
  createGain() { return { connect: vi.fn(), gain: { value: 1 } }; }
  createMediaElementSource() { return { connect: vi.fn() }; }
  decodeAudioData() {
    return Promise.resolve({
      duration: 1,
      getChannelData: () => new Float32Array(0)
    });
  }
  close() { return vi.fn(); }
}

vi.stubGlobal('AudioContext', MockAudioContext);

if (typeof window !== 'undefined') {
  window.HTMLMediaElement.prototype.pause = vi.fn();
  window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
}

const defaultInvokeMock = (cmd: string) => {
  switch (cmd) {
    case 'get_drag_icon_path': return Promise.resolve('/tmp/icon.png');
    case 'list_samples_paginated': return Promise.resolve([
      {
        id: 1,
        path: '/tmp/test.wav',
        file_name: 'test.wav',
        duration: 1.0,
        bpm: 120,
        sample_type: 'one-shot',
        musical_key: 'C',
        playback_type: 'oneshot',
        instrument_type: 'kick',
        periodicity: null,
        sample_rate: null,
        low_ratio: null,
        attack_slope: null,
        decay_time: null,
        waveform_peaks: null,
        source: null,
        pack_name: null,
        license: null,
        license_url: null,
        license_memo: null,
        imported_at: null,
        peak_db: null,
        rms_db: null,
        leading_silence_ms: null,
        clipping_count: null,
        channel_count: null,
        bit_depth: null,
        quality_flags: null,
        tags: [],
        content_hash: null,
        duplicate_count: null,
        created_at: Date.now(),
        updated_at: Date.now()
      }
    ]);
    case 'list_all_sample_paths': return Promise.resolve(['/tmp/test.wav']);
    case 'get_instrument_types': return Promise.resolve([]);
    case 'get_all_midi_paths': return Promise.resolve(['/tmp/test.mid']);
    case 'list_midis_paginated': return Promise.resolve([{
      id: 1,
      path: '/tmp/test.mid',
      file_name: 'test.mid',
      tag_name: '',
    }]);
    case 'get_midi_tags': return Promise.resolve([]);
    case 'check_timidity': return Promise.resolve({ installed: true, install_command: '' });
    default: return Promise.resolve();
  }
};

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockImplementation((cmd) => {
    switch (cmd) {
      case 'get_drag_icon_path': return Promise.resolve('/tmp/icon.png');
      case 'list_samples_paginated': return Promise.resolve([
        {
          id: 1,
          path: '/tmp/test.wav',
          file_name: 'test.wav',
          sample_type: 'one-shot',
          musical_key: 'C',
          playback_type: 'oneshot',
          instrument_type: 'kick',
          duration: 1.0,
          bpm: 120,
          periodicity: null,
          sample_rate: null,
          low_ratio: null,
          attack_slope: null,
          decay_time: null,
          waveform_peaks: null,
          source: null,
          pack_name: null,
          license: null,
          license_url: null,
          license_memo: null,
          imported_at: null,
          peak_db: null,
          rms_db: null,
          leading_silence_ms: null,
          clipping_count: null,
          channel_count: null,
          bit_depth: null,
          quality_flags: null,
          tags: [],
          content_hash: null,
          duplicate_count: null,
          created_at: Date.now(),
          updated_at: Date.now()
        }
      ]);
      case 'list_all_sample_paths': return Promise.resolve(['/tmp/test.wav']);
      case 'get_instrument_types': return Promise.resolve([]);
      case 'get_all_midi_paths': return Promise.resolve(['/tmp/test.mid']);
      case 'list_midis_paginated': return Promise.resolve([{
        id: 1,
        path: '/tmp/test.mid',
        file_name: 'test.mid',
        tag_name: '',
      }]);
      case 'get_midi_tags': return Promise.resolve([]);
      case 'check_timidity': return Promise.resolve({ installed: true, install_command: '' });
      default: return Promise.resolve();
    }
  }),
  convertFileSrc: (path: string) => `http://localhost${path}`,
}));

vi.mock('@tauri-apps/api/event', () => ({
  listen: vi.fn().mockResolvedValue(vi.fn()),
}));

vi.mock('@tauri-apps/plugin-window-state', () => ({
  restoreStateCurrent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: (options: any) => ({
    getVirtualItems: () => {
      if (options && options.count > 0) {
        return [{ index: 0, size: 40, start: 0 }];
      }
      return [];
    },
    getTotalSize: () => 40,
    scrollToIndex: vi.fn(),
  }),
}));

vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn().mockResolvedValue('/mock/path'),
}));

describe('App Integration', () => {
  async function findSampleTypeBadge() {
    const matches = await screen.findAllByText('one-shot');
    const badge = matches.find((node) => node.tagName.toLowerCase() === 'span');
    if (!badge) throw new Error('Sample type badge not found');
    return badge;
  }

  beforeEach(async () => {
    vi.clearAllMocks();
    const { invoke } = await import('@tauri-apps/api/core');
    (invoke as any).mockImplementation(defaultInvokeMock);
  });

  test('renders initial App layout', async () => {
    await act(async () => render(<App />));
    expect(screen.getByText(/OPEN SAMPLE MANAGER/i)).toBeInTheDocument();
  });

  test('loads the first MIDI page with the shared page limit', async () => {
    const { invoke } = await import('@tauri-apps/api/core');

    await act(async () => render(<App />));
    await act(async () => fireEvent.click(screen.getByText('MIDI List')));

    await waitFor(() => {
      expect(vi.mocked(invoke)).toHaveBeenCalledWith('list_midis_paginated', {
        limit: 100,
        offset: 0,
        directoryPath: null,
        tagId: null,
      });
    });
  });

  test('shows error banner on sample trash failure and retries', async () => {
    const { invoke } = await import('@tauri-apps/api/core');
    (invoke as any).mockImplementation((cmd: string, _args: any) => {
      if (cmd === 'send_to_trash') return Promise.reject('Trash failed mocked');
      return defaultInvokeMock(cmd);
    });

    await act(async () => render(<App />));
    const trashBtn = await screen.findByTitle('Send to Trash');
    await act(async () => fireEvent.click(trashBtn));

    const confirmBtn = screen.getByText('Yes');
    await act(async () => fireEvent.click(confirmBtn));

    // Error banner should appear
    expect(await screen.findByText(/Trash failed mocked/)).toBeInTheDocument();

    // Click retry
    // First, let's fix invoke so it succeeds next time
    (invoke as any).mockImplementation(defaultInvokeMock);

    const retryBtn = screen.getByText('RETRY');
    await act(async () => fireEvent.click(retryBtn));

    // Error should be cleared
    expect(screen.queryByText(/Trash failed mocked/)).not.toBeInTheDocument();
  });

  test('shows rescan prompt and handles skip', async () => {
    await act(async () => render(<App />));
    const scanBtn = screen.getByText('SCAN LIBRARY');

    await act(async () => fireEvent.click(scanBtn));

    const skipBtn = await screen.findByText('Skip');
    await act(async () => fireEvent.click(skipBtn));

    expect(screen.queryByText('Skip')).not.toBeInTheDocument();
  });

  test('selects a sample, shows details and player, then closes', async () => {
    await act(async () => render(<App />));

    const sampleRow = await screen.findByText('test.wav');
    await act(async () => fireEvent.click(sampleRow));

    const closeBtn = await screen.findByTitle('Close waveform UI');
    expect(closeBtn).toBeInTheDocument();

    await act(async () => fireEvent.click(closeBtn));
    expect(screen.queryByTitle('Close waveform UI')).not.toBeInTheDocument();
  });

  test('MIDI view row selection and detail', async () => {
    await act(async () => render(<App />));

    const midiButton = screen.getByText('MIDI List');
    await act(async () => fireEvent.click(midiButton));

    const midiRow = await screen.findByText('test.mid');
    await act(async () => fireEvent.click(midiRow));

    expect(screen.getByText('FILTERS')).toBeInTheDocument();
  });

  test('opens classification modal from sample row and closes it', async () => {
    await act(async () => render(<App />));
    const typeBadge = await findSampleTypeBadge();
    await act(async () => fireEvent.click(typeBadge));
    expect(await screen.findByText('EDIT CLASSIFICATION')).toBeInTheDocument();
    const cancelBtn = screen.getByText('CANCEL');
    await act(async () => fireEvent.click(cancelBtn));
    expect(screen.queryByText('EDIT CLASSIFICATION')).not.toBeInTheDocument();
  });

  test('settings modal interactions', async () => {
    await act(async () => render(<App />));

    const settingsBtn = screen.getByTitle('Settings');
    await act(async () => fireEvent.click(settingsBtn));

    expect(screen.getByText('SETTINGS')).toBeInTheDocument();

    const closeBtn = screen.getByText('✕');
    await act(async () => fireEvent.click(closeBtn));
  });

  test('confirms trashing a sample', async () => {
    await act(async () => render(<App />));
    const trashBtn = await screen.findByTitle('Send to Trash');
    await act(async () => fireEvent.click(trashBtn));
    expect(await screen.findByText(/Are you sure you want to move .* to the Trash\?/)).toBeInTheDocument();

    const confirmBtn = screen.getByText('Yes');
    await act(async () => fireEvent.click(confirmBtn));
    expect(screen.queryByText(/Are you sure you want to move .* to the Trash\?/)).not.toBeInTheDocument();
  });

  test('confirms trashing a MIDI', async () => {
    await act(async () => render(<App />));
    const midiButton = screen.getByText('MIDI List');
    await act(async () => fireEvent.click(midiButton));

    const trashBtn = await screen.findByTitle('Send to Trash');
    await act(async () => fireEvent.click(trashBtn));

    expect(await screen.findByText(/Are you sure you want to move .* to the Trash\?/)).toBeInTheDocument();

    const confirmBtn = screen.getByText('Yes');
    await act(async () => fireEvent.click(confirmBtn));
    expect(screen.queryByText(/Are you sure you want to move .* to the Trash\?/)).not.toBeInTheDocument();
  });

  test('saves changes in classification modal', async () => {
    await act(async () => render(<App />));
    const typeBadge = await findSampleTypeBadge();
    await act(async () => fireEvent.click(typeBadge));
    expect(await screen.findByText('EDIT CLASSIFICATION')).toBeInTheDocument();

    const saveBtn = screen.getByText('SAVE');
    await act(async () => fireEvent.click(saveBtn));
    expect(screen.queryByText('EDIT CLASSIFICATION')).not.toBeInTheDocument();
  });

  test('opens and closes instrument type management modal', async () => {
    await act(async () => render(<App />));
    const typeBadge = await findSampleTypeBadge();
    await act(async () => fireEvent.click(typeBadge));
    expect(await screen.findByText('EDIT CLASSIFICATION')).toBeInTheDocument();

    const manageBtn = screen.getByText('MANAGE');
    await act(async () => fireEvent.click(manageBtn));

    expect(await screen.findByText('MANAGE INSTRUMENT TYPES')).toBeInTheDocument();

    // Close the manage modal using the close button "CLOSE"
    const closeManageBtn = screen.getByText('CLOSE');
    await act(async () => fireEvent.click(closeManageBtn));
    expect(screen.queryByText('MANAGE INSTRUMENT TYPES')).not.toBeInTheDocument();
  });

  test('opens and closes MIDI tag management modal', async () => {
    await act(async () => render(<App />));
    const midiButton = screen.getByText('MIDI List');
    await act(async () => fireEvent.click(midiButton));

    const addTagBtn = await screen.findByText('+ tag');
    await act(async () => fireEvent.click(addTagBtn));
    expect(await screen.findByText('EDIT MIDI TAG')).toBeInTheDocument();

    const manageTagsBtn = screen.getByText('MANAGE');
    await act(async () => fireEvent.click(manageTagsBtn));

    expect(await screen.findByText('MANAGE MIDI TAGS')).toBeInTheDocument();

    const closeBtn = screen.getByText('CLOSE');
    await act(async () => fireEvent.click(closeBtn));
    expect(screen.queryByText('MANAGE MIDI TAGS')).not.toBeInTheDocument();
  });
  test('cancels trashing a sample', async () => {
    await act(async () => render(<App />));
    const trashBtn = await screen.findByTitle('Send to Trash');
    await act(async () => fireEvent.click(trashBtn));
    expect(await screen.findByText(/Are you sure you want to move .* to the Trash\?/)).toBeInTheDocument();

    const cancelBtn = screen.getByText('No');
    await act(async () => fireEvent.click(cancelBtn));
    expect(screen.queryByText(/Are you sure you want to move .* to the Trash\?/)).not.toBeInTheDocument();
  });

  test('cancels trashing a MIDI', async () => {
    await act(async () => render(<App />));
    const midiButton = screen.getByText('MIDI List');
    await act(async () => fireEvent.click(midiButton));

    const trashBtn = await screen.findByTitle('Send to Trash');
    await act(async () => fireEvent.click(trashBtn));

    expect(await screen.findByText(/Are you sure you want to move .* to the Trash\?/)).toBeInTheDocument();

    const cancelBtn = screen.getByText('No');
    await act(async () => fireEvent.click(cancelBtn));
    expect(screen.queryByText(/Are you sure you want to move .* to the Trash\?/)).not.toBeInTheDocument();
  });

  test('changes instrument type in classification modal', async () => {
    await act(async () => render(<App />));
    const typeBadge = await findSampleTypeBadge();
    await act(async () => fireEvent.click(typeBadge));
    expect(await screen.findByText('EDIT CLASSIFICATION')).toBeInTheDocument();

    const snareBtn = screen.getByText('SNARE');
    await act(async () => fireEvent.click(snareBtn));

    expect(snareBtn).toHaveStyle({ color: '#f97316' });
  });

  test('closes MIDI tag edit modal', async () => {
    await act(async () => render(<App />));
    const midiButton = screen.getByText('MIDI List');
    await act(async () => fireEvent.click(midiButton));

    const addTagBtn = await screen.findByText('+ tag');
    await act(async () => fireEvent.click(addTagBtn));
    expect(await screen.findByText('EDIT MIDI TAG')).toBeInTheDocument();

    const cancelBtn = screen.getByText('CANCEL');
    await act(async () => fireEvent.click(cancelBtn));
    expect(screen.queryByText('EDIT MIDI TAG')).not.toBeInTheDocument();
  });
});
