import { waitFor } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { defaultInvokeMock, getInvokeMock, renderApp, sampleRow, useAppTestHarness } from './appTestHarness';
import { useSettingsStore } from '../store/useSettingsStore';

describe('App external preview workflow', () => {
  useAppTestHarness();

  test.each([false, true])('plays one external preview when auto-play is %s', async (autoPlayOnSelect) => {
    useSettingsStore.getState().setAutoPlayOnSelect(autoPlayOnSelect);
    let claims = 0;
    getInvokeMock().mockImplementation((command: string) => {
      if (command === 'claim_ui_command_queue') {
        claims += 1;
        return Promise.resolve(claims === 1 ? [{ id: 90, sample_id: 1, type: 'PreviewSample' }] : []);
      }
      if (command === 'get_samples_by_ids') return Promise.resolve([sampleRow()]);
      return defaultInvokeMock(command);
    });
    const play = vi.mocked(window.HTMLMediaElement.prototype.play);
    play.mockClear();
    await renderApp();
    await waitFor(() => expect(play).toHaveBeenCalledOnce());
  });
});
