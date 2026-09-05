import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { getInvokeMock, renderApp, useAppTestHarness } from './appTestHarness';
import { useSettingsStore } from '../store/useSettingsStore';

function useEmbeddedProviderMode() {
  useSettingsStore.getState().setProviderBrowserMode('embedded');
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 1; });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
}

describe('App embedded provider navigation', () => {
  useAppTestHarness();

  test('returns an active embedded web provider to sources from the Header', async () => {
    useSettingsStore.getState().setProviderBrowserMode('embedded');
    await renderApp();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'WEB' })));
    await act(async () => fireEvent.click(screen.getByText('MUSICRADAR')));
    await act(async () => fireEvent.click(await screen.findByRole('button', { name: 'Back to sources' })));
    expect(await screen.findByRole('region', { name: 'Web sources' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Go back' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Go forward' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Back to sources' })).not.toBeInTheDocument();
  });

  test('returns an active embedded web provider to sources when WEB is selected again', async () => {
    useEmbeddedProviderMode();
    await renderApp();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'WEB' })));
    await act(async () => fireEvent.click(screen.getByText('MUSICRADAR')));
    expect(await screen.findByRole('region', { name: 'Web provider browser' })).toBeInTheDocument();
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'WEB' })));
    await waitFor(() => {
      expect(getInvokeMock()).toHaveBeenCalledWith('close_embedded_provider_browser', { provider: 'music_radar' });
      expect(screen.getByRole('region', { name: 'Web sources' })).toBeInTheDocument();
    });
  });
});
