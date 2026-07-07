import './mockSampleListDependencies';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { act, fireEvent, screen } from '@testing-library/react';
import { invoke } from '@tauri-apps/api/core';
import { defaultFilters as mockSamplesDefaultFilters, mockSamples, renderSampleList, setFavoriteStore } from './sampleListTestHelpers';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('SampleList row actions', () => {
  test('calls onSampleSelect when row is clicked', () => {
    const onSampleSelect = vi.fn();
    renderSampleList({ onSampleSelect });

    fireEvent.click(screen.getByText('kick.wav'));
    expect(onSampleSelect).toHaveBeenCalledWith(mockSamples[0]);
  });

  test('handles trash button click', () => {
    const onTrashSample = vi.fn();
    renderSampleList({ onTrashSample });

    const trashBtns = screen.getAllByTitle('Send to Trash');
    fireEvent.click(trashBtns[0]);
    expect(onTrashSample).toHaveBeenCalledWith(1);
  });

  test('handles favorite toggle and ensures only one favorite toggle per row exists', () => {
    const toggleFavorite = vi.fn();
    setFavoriteStore([1], toggleFavorite);
    renderSampleList();

    const favBtns = screen.getAllByTitle('Remove from favorites');
    expect(favBtns.length).toBe(1);
    fireEvent.click(favBtns[0]);
    expect(toggleFavorite).toHaveBeenCalledWith(1);
    
    const unFavBtns = screen.getAllByTitle('Add to favorites');
    expect(unFavBtns.length).toBe(1);
  });

  test('handles open folder click', async () => {
    const mockedInvoke = vi.mocked(invoke);
    renderSampleList({ samplePaths: { 1: '/my/kick.wav' } });

    const folderBtns = screen.getAllByTitle('Show in Finder');
    await act(async () => {
      fireEvent.click(folderBtns[0]);
    });

    expect(mockedInvoke).toHaveBeenCalledWith('open_folder', { path: '/my' });
  });

  test('calls onTypeClick when type badge is clicked', () => {
    const onTypeClick = vi.fn();
    renderSampleList({ onTypeClick });

    const typeBadge = screen.getAllByText('one-shot').find((node) => node.tagName.toLowerCase() === 'span');
    expect(typeBadge).toBeDefined();
    fireEvent.click(typeBadge as HTMLElement);
    expect(onTypeClick).toHaveBeenCalledWith(mockSamples[0]);
  });

  test('shows path copied toast on success', async () => {
    renderSampleList({ samplePaths: { 1: '/my/kick.wav' } });

    const copyBtns = screen.getAllByTitle('Copy Full Path');
    await act(async () => {
      fireEvent.click(copyBtns[0]);
    });
    expect(screen.getByText('Path copied!')).toBeInTheDocument();
  });

  test('shows copy failed toast on error', async () => {
    const mockedInvoke = vi.mocked(invoke);
    mockedInvoke.mockImplementation(async (cmd) => {
      if (cmd === 'copy_to_clipboard') {
        return Promise.reject(new Error('Failed'));
      }
      return Promise.resolve();
    });
    renderSampleList({ samplePaths: { 1: '/my/kick.wav' } });

    const copyBtns = screen.getAllByTitle('Copy Full Path');
    await act(async () => {
      fireEvent.click(copyBtns[0]);
    });
    expect(screen.getByText('Copy failed')).toBeInTheDocument();
  });
});


describe('SampleList random toolbar controls', () => {
  test('disables random controls when there are no candidates or history', () => {
    renderSampleList({ samples: [] });

    expect(screen.getByRole('button', { name: 'Random' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Back' })).toBeDisabled();
  });

  test('selects a random sample from the filtered sorted candidate pool', () => {
    const onSampleSelect = vi.fn();
    vi.spyOn(Math, 'random').mockReturnValue(0);

    renderSampleList({
      filters: { ...mockSamplesDefaultFilters, filterType: 'loop' },
      onSampleSelect,
    });

    fireEvent.click(screen.getByRole('button', { name: 'Random' }));

    expect(onSampleSelect).toHaveBeenCalledWith(mockSamples[1]);
  });

  test('avoids immediately repeating the selected sample when another candidate exists', () => {
    const onSampleSelect = vi.fn();
    vi.spyOn(Math, 'random').mockReturnValue(0);

    renderSampleList({ selectedSample: mockSamples[0], onSampleSelect });

    fireEvent.click(screen.getByRole('button', { name: 'Random' }));

    expect(onSampleSelect).toHaveBeenCalledWith(mockSamples[1]);
  });

  test('returns to the previous random selection', () => {
    const onSampleSelect = vi.fn();
    const randomSpy = vi.spyOn(Math, 'random');
    randomSpy.mockReturnValueOnce(0).mockReturnValueOnce(0.99);

    renderSampleList({ onSampleSelect });

    fireEvent.click(screen.getByRole('button', { name: 'Random' }));
    fireEvent.click(screen.getByRole('button', { name: 'Random' }));
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(onSampleSelect).toHaveBeenNthCalledWith(1, mockSamples[0]);
    expect(onSampleSelect).toHaveBeenNthCalledWith(2, mockSamples[1]);
    expect(onSampleSelect).toHaveBeenNthCalledWith(3, mockSamples[0]);
  });
});
