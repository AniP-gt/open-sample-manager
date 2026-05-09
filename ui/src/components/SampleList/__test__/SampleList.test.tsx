import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { SampleList } from '../SampleList';
import { useFavoritesStore } from '../../../store/useFavoritesStore';
import { invoke } from '@tauri-apps/api/core';
import type { Sample } from '../../../types/sample';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockImplementation((cmd) => {
    if (cmd === 'get_drag_icon_path') return Promise.resolve('/tmp/icon.png');
    return Promise.resolve();
  }),
}));

vi.mock('../../../store/useFavoritesStore', () => ({
  useFavoritesStore: vi.fn(() => ({ favorites: [], toggleFavorite: vi.fn() })),
}));

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: (options: { count?: number }) => {
    const count = options.count ?? 0;
    return {
      getVirtualItems: () =>
        Array.from({ length: count }, (_, index) => ({
          index,
          start: index * 48,
          size: 48,
        })),
      getTotalSize: () => count * 48,
      scrollToIndex: vi.fn(),
    };
  },
}));

const mockSamples: Sample[] = [
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

describe('SampleList', () => {
  beforeEach(() => {
    vi.mocked(useFavoritesStore).mockReturnValue({
      favorites: [],
      toggleFavorite: vi.fn(),
    } as unknown as ReturnType<typeof useFavoritesStore>);
  });

  test('renders list headers and virtual items', () => {
    render(
      <SampleList
        samples={mockSamples}
        samplePaths={{ 1: '/kick.wav', 2: '/loop.wav' }}
        filters={{ filterType: 'all', search: '', filterBpmMin: '', filterBpmMax: '', filterInstrumentType: '', filterKey: '', favoritesOnly: false }}
        sort={{ field: 'file_name', direction: 'asc' }}
        selectedSample={null}
        onSampleSelect={vi.fn()}
        onFilterChange={vi.fn()}
        onSortChange={vi.fn()}
        onDeleteSample={vi.fn()}
      />
    );

    expect(screen.getByText('FILENAME')).toBeInTheDocument();
    expect(screen.getByText('TYPE')).toBeInTheDocument();
    expect(screen.getByText('INST')).toBeInTheDocument();
    expect(screen.getByText('BPM')).toBeInTheDocument();
    expect(screen.getByText('KEY')).toBeInTheDocument();
    expect(screen.getByText('DUR')).toBeInTheDocument();
    expect(screen.getAllByText('kick.wav')[0]).toBeInTheDocument();
    expect(screen.getAllByText('loop.wav')[0]).toBeInTheDocument();
  });

  test('calls onSortChange when header is clicked', () => {
    const onSortChange = vi.fn();
    render(
      <SampleList
        samples={mockSamples}
        samplePaths={{}}
        filters={{ filterType: 'all', search: '', filterBpmMin: '', filterBpmMax: '', filterInstrumentType: '', filterKey: '', favoritesOnly: false }}
        sort={{ field: 'id', direction: 'asc' }}
        selectedSample={null}
        onSampleSelect={vi.fn()}
        onFilterChange={vi.fn()}
        onSortChange={onSortChange}
        onDeleteSample={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText('FILENAME'));
    expect(onSortChange).toHaveBeenCalledWith({ field: 'file_name', direction: 'asc' });

    fireEvent.click(screen.getByText('BPM'));
    expect(onSortChange).toHaveBeenCalledWith({ field: 'bpm', direction: 'asc' });
    
    fireEvent.click(screen.getByText('TYPE'));
    expect(onSortChange).toHaveBeenCalledWith({ field: 'sample_type', direction: 'asc' });
  });

  test('calls onSampleSelect when row is clicked', () => {
    const onSampleSelect = vi.fn();
    render(
      <SampleList
        samples={mockSamples}
        samplePaths={{}}
        filters={{ filterType: 'all', search: '', filterBpmMin: '', filterBpmMax: '', filterInstrumentType: '', filterKey: '', favoritesOnly: false }}
        sort={{ field: 'id', direction: 'asc' }}
        selectedSample={null}
        onSampleSelect={onSampleSelect}
        onFilterChange={vi.fn()}
        onSortChange={vi.fn()}
        onDeleteSample={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText('kick.wav'));
    expect(onSampleSelect).toHaveBeenCalledWith(mockSamples[0]);
  });

  test('handles trash button click', () => {
    const onTrashSample = vi.fn();
    render(
      <SampleList
        samples={mockSamples}
        samplePaths={{}}
        filters={{ filterType: 'all', search: '', filterBpmMin: '', filterBpmMax: '', filterInstrumentType: '', filterKey: '', favoritesOnly: false }}
        sort={{ field: 'id', direction: 'asc' }}
        selectedSample={null}
        onSampleSelect={vi.fn()}
        onFilterChange={vi.fn()}
        onSortChange={vi.fn()}
        onDeleteSample={vi.fn()}
        onTrashSample={onTrashSample}
      />
    );

    const trashBtns = screen.getAllByTitle('Send to Trash');
    fireEvent.click(trashBtns[0]);
    expect(onTrashSample).toHaveBeenCalledWith(1);
  });

  test('handles favorite toggle', () => {
    const toggleFavorite = vi.fn();
    vi.mocked(useFavoritesStore).mockReturnValue({
      favorites: [1],
      toggleFavorite,
    } as unknown as ReturnType<typeof useFavoritesStore>);

    render(
      <SampleList
        samples={mockSamples}
        samplePaths={{}}
        filters={{ filterType: 'all', search: '', filterBpmMin: '', filterBpmMax: '', filterInstrumentType: '', filterKey: '', favoritesOnly: false }}
        sort={{ field: 'id', direction: 'asc' }}
        selectedSample={null}
        onSampleSelect={vi.fn()}
        onFilterChange={vi.fn()}
        onSortChange={vi.fn()}
        onDeleteSample={vi.fn()}
      />
    );

    const favBtns = screen.getAllByTitle('Remove from favorites');
    fireEvent.click(favBtns[0]);
    expect(toggleFavorite).toHaveBeenCalledWith(1);
  });

  test('handles open folder click', async () => {
    render(
      <SampleList
        samples={mockSamples}
        samplePaths={{ 1: '/my/kick.wav' }}
        filters={{ filterType: 'all', search: '', filterBpmMin: '', filterBpmMax: '', filterInstrumentType: '', filterKey: '', favoritesOnly: false }}
        sort={{ field: 'id', direction: 'asc' }}
        selectedSample={null}
        onSampleSelect={vi.fn()}
        onFilterChange={vi.fn()}
        onSortChange={vi.fn()}
        onDeleteSample={vi.fn()}
      />
    );

    const folderBtns = screen.getAllByTitle('Show in Finder');
    await act(async () => {
      fireEvent.click(folderBtns[0]);
    });
    
    expect(invoke).toHaveBeenCalledWith('open_folder', { path: '/my' });
  });

  test('handles keyboard navigation', () => {
    vi.useFakeTimers();
    const handleSelect = vi.fn();
    const handleTogglePlay = vi.fn();
    const { unmount } = render(
      <SampleList
        samples={mockSamples}
        samplePaths={{ 1: '/tmp/test1.wav', 2: '/tmp/test2.wav' }}
        selectedSample={mockSamples[0]}
        filters={{
          search: '',
          favoritesOnly: false,
          filterType: 'all',
          filterBpmMin: '',
          filterBpmMax: '',
          filterKey: '',
          filterInstrumentType: '',
        }}
        sort={{ field: 'file_name', direction: 'asc' }}
        onSortChange={vi.fn()}
        onFilterChange={vi.fn()}
        onDeleteSample={vi.fn()}
        onSampleSelect={handleSelect}
        onTogglePlayback={handleTogglePlay}
        onTrashSample={vi.fn()}
        onTypeClick={vi.fn()}
        instrumentColorCoding={false}
      />
    );

    fireEvent.keyDown(document.body, { key: 'ArrowDown' });
    vi.advanceTimersByTime(100);
    expect(handleSelect).toHaveBeenCalledWith(mockSamples[1]);

    unmount();

    render(
      <SampleList
        samples={mockSamples}
        samplePaths={{ 1: '/tmp/test1.wav', 2: '/tmp/test2.wav' }}
        selectedSample={mockSamples[1]}
        filters={{
          search: '',
          favoritesOnly: false,
          filterType: 'all',
          filterBpmMin: '',
          filterBpmMax: '',
          filterKey: '',
          filterInstrumentType: '',
        }}
        sort={{ field: 'file_name', direction: 'asc' }}
        onSortChange={vi.fn()}
        onFilterChange={vi.fn()}
        onDeleteSample={vi.fn()}
        onSampleSelect={handleSelect}
        onTogglePlayback={handleTogglePlay}
        onTrashSample={vi.fn()}
        onTypeClick={vi.fn()}
        instrumentColorCoding={false}
      />
    );
    fireEvent.keyDown(document.body, { key: 'ArrowUp' });
    vi.advanceTimersByTime(100);
    expect(handleSelect).toHaveBeenCalledWith(mockSamples[0]);

    fireEvent.keyDown(document.body, { key: 'Home' });
    vi.advanceTimersByTime(100);
    expect(handleSelect).toHaveBeenCalledWith(mockSamples[0]);

    fireEvent.keyDown(document.body, { key: 'End' });
    vi.advanceTimersByTime(100);
    expect(handleSelect).toHaveBeenCalledWith(mockSamples[1]);

    fireEvent.keyDown(document.body, { key: 'PageDown' });
    vi.advanceTimersByTime(100);
    expect(handleSelect).toHaveBeenCalledWith(mockSamples[1]);

    fireEvent.keyDown(document.body, { key: 'PageUp' });
    vi.advanceTimersByTime(100);
    expect(handleSelect).toHaveBeenCalledWith(mockSamples[0]);

    fireEvent.keyDown(document.body, { key: ' ' });
    expect(handleTogglePlay).toHaveBeenCalled();

    vi.useRealTimers();
  });

  test('handles search input', () => {
    const handleFilterChange = vi.fn();
    render(
      <SampleList
        samples={mockSamples}
        samplePaths={{}}
        selectedSample={null}
        filters={{
          search: '',
          favoritesOnly: false,
          filterType: 'all',
          filterBpmMin: '',
          filterBpmMax: '',
          filterKey: '',
          filterInstrumentType: '',
        }}
        sort={{ field: 'file_name', direction: 'asc' }}
        onSortChange={vi.fn()}
        onFilterChange={handleFilterChange}
        onDeleteSample={vi.fn()}
        onSampleSelect={vi.fn()}
      />
    );

    const searchInput = screen.getByPlaceholderText('Search by filename, tag, key...');
    fireEvent.change(searchInput, { target: { value: 'kick' } });

    expect(handleFilterChange).toHaveBeenCalledWith({ search: 'kick' });
  });

  test('renders grid view and handles selection', () => {
    const handleFilterChange = vi.fn();
    render(
      <SampleList
        samples={mockSamples}
        samplePaths={{}}
        selectedSample={null}
        filters={{
          search: '',
          favoritesOnly: false,
          filterType: 'all',
          filterBpmMin: '',
          filterBpmMax: '',
          filterKey: '',
          filterInstrumentType: '',
        }}
        sort={{ field: 'file_name', direction: 'asc' }}
        onSortChange={vi.fn()}
        onFilterChange={handleFilterChange}
        onDeleteSample={vi.fn()}
        onSampleSelect={vi.fn()}
      />
    );

    const searchInput = screen.getByPlaceholderText('Search by filename, tag, key...');
    fireEvent.change(searchInput, { target: { value: 'kick' } });

    expect(handleFilterChange).toHaveBeenCalledWith({ search: 'kick' });
  });
    const onSampleSelect = vi.fn();
    render(
      <SampleList
        samples={mockSamples}
        samplePaths={{}}
        filters={{ filterType: 'all', search: '', filterBpmMin: '', filterBpmMax: '', filterInstrumentType: '', filterKey: '', favoritesOnly: false }}
        sort={{ field: 'id', direction: 'asc' }}
        selectedSample={null}
        onSampleSelect={onSampleSelect}
        onFilterChange={vi.fn()}
        onSortChange={vi.fn()}
        onDeleteSample={vi.fn()}
      />
    );

    fireEvent.click(screen.getByTitle('Grid view'));
    expect(screen.queryByText('FILENAME')).not.toBeInTheDocument();
    
    fireEvent.click(screen.getByText('kick.wav'));
    expect(onSampleSelect).toHaveBeenCalledWith(mockSamples[0]);
  });
  
  test('calls onTypeClick when type badge is clicked', () => {
    const onTypeClick = vi.fn();
    render(
      <SampleList
        samples={mockSamples}
        samplePaths={{}}
        filters={{ filterType: 'all', search: '', filterBpmMin: '', filterBpmMax: '', filterInstrumentType: '', filterKey: '', favoritesOnly: false }}
        sort={{ field: 'id', direction: 'asc' }}
        selectedSample={null}
        onSampleSelect={vi.fn()}
        onFilterChange={vi.fn()}
        onSortChange={vi.fn()}
        onDeleteSample={vi.fn()}
        onTypeClick={onTypeClick}
      />
    );

    const typeBadge = screen.getByText('one-shot');
    fireEvent.click(typeBadge);
    expect(onTypeClick).toHaveBeenCalledWith(mockSamples[0]);
  });

  test('shows No more results when canLoadMore is false and items present', () => {
    render(
      <SampleList
        samples={mockSamples}
        samplePaths={{}}
        filters={{ filterType: 'all', search: '', filterBpmMin: '', filterBpmMax: '', filterInstrumentType: '', filterKey: '', favoritesOnly: false }}
        sort={{ field: 'id', direction: 'asc' }}
        selectedSample={null}
        onSampleSelect={vi.fn()}
        onFilterChange={vi.fn()}
        onSortChange={vi.fn()}
        onDeleteSample={vi.fn()}
        canLoadMore={false}
      />
    );
    
    expect(screen.getByText('No more results')).toBeInTheDocument();
  });
