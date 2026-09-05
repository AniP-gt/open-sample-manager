import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { getInvokeMock, renderApp, useAppTestHarness } from './appTestHarness';

describe('App basic workflows', () => {
  useAppTestHarness();

  test('renders initial App layout', async () => {
    await renderApp();
    expect(screen.getByText(/OPEN SAMPLE MANAGER/i)).toBeInTheDocument();
  });

  test('loads the first MIDI page with the shared page limit', async () => {
    await renderApp();
    await act(async () => fireEvent.click(screen.getByText('MIDI')));
    await waitFor(() => expect(getInvokeMock()).toHaveBeenCalledWith('list_midis_paginated', {
      directoryPath: null, limit: 100, offset: 0, tagId: null,
    }));
  });

  test('shows rescan prompt and handles skip', async () => {
    await renderApp();
    await act(async () => fireEvent.click(screen.getByText('SCAN LIBRARY')));
    await act(async () => fireEvent.click(await screen.findByText('Skip')));
    expect(screen.queryByText('Skip')).not.toBeInTheDocument();
  });

  test('selects a sample, shows details and player, then closes', async () => {
    await renderApp();
    await act(async () => fireEvent.click(await screen.findByText('test.wav')));
    await act(async () => fireEvent.click(await screen.findByTitle('Close waveform UI')));
    expect(screen.queryByTitle('Close waveform UI')).not.toBeInTheDocument();
  });

  test('opens and closes settings', async () => {
    await renderApp();
    await act(async () => fireEvent.click(screen.getByTitle('Settings')));
    expect(screen.getByText('SETTINGS')).toBeInTheDocument();
    await act(async () => fireEvent.click(screen.getByText('✕')));
  });
});
