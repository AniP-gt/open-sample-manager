import { act, fireEvent, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { renderApp, useAppTestHarness } from './appTestHarness';

async function openMidiView() {
  await renderApp();
  await act(async () => fireEvent.click(screen.getByText('MIDI')));
}

async function openMidiTagEditor() {
  await openMidiView();
  await act(async () => fireEvent.click(await screen.findByText('+ tag')));
  expect(await screen.findByText('EDIT MIDI TAG')).toBeInTheDocument();
}

describe('App MIDI workflows', () => {
  useAppTestHarness();

  test('selects a MIDI row and shows detail', async () => {
    await openMidiView();
    await act(async () => fireEvent.click(await screen.findByText('test.mid')));
    expect(screen.getByText('FILTERS')).toBeInTheDocument();
  });

  test('confirms trashing a MIDI', async () => {
    await openMidiView();
    await act(async () => fireEvent.click(await screen.findByTitle('Send to Trash')));
    expect(await screen.findByText(/Are you sure you want to move .* to the Trash\?/)).toBeInTheDocument();
    await act(async () => fireEvent.click(screen.getByText('Yes')));
    expect(screen.queryByText(/Are you sure you want to move .* to the Trash\?/)).not.toBeInTheDocument();
  });

  test('cancels trashing a MIDI', async () => {
    await openMidiView();
    await act(async () => fireEvent.click(await screen.findByTitle('Send to Trash')));
    expect(await screen.findByText(/Are you sure you want to move .* to the Trash\?/)).toBeInTheDocument();
    await act(async () => fireEvent.click(screen.getByText('No')));
    expect(screen.queryByText(/Are you sure you want to move .* to the Trash\?/)).not.toBeInTheDocument();
  });

  test('opens and closes MIDI tag management modal', async () => {
    await openMidiTagEditor();
    await act(async () => fireEvent.click(screen.getByText('MANAGE')));
    expect(await screen.findByText('MANAGE MIDI TAGS')).toBeInTheDocument();
    await act(async () => fireEvent.click(screen.getByText('CLOSE')));
    expect(screen.queryByText('MANAGE MIDI TAGS')).not.toBeInTheDocument();
  });

  test('closes MIDI tag edit modal', async () => {
    await openMidiTagEditor();
    await act(async () => fireEvent.click(screen.getByText('CANCEL')));
    expect(screen.queryByText('EDIT MIDI TAG')).not.toBeInTheDocument();
  });
});
