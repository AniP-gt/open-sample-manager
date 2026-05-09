import './mockSampleListDependencies';
import { describe, expect, test, vi } from 'vitest';
import { fireEvent } from '@testing-library/react';
import { defaultFilters, mockSamples, renderSampleList } from './sampleListTestHelpers';

describe('SampleList keyboard navigation', () => {
  test('handles keyboard navigation', () => {
    vi.useFakeTimers();
    const handleSelect = vi.fn();
    const handleTogglePlay = vi.fn();
    const { unmount } = renderSampleList({
      samplePaths: { 1: '/tmp/test1.wav', 2: '/tmp/test2.wav' },
      selectedSample: mockSamples[0],
      filters: defaultFilters,
      sort: { field: 'file_name', direction: 'asc' },
      onSampleSelect: handleSelect,
      onTogglePlayback: handleTogglePlay,
      onTrashSample: vi.fn(),
      onTypeClick: vi.fn(),
      instrumentColorCoding: false,
    });

    fireEvent.keyDown(document.body, { key: 'ArrowDown' });
    vi.advanceTimersByTime(100);
    expect(handleSelect).toHaveBeenCalledWith(mockSamples[1]);

    unmount();

    renderSampleList({
      samplePaths: { 1: '/tmp/test1.wav', 2: '/tmp/test2.wav' },
      selectedSample: mockSamples[1],
      filters: defaultFilters,
      sort: { field: 'file_name', direction: 'asc' },
      onSampleSelect: handleSelect,
      onTogglePlayback: handleTogglePlay,
      onTrashSample: vi.fn(),
      onTypeClick: vi.fn(),
      instrumentColorCoding: false,
    });
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
});
