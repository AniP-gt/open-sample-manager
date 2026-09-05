import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import { App } from '../App';
import { useSettingsStore } from '../store/useSettingsStore';

const mockResponse = {
  arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
  blob: () => Promise.resolve(new Blob()),
  clone() { return this; },
  ok: true,
};

class MockAudioContext {
  createGain() { return { connect: vi.fn(), gain: { value: 1 } }; }
  createMediaElementSource() { return { connect: vi.fn() }; }
  decodeAudioData() { return Promise.resolve({ duration: 1, getChannelData: () => new Float32Array(0) }); }
  close() { return vi.fn(); }
}

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }));

export function getInvokeMock() {
  return mocks.invoke;
}

export function sampleRow() {
  return {
    attack_slope: null, bit_depth: null, bpm: 120, channel_count: null, clipping_count: null,
    content_hash: null, created_at: Date.now(), decay_time: null, duplicate_count: null,
    duration: 1, file_name: 'test.wav', id: 1, imported_at: null, instrument_type: 'kick',
    leading_silence_ms: null, license: null, license_memo: null, license_url: null, low_ratio: null,
    musical_key: 'C', pack_name: null, path: '/tmp/test.wav', peak_db: null, periodicity: null,
    playback_type: 'oneshot', quality_flags: null, rms_db: null, sample_rate: null,
    sample_type: 'one-shot', source: null, tags: [], updated_at: Date.now(), waveform_peaks: null,
  };
}

export function defaultInvokeMock(command: string) {
  switch (command) {
    case 'check_timidity': return Promise.resolve({ install_command: '', installed: true });
    case 'get_all_midi_paths': return Promise.resolve(['/tmp/test.mid']);
    case 'get_drag_icon_path': return Promise.resolve('/tmp/icon.png');
    case 'get_instrument_types':
    case 'get_midi_tags': return Promise.resolve([]);
    case 'list_all_sample_paths': return Promise.resolve(['/tmp/test.wav']);
    case 'list_midis_paginated': return Promise.resolve([{ file_name: 'test.mid', id: 1, path: '/tmp/test.mid', tag_name: '' }]);
    case 'list_samples_paginated': return Promise.resolve([sampleRow()]);
    default: return Promise.resolve();
  }
}

vi.mock('@tauri-apps/api/core', () => ({
  convertFileSrc: (path: string) => `http://localhost${path}`,
  invoke: mocks.invoke,
}));
vi.mock('@tauri-apps/api/event', () => ({ listen: vi.fn().mockResolvedValue(vi.fn()) }));
vi.mock('@tauri-apps/plugin-dialog', () => ({ open: vi.fn().mockResolvedValue('/mock/path') }));
vi.mock('@tauri-apps/plugin-window-state', () => ({ restoreStateCurrent: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: (options: { readonly count: number }) => ({
    getTotalSize: () => 40,
    getVirtualItems: () => options.count > 0 ? [{ index: 0, size: 40, start: 0 }] : [],
    scrollToIndex: vi.fn(),
  }),
}));

export function useAppTestHarness() {
  beforeEach(() => {
    vi.clearAllMocks();
    getInvokeMock().mockReset();
    vi.stubGlobal('AudioContext', MockAudioContext);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(mockResponse));
    window.HTMLMediaElement.prototype.pause = vi.fn();
    window.HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
    useSettingsStore.getState().setAutoPlayOnSelect(false);
    useSettingsStore.getState().setInstrumentColorCoding(false);
    useSettingsStore.getState().setDirectoryClickFiltering(true);
    useSettingsStore.getState().setShowSampleMetadataQuality(true);
    useSettingsStore.getState().setProviderDownloadRoot(null);
    useSettingsStore.getState().setProviderBrowserMode('window');
    getInvokeMock().mockImplementation(defaultInvokeMock);
  });

  afterEach(async () => {
    cleanup();
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    vi.unstubAllGlobals();
  });
}

export async function renderApp() {
  await act(async () => render(<App />));
}

export async function findSampleTypeBadge() {
  const matches = await screen.findAllByText('one-shot');
  const badge = matches.find((node) => node.tagName.toLowerCase() === 'span');
  if (!badge) throw new Error('Sample type badge not found');
  return badge;
}
