import { act, fireEvent, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { defaultInvokeMock, findSampleTypeBadge, getInvokeMock, renderApp, useAppTestHarness } from './appTestHarness';

async function openClassification() {
  await renderApp();
  await act(async () => fireEvent.click(await findSampleTypeBadge()));
  expect(await screen.findByText('EDIT CLASSIFICATION')).toBeInTheDocument();
}

describe('App sample workflows', () => {
  useAppTestHarness();

  test('shows error banner on sample trash failure and retries', async () => {
    getInvokeMock().mockImplementation((command: string) => command === 'send_to_trash' ? Promise.reject('Trash failed mocked') : defaultInvokeMock(command));
    await renderApp();
    await act(async () => fireEvent.click(await screen.findByTitle('Send to Trash')));
    await act(async () => fireEvent.click(screen.getByText('Yes')));
    expect(await screen.findByText(/Trash failed mocked/)).toBeInTheDocument();
    getInvokeMock().mockImplementation(defaultInvokeMock);
    await act(async () => fireEvent.click(screen.getByText('RETRY')));
    expect(screen.queryByText(/Trash failed mocked/)).not.toBeInTheDocument();
  });

  test('confirms trashing a sample', async () => {
    await renderApp();
    await act(async () => fireEvent.click(await screen.findByTitle('Send to Trash')));
    expect(await screen.findByText(/Are you sure you want to move .* to the Trash\?/)).toBeInTheDocument();
    await act(async () => fireEvent.click(screen.getByText('Yes')));
    expect(screen.queryByText(/Are you sure you want to move .* to the Trash\?/)).not.toBeInTheDocument();
  });

  test('cancels trashing a sample', async () => {
    await renderApp();
    await act(async () => fireEvent.click(await screen.findByTitle('Send to Trash')));
    expect(await screen.findByText(/Are you sure you want to move .* to the Trash\?/)).toBeInTheDocument();
    await act(async () => fireEvent.click(screen.getByText('No')));
    expect(screen.queryByText(/Are you sure you want to move .* to the Trash\?/)).not.toBeInTheDocument();
  });

  test('opens classification modal from sample row and closes it', async () => {
    await openClassification();
    await act(async () => fireEvent.click(screen.getByText('CANCEL')));
    expect(screen.queryByText('EDIT CLASSIFICATION')).not.toBeInTheDocument();
  });

  test('saves changes in classification modal', async () => {
    await openClassification();
    await act(async () => fireEvent.click(screen.getByText('SAVE')));
    expect(screen.queryByText('EDIT CLASSIFICATION')).not.toBeInTheDocument();
  });

  test('changes instrument type in classification modal', async () => {
    await openClassification();
    const snare = screen.getByText('SNARE');
    await act(async () => fireEvent.click(snare));
    expect(snare).toHaveStyle({ color: '#f97316' });
  });

  test('opens and closes instrument type management modal', async () => {
    await openClassification();
    await act(async () => fireEvent.click(screen.getByText('MANAGE')));
    expect(await screen.findByText('MANAGE INSTRUMENT TYPES')).toBeInTheDocument();
    await act(async () => fireEvent.click(screen.getByText('CLOSE')));
    expect(screen.queryByText('MANAGE INSTRUMENT TYPES')).not.toBeInTheDocument();
  });
});
