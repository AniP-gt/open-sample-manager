import './mockSampleListDependencies';
import { describe, expect, test, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { defaultFilters, renderSampleList } from './sampleListTestHelpers';

describe('SampleList rendering, search, and sort', () => {
  test('renders list headers and virtual items', () => {
    renderSampleList({
      samplePaths: { 1: '/kick.wav', 2: '/loop.wav' },
      sort: { field: 'file_name', direction: 'asc' },
    });

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
    renderSampleList({ onSortChange });

    fireEvent.click(screen.getByText('FILENAME'));
    expect(onSortChange).toHaveBeenCalledWith({ field: 'file_name', direction: 'asc' });

    fireEvent.click(screen.getByText('BPM'));
    expect(onSortChange).toHaveBeenCalledWith({ field: 'bpm', direction: 'asc' });

    fireEvent.click(screen.getByText('TYPE'));
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

  test('applies descending sort correctly', () => {
    renderSampleList({ sort: { field: 'file_name', direction: 'desc' } });

    const allTextNodes = screen.getAllByText(/kick.wav|loop.wav/);
    const loopIndex = allTextNodes.findIndex((node) => node.textContent === 'loop.wav');
    const kickIndex = allTextNodes.findIndex((node) => node.textContent === 'kick.wav');
    expect(loopIndex).toBeLessThan(kickIndex);
  });

});
