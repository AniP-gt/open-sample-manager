import './mockSampleListDependencies';
import { describe, expect, test, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { defaultFilters, mockSamples, renderSampleList } from './sampleListTestHelpers';

describe('SampleList rendering, search, and sort', () => {
  test('renders list headers and virtual items', () => {
    renderSampleList({
      samplePaths: { 1: '/kick.wav', 2: '/loop.wav' },
      sort: { field: 'file_name', direction: 'asc' },
    });

    expect(screen.getByText('FILENAME')).toBeInTheDocument();
    expect(screen.getByText('TYPE', { selector: 'div' })).toBeInTheDocument();
    expect(screen.getByText('INST', { selector: 'div' })).toBeInTheDocument();
    expect(screen.getByText('BPM')).toBeInTheDocument();
    expect(screen.getByText('KEY', { selector: 'div' })).toBeInTheDocument();
    expect(screen.getByText('DUR')).toBeInTheDocument();
    expect(screen.getAllByText('kick.wav')[0]).toBeInTheDocument();
    expect(screen.getAllByText('loop.wav')[0]).toBeInTheDocument();
  });

  test('calls onSortChange when header is clicked', () => {
    const onSortChange = vi.fn();
    renderSampleList({ onSortChange });

    fireEvent.click(screen.getByText('FILENAME'));
    expect(onSortChange).toHaveBeenCalledWith({ field: 'file_name', direction: 'asc' });

    fireEvent.click(screen.getByText('BPM'));
    expect(onSortChange).toHaveBeenCalledWith({ field: 'bpm', direction: 'asc' });

    fireEvent.click(screen.getByText('TYPE', { selector: 'div' }));
    expect(onSortChange).toHaveBeenCalledWith({ field: 'sample_type', direction: 'asc' });
  });

  test('handles search input', () => {
    const handleFilterChange = vi.fn();
    renderSampleList({
      filters: defaultFilters,
      sort: { field: 'file_name', direction: 'asc' },
      onFilterChange: handleFilterChange,
    });

    const searchInput = screen.getByPlaceholderText('Search by filename, tag, key...');
    fireEvent.change(searchInput, { target: { value: 'kick' } });

    expect(handleFilterChange).toHaveBeenCalledWith({ search: 'kick' });
  });

  test('calls onFilterChange from metadata header controls', () => {
    const handleFilterChange = vi.fn();
    renderSampleList({
      filters: defaultFilters,
      onFilterChange: handleFilterChange,
    });

    fireEvent.change(screen.getByLabelText('Sample BPM minimum'), { target: { value: '90' } });
    expect(handleFilterChange).toHaveBeenCalledWith({ filterBpmMin: '90' });

    fireEvent.change(screen.getByLabelText('Sample BPM maximum'), { target: { value: '130' } });
    expect(handleFilterChange).toHaveBeenCalledWith({ filterBpmMax: '130' });

    fireEvent.change(screen.getByLabelText('Sample type filter'), { target: { value: 'loop' } });
    expect(handleFilterChange).toHaveBeenCalledWith({ filterType: 'loop' });

    fireEvent.change(screen.getByLabelText('Sample instrument type filter'), { target: { value: 'kick' } });
    expect(handleFilterChange).toHaveBeenCalledWith({ filterInstrumentType: 'kick' });

    fireEvent.change(screen.getByLabelText('Sample key filter'), { target: { value: 'C#' } });
    expect(handleFilterChange).toHaveBeenCalledWith({ filterKey: 'C#' });
  });

  test('applies local filter combinations', () => {
    renderSampleList({
      filters: {
        filterType: 'one-shot',
        search: '',
        filterBpmMin: '110',
        filterBpmMax: '130',
        filterInstrumentType: 'kick',
        filterKey: 'C',
        favoritesOnly: false,
      },
    });

    expect(screen.queryByText('kick.wav')).toBeInTheDocument();
    expect(screen.queryByText('loop.wav')).not.toBeInTheDocument();
  });

  test('filters search text by case-insensitive filename substring', () => {
    renderSampleList({
      samples: [
        { ...mockSamples[0], id: 10, file_name: 'DrumFill.wav' },
        { ...mockSamples[1], id: 11, file_name: 'flute.wav' },
      ],
      filters: { ...defaultFilters, search: 'FILL' },
    });

    expect(screen.queryByText('DrumFill.wav')).toBeInTheDocument();
    expect(screen.queryByText('flute.wav')).not.toBeInTheDocument();
  });

  test('fuzzy-matches non-contiguous filename letters', () => {
    renderSampleList({
      samples: [
        { ...mockSamples[0], id: 10, file_name: 'DrumFill.wav' },
      ],
      filters: { ...defaultFilters, search: 'fll' },
    });

    expect(screen.queryByText('DrumFill.wav')).toBeInTheDocument();
  });

  test('applies descending sort correctly', () => {
    renderSampleList({ sort: { field: 'file_name', direction: 'desc' } });

    const allTextNodes = screen.getAllByText(/kick.wav|loop.wav/);
    const loopIndex = allTextNodes.findIndex((node) => node.textContent === 'loop.wav');
    const kickIndex = allTextNodes.findIndex((node) => node.textContent === 'kick.wav');
    expect(loopIndex).toBeLessThan(kickIndex);
  });

});
