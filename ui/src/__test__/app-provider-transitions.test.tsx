import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { defaultInvokeMock, getInvokeMock, renderApp, useAppTestHarness } from './appTestHarness';
import { useSettingsStore } from '../store/useSettingsStore';

function useEmbeddedProviderMode() {
  useSettingsStore.getState().setProviderBrowserMode('embedded');
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { callback(0); return 1; });
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
}

async function openEmbeddedProvider() {
  await renderApp();
  fireEvent.click(screen.getByRole('button', { name: 'WEB' }));
  fireEvent.click(screen.getByText('MUSICRADAR'));
  expect(await screen.findByRole('region', { name: 'Web provider browser' })).toBeInTheDocument();
}

describe('App embedded provider transitions', () => {
  useAppTestHarness();

  test('keeps the embedded provider visible until closing it settles before selecting SAMPLE', async () => {
    useEmbeddedProviderMode();
    let resolveClose: (value: unknown) => void = () => undefined;
    let signalCloseStarted: () => void = () => undefined;
    const close = new Promise<unknown>((resolve) => { resolveClose = resolve; });
    const closeStarted = new Promise<void>((resolve) => { signalCloseStarted = resolve; });
    getInvokeMock().mockImplementation((command: string) => {
      if (command === 'close_embedded_provider_browser') { signalCloseStarted(); return close; }
      return defaultInvokeMock(command);
    });
    try {
      await openEmbeddedProvider();
      await waitFor(() => expect(getInvokeMock()).toHaveBeenCalledWith('open_provider_browser', expect.anything()));
      fireEvent.click(screen.getByRole('button', { name: 'SAMPLE' }));
      await closeStarted;
      expect(screen.getByRole('button', { name: 'WEB' })).toHaveStyle({ background: '#3b82f6' });
      expect(screen.getByRole('region', { name: 'Web provider browser' })).toBeInTheDocument();
      await act(async () => { resolveClose(null); await close; });
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'SAMPLE' })).toHaveStyle({ background: '#3b82f6' });
        expect(screen.queryByRole('region', { name: 'Web provider browser' })).not.toBeInTheDocument();
      });
    } finally { resolveClose(null); }
  });

  test('keeps WEB selected and reports a close error when leaving an embedded provider fails', async () => {
    useEmbeddedProviderMode();
    getInvokeMock().mockImplementation((command: string) => command === 'close_embedded_provider_browser'
      ? Promise.reject(new Error('native close failed')) : defaultInvokeMock(command));
    await openEmbeddedProvider();
    fireEvent.click(screen.getByRole('button', { name: 'SAMPLE' }));
    expect(await screen.findByText('Provider browser could not be closed.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'WEB' })).toHaveStyle({ background: '#3b82f6' });
    expect(screen.getByRole('region', { name: 'Web provider browser' })).toBeInTheDocument();
  });

  test('closes an embedded provider and resumes its approved URL after selecting SAMPLE', async () => {
    useEmbeddedProviderMode();
    getInvokeMock().mockImplementation((command: string) => command === 'close_embedded_provider_browser'
      ? Promise.resolve('https://www.musicradar.com/samples/resume-test') : defaultInvokeMock(command));
    await openEmbeddedProvider();
    fireEvent.click(screen.getByRole('button', { name: 'SAMPLE' }));
    await waitFor(() => {
      expect(getInvokeMock()).toHaveBeenCalledWith('close_embedded_provider_browser', { provider: 'music_radar' });
      expect(getInvokeMock()).toHaveBeenCalledWith('close_all_provider_browsers');
      expect(screen.getByRole('button', { name: 'SAMPLE' })).toHaveStyle({ background: '#3b82f6' });
      expect(screen.queryByRole('region', { name: 'Web provider browser' })).not.toBeInTheDocument();
    });
    expect(getInvokeMock()).not.toHaveBeenCalledWith('hide_provider_browser', expect.anything());
    fireEvent.click(screen.getByRole('button', { name: 'WEB' }));
    await waitFor(() => expect(getInvokeMock()).toHaveBeenLastCalledWith('open_provider_browser', expect.objectContaining({
      mode: 'embedded', provider: 'music_radar', url: 'https://www.musicradar.com/samples/resume-test',
    })));
  });

  test('clears a provider-open error after successfully leaving WEB for SAMPLE', async () => {
    useEmbeddedProviderMode();
    getInvokeMock().mockImplementation((command: string) => command === 'open_provider_browser'
      ? Promise.reject({ code: 'provider_surface_unavailable', message: 'native surface unavailable' }) : defaultInvokeMock(command));
    await renderApp();
    fireEvent.click(screen.getByRole('button', { name: 'WEB' }));
    fireEvent.click(screen.getByText('MUSICRADAR'));
    expect(await screen.findByText('Provider browser could not be opened (provider_surface_unavailable): native surface unavailable')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'SAMPLE' }));
    await waitFor(() => {
      expect(getInvokeMock()).toHaveBeenCalledWith('close_all_provider_browsers');
      expect(screen.getByRole('button', { name: 'SAMPLE' })).toHaveStyle({ background: '#3b82f6' });
      expect(screen.queryByText('Provider browser could not be opened (provider_surface_unavailable): native surface unavailable')).not.toBeInTheDocument();
    });
  });
});
