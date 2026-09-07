import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { defaultInvokeMock, getInvokeMock, renderApp, useAppTestHarness } from './appTestHarness';
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
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'WEB' })); });
    await act(async () => { fireEvent.click(screen.getByText('MUSICRADAR')); });
    await act(async () => { fireEvent.click(await screen.findByRole('button', { name: 'Back to sources' })); });
    expect(await screen.findByRole('region', { name: 'Web sources' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Go back' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Go forward' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Back to sources' })).not.toBeInTheDocument();
  });

  test('returns an active embedded web provider to sources when WEB is selected again', async () => {
    useEmbeddedProviderMode();
    await renderApp();
    fireEvent.click(screen.getByRole('button', { name: 'WEB' }));
    fireEvent.click(screen.getByText('MUSICRADAR'));
    expect(await screen.findByRole('region', { name: 'Web provider browser' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'WEB' }));
    await waitFor(() => {
      expect(getInvokeMock()).toHaveBeenCalledWith('close_embedded_provider_browser', { provider: 'music_radar' });
      expect(screen.getByRole('region', { name: 'Web sources' })).toBeInTheDocument();
    });
  });

  test('returns from Freesound to sources before opening each embedded provider', async () => {
    useEmbeddedProviderMode();
    await renderApp();

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'WEB' })); });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /FREESOUND API Search/i })); });
    expect(await screen.findByRole('region', { name: 'Freesound setup' })).toBeInTheDocument();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Back to sources' })); });
    expect(await screen.findByRole('region', { name: 'Web sources' })).toBeInTheDocument();

    await act(async () => { fireEvent.click(screen.getByText('MUSICRADAR')); });
    expect(await screen.findByText('MUSICRADAR / SampleRadar')).toBeInTheDocument();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Back to sources' })); });
    expect(await screen.findByRole('region', { name: 'Web sources' })).toBeInTheDocument();

    await act(async () => { fireEvent.click(screen.getByText('FIFTYSOUNDS')); });
    expect(await screen.findByText('FIFTYSOUNDS / Free Sound Library')).toBeInTheDocument();
  });

  test('returns from Freesound in window mode before opening each provider window', async () => {
    await renderApp();

    fireEvent.click(screen.getByRole('button', { name: 'WEB' }));
    fireEvent.click(screen.getByRole('button', { name: /FREESOUND API Search/i }));
    expect(await screen.findByRole('region', { name: 'Freesound setup' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Back to sources' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Go back' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Go forward' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Back to sources' }));
    expect(await screen.findByRole('region', { name: 'Web sources' })).toBeInTheDocument();
    fireEvent.click(screen.getByText('MUSICRADAR'));
    await waitFor(() => expect(getInvokeMock()).toHaveBeenCalledWith('open_provider_browser', expect.objectContaining({ mode: 'window', provider: 'music_radar' })));
    expect(screen.getByRole('region', { name: 'Web sources' })).toBeInTheDocument();

    fireEvent.click(screen.getByText('FIFTYSOUNDS'));
    await waitFor(() => expect(getInvokeMock()).toHaveBeenCalledWith('open_provider_browser', expect.objectContaining({ mode: 'window', provider: 'fifty_sounds' })));
  });

  test('preserves the window provider route when cleanup fails before opening Freesound', async () => {
    getInvokeMock().mockImplementation((command: string) => command === 'close_all_provider_browsers'
      ? Promise.reject(new Error('native close failed'))
      : defaultInvokeMock(command));
    await renderApp();

    fireEvent.click(screen.getByRole('button', { name: 'WEB' }));
    fireEvent.click(screen.getByText('MUSICRADAR'));
    await waitFor(() => expect(getInvokeMock()).toHaveBeenCalledWith('open_provider_browser', expect.objectContaining({ mode: 'window', provider: 'music_radar' })));
    fireEvent.click(screen.getByRole('button', { name: /FREESOUND API Search/i }));

    expect(await screen.findByText('Provider browser could not be closed.')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Web sources' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Freesound setup' })).not.toBeInTheDocument();
  });

  test('preserves Freesound when cleanup fails while returning to sources in window mode', async () => {
    await renderApp();
    fireEvent.click(screen.getByRole('button', { name: 'WEB' }));
    fireEvent.click(screen.getByRole('button', { name: /FREESOUND API Search/i }));
    expect(await screen.findByRole('region', { name: 'Freesound setup' })).toBeInTheDocument();
    getInvokeMock().mockImplementation((command: string) => command === 'close_all_provider_browsers'
      ? Promise.reject(new Error('native close failed'))
      : defaultInvokeMock(command));

    fireEvent.click(screen.getByRole('button', { name: 'Back to sources' }));

    expect(await screen.findByText('Provider browser could not be closed.')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Freesound setup' })).toBeInTheDocument();
  });

  test('clears a stale provider-root error when entering Freesound', async () => {
    getInvokeMock().mockImplementation((command: string) => command === 'open_provider_browser'
      ? Promise.reject(JSON.stringify({ code: 'provider_root_invalid', message: 'invalid root', details: null }))
      : defaultInvokeMock(command));
    await renderApp();
    fireEvent.click(screen.getByRole('button', { name: 'WEB' }));
    fireEvent.click(screen.getByText('MUSICRADAR'));
    expect(await screen.findByText(/provider_root_invalid/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /FREESOUND API Search/i }));

    expect(await screen.findByRole('region', { name: 'Freesound setup' })).toBeInTheDocument();
    expect(screen.queryByText(/provider_root_invalid/)).not.toBeInTheDocument();
  });

  test('preserves unrelated global errors when entering Freesound', async () => {
    getInvokeMock().mockImplementation((command: string) => command === 'open_provider_browser'
      ? Promise.reject(new Error('native provider failure'))
      : defaultInvokeMock(command));
    await renderApp();
    fireEvent.click(screen.getByRole('button', { name: 'WEB' }));
    fireEvent.click(screen.getByText('MUSICRADAR'));
    expect(await screen.findByText('Provider browser could not be opened.: native provider failure')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /FREESOUND API Search/i }));

    expect(await screen.findByRole('region', { name: 'Freesound setup' })).toBeInTheDocument();
    expect(screen.getByText('Provider browser could not be opened.: native provider failure')).toBeInTheDocument();
  });
});
