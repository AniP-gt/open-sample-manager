import './mockSampleListDependencies';
import { describe, expect, test, vi } from 'vitest';
import { act, fireEvent, screen } from '@testing-library/react';
import { invoke } from '@tauri-apps/api/core';
import { mockSamples, renderSampleList, setFavoriteStore } from './sampleListTestHelpers';

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

    const typeBadge = screen.getAllByText('one-shot').find((element) => element.tagName !== 'OPTION');
    if (!typeBadge) throw new Error('type badge not found');
    fireEvent.click(typeBadge);
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
