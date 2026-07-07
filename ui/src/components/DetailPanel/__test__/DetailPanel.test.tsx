import { afterEach, beforeEach, describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { DetailPanel } from '../DetailPanel';
import type { Sample } from '../../../types/sample';
import type { EmbeddingSampleRow } from '../../../utils/sampleMapper';
import { invoke } from '@tauri-apps/api/core';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

const mockSample: Sample = {
  id: 1,
  file_name: 'kick.wav',
  sample_rate: 44100,
  file_size: 2048,
  artist: 'User',
  musical_key: 'C',
  periodicity: 0.5,
  low_ratio: 0.1,
  attack_slope: 2,
  decay_time: 100,
  sample_type: 'one-shot',
  instrument_type: 'kick',
  duration: 1.0,
  bpm: 120,
  playback_type: 'oneshot',
  tags: [],
  waveform_peaks: null,
};

const embeddingRow = (overrides: Partial<EmbeddingSampleRow> = {}): EmbeddingSampleRow => ({
  id: 2,
  path: '/snare.wav',
  file_name: 'snare.wav',
  duration: 0.8,
  bpm: 122,
  periodicity: 0.4,
  low_ratio: 0.2,
  attack_slope: 1.4,
  decay_time: 80,
  sample_type: 'one-shot',
  waveform_peaks: null,
  playback_type: 'oneshot',
  instrument_type: 'snare',
  content_hash: null,
  duplicate_count: null,
  ...overrides,
});

describe('DetailPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  test('renders sample metadata', () => {
    render(<DetailPanel sample={mockSample} path="/kick.wav" />);
    
    expect(screen.getByText('44100 Hz')).toBeInTheDocument();
    expect(screen.getByText('2.0 KB')).toBeInTheDocument();
    expect(screen.getByText('User')).toBeInTheDocument();
    expect(screen.getByText('C')).toBeInTheDocument();
    expect(screen.getByText('/kick.wav')).toBeInTheDocument();
  });

  test('calls onFilterChange when sample type filter is clicked', () => {
    const onFilterChange = vi.fn();
    render(<DetailPanel sample={mockSample} onFilterChange={onFilterChange} samples={[]} />);
    
    const loopBtn = screen.getByRole('button', { name: /LOOP/i });
    fireEvent.click(loopBtn);
    
    expect(onFilterChange).toHaveBeenCalledWith({ filterType: 'loop' });
  });

  test('calls onFilterChange when BPM max changes', () => {
    const onFilterChange = vi.fn();
    render(<DetailPanel sample={mockSample} onFilterChange={onFilterChange} samples={[]} />);
    
    const maxBpm = screen.getByPlaceholderText('MAX');
    fireEvent.change(maxBpm, { target: { value: '140' } });
    
    expect(onFilterChange).toHaveBeenCalledWith({ filterBpmMax: '140' });
  });

  test('invokes embedding search and opens modal', async () => {
    vi.mocked(invoke).mockResolvedValueOnce([{ similarity: 0.9, row: mockSample }]);
    
    render(<DetailPanel sample={mockSample} path="/kick.wav" />);
    
    fireEvent.click(screen.getByText('Find similar samples'));
    
    expect(invoke).toHaveBeenCalledWith('search_by_embedding', { path: '/kick.wav', k: 12 });
    
    await waitFor(() => {
      expect(screen.getByText('kick.wav')).toBeInTheDocument();
    });
  });

  test('calls onError when embedding search fails', async () => {
    vi.mocked(invoke).mockRejectedValueOnce(new Error('Search failed'));
    const onError = vi.fn();
    
    render(<DetailPanel sample={mockSample} path="/kick.wav" onError={onError} />);
    
    fireEvent.click(screen.getByText('Find similar samples'));
    
    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith('Search failed');
    });
  });

  test('selects a random similar sample without opening the modal', async () => {
    const onSelect = vi.fn();
    const currentRow = embeddingRow({ id: mockSample.id, path: '/kick.wav', file_name: mockSample.file_name });
    const nextRow = embeddingRow({ id: 3, path: '/hat.wav', file_name: 'hat.wav', instrument_type: 'hihat' });
    vi.mocked(invoke).mockResolvedValueOnce([
      { similarity: 1, row: currentRow },
      { similarity: 0.83, row: nextRow },
    ]);
    vi.spyOn(Math, 'random').mockReturnValue(0);

    render(<DetailPanel sample={mockSample} path="/kick.wav" onSelect={onSelect} />);

    fireEvent.click(screen.getByRole('button', { name: 'Random similar sample' }));

    await waitFor(() => {
      expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 3, file_name: 'hat.wav' }), '/hat.wav');
    });
    expect(invoke).toHaveBeenCalledWith('search_by_embedding', { path: '/kick.wav', k: 24 });
    expect(screen.queryByText('Similar samples')).not.toBeInTheDocument();
  });

  test('calls onError and keeps selection when random similar sample has no path', () => {
    const onSelect = vi.fn();
    const onError = vi.fn();

    render(<DetailPanel sample={mockSample} path="" onSelect={onSelect} onError={onError} />);

    fireEvent.click(screen.getByRole('button', { name: 'Random similar sample' }));

    expect(invoke).not.toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith('Sample path missing for embedding search');
  });

  test('calls onError when random similar search has no usable result', async () => {
    const onSelect = vi.fn();
    const onError = vi.fn();
    vi.mocked(invoke).mockResolvedValueOnce([
      { similarity: 1, row: embeddingRow({ id: mockSample.id, path: '' }) },
    ]);

    render(<DetailPanel sample={mockSample} path="/kick.wav" onSelect={onSelect} onError={onError} />);

    fireEvent.click(screen.getByRole('button', { name: 'Random similar sample' }));

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith('No similar samples found');
    });
    expect(onSelect).not.toHaveBeenCalled();
  });

  test('calls onSelect and onError when path is missing during embedding search', () => {
    const onSelect = vi.fn();
    const onError = vi.fn();
    
    render(<DetailPanel sample={mockSample} path="" onSelect={onSelect} onError={onError} />);
    
    fireEvent.click(screen.getByText('Find similar samples'));
    
    expect(onSelect).toHaveBeenCalledWith(mockSample, "");
    expect(onError).toHaveBeenCalledWith('Sample path missing for embedding search');
  });

  test('renders instrument tags and triggers filter', () => {
    const onFilterChange = vi.fn();
    render(
      <DetailPanel 
        sample={mockSample} 
        allInstrumentTypeNames={['kick', 'snare']} 
        onFilterChange={onFilterChange} 
      />
    );
    
    fireEvent.click(screen.getByRole('button', { name: 'kick' }));
    expect(onFilterChange).toHaveBeenCalledWith({ filterInstrumentType: 'kick' });
  });

  test('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(<DetailPanel sample={mockSample} path="/kick.wav" onClose={onClose} />);
    const closeBtn = screen.getByLabelText('Close detail panel');
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });

  test('calls onFilterChange with reset payload when reset button is clicked', () => {
    const onFilterChange = vi.fn();
    render(<DetailPanel sample={mockSample} path="/kick.wav" onFilterChange={onFilterChange} />);
    const resetBtn = screen.getByLabelText('Reset sample filters');
    fireEvent.click(resetBtn);
    expect(onFilterChange).toHaveBeenCalledWith({ filterType: 'all', filterBpmMin: '', filterBpmMax: '', filterInstrumentType: '' });
  });
});
