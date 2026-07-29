import './mockSampleListDependencies';
import { describe, expect, test, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { defaultFilters, mockSamples, renderSampleList } from './sampleListTestHelpers';

describe('SampleList drag, pagination, and grid view', () => {
  test('submits search on Enter or search button without applying changes while typing', () => {
    const onSearchSubmit = vi.fn();
    const onFilterChange = vi.fn();
    renderSampleList({ onSearchSubmit, onFilterChange });

    const input = screen.getByPlaceholderText('Search by filename, tag, key...');
    fireEvent.change(input, { target: { value: 'snare' } });

    expect(onFilterChange).not.toHaveBeenCalled();
    expect(onSearchSubmit).not.toHaveBeenCalled();

    fireEvent.keyDown(input, { key: 'Enter' });
    expect(onSearchSubmit).toHaveBeenCalledWith('snare');

    fireEvent.change(input, { target: { value: 'hat' } });
    fireEvent.click(screen.getByRole('button', { name: 'Search samples' }));
    expect(onSearchSubmit).toHaveBeenLastCalledWith('hat');
  });

  test('shows No more results when canLoadMore is false and items present', () => {
    renderSampleList({ canLoadMore: false });

    expect(screen.getByText('No more results')).toBeInTheDocument();
  });

  test('does not offer another page when the applied search has no visible results', () => {
    renderSampleList({
      filters: { ...defaultFilters, search: 'notfound' },
      canLoadMore: true,
      onLoadMore: vi.fn(async () => {}),
    });

    expect(screen.queryByText('Load more')).not.toBeInTheDocument();
  });

  test('handles drag overlay', () => {
    const { container } = renderSampleList();
    const root = container.firstChild;
    if (root) {
      fireEvent.dragEnter(root, { dataTransfer: { types: ['Files'] } });
    }
    expect(screen.getByText(/Drop files or folders to import/i)).toBeInTheDocument();
  });

  test('handles drag drop', () => {
    const { container } = renderSampleList();
    const root = container.firstChild as Element;
    fireEvent.drop(root, { dataTransfer: { files: [{ path: '/tmp/test.wav' }] } });
    expect(screen.queryByText(/Drop files or folders to import/i)).not.toBeInTheDocument();
  });

  test('loading states', () => {
    renderSampleList({
      isLoadingPrevious: true,
      isLoadingMore: true,
    });

    expect(screen.getAllByText('Loading...').length).toBeGreaterThan(0);
  });

  test('switches to GridView and selects an item', () => {
    const onSampleSelect = vi.fn();
    renderSampleList({ onSampleSelect });

    const gridBtn = screen.getByTitle('Grid view');
    fireEvent.click(gridBtn);
    expect(screen.queryByText('FILENAME')).not.toBeInTheDocument();

    const kickItem = screen.getAllByText('kick.wav')[0];
    fireEvent.click(kickItem);
    expect(onSampleSelect).toHaveBeenCalledWith(mockSamples[0]);
  });

  test('handles load more/previous buttons', () => {
    const onLoadMore = vi.fn(async () => {});
    const onLoadPrevious = vi.fn(async () => {});
    renderSampleList({
      canLoadMore: true,
      onLoadMore,
      canLoadPrevious: true,
      onLoadPrevious,
    });

    const loadMoreBtn = screen.getByText('Load more');
    fireEvent.click(loadMoreBtn);
    expect(onLoadMore).toHaveBeenCalled();

    const loadPrevBtn = screen.getByText('Load previous');
    fireEvent.click(loadPrevBtn);
    expect(onLoadPrevious).toHaveBeenCalled();
  });
});
