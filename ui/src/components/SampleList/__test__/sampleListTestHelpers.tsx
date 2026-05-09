import { render } from '@testing-library/react';
import { beforeEach, vi } from 'vitest';
import { invoke } from '@tauri-apps/api/core';
import { SampleList } from '../SampleList';
import { useFavoritesStore } from '../../../store/useFavoritesStore';
import type { SampleListProps } from '../types';
import type { FilterState, Sample } from '../../../types/sample';

export const mockSamples: Sample[] = [
  {
    id: 1,
    file_name: 'kick.wav',
    sample_type: 'one-shot',
    instrument_type: 'kick',
    bpm: 120,
    duration: 1.0,
    tags: ['punchy'],
    periodicity: 0,
    low_ratio: 0.8,
    attack_slope: 0.9,
    decay_time: null,
    playback_type: 'oneshot',
    waveform_peaks: null,
    sample_rate: 44100,
    musical_key: 'C',
  },
  {
    id: 2,
    file_name: 'loop.wav',
    sample_type: 'loop',
    instrument_type: 'other',
    bpm: 140,
    duration: 4.0,
    tags: [],
    periodicity: 0.5,
    low_ratio: 0.2,
    attack_slope: 0.1,
    decay_time: null,
    playback_type: 'loop',
    waveform_peaks: null,
    sample_rate: 48000,
    musical_key: 'A',
  },
];

export const defaultFilters: FilterState = {
  filterType: 'all',
  search: '',
  filterBpmMin: '',
  filterBpmMax: '',
  filterInstrumentType: '',
  filterKey: '',
  favoritesOnly: false,
};

export function setFavoriteStore(favorites: number[] = [], toggleFavorite = vi.fn()) {
  vi.mocked(useFavoritesStore).mockReturnValue({
    favorites,
    toggleFavorite,
    isFavorite: (id: number) => favorites.includes(id),
    clearFavorites: vi.fn(),
  });
}

beforeEach(() => {
  vi.mocked(invoke).mockImplementation((cmd) => {
    if (cmd === 'get_drag_icon_path') return Promise.resolve('/tmp/icon.png');
    return Promise.resolve();
  });
  setFavoriteStore();
});

export function renderSampleList(overrides: Partial<SampleListProps> = {}) {
  const props: SampleListProps = {
    samples: mockSamples,
    samplePaths: {},
    filters: defaultFilters,
    sort: { field: 'id', direction: 'asc' },
    selectedSample: null,
    onSampleSelect: vi.fn(),
    onFilterChange: vi.fn(),
    onSortChange: vi.fn(),
    onDeleteSample: vi.fn(),
    ...overrides,
  };

  return render(<SampleList {...props} />);
}
