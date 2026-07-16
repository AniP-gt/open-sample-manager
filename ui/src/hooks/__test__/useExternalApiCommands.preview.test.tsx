import { act, renderHook, waitFor } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PlayerBarHandle } from "../../components";
import type { TauriSampleRow } from "../../types/tauri";
import { useExternalApiCommands } from "../useExternalApiCommands";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn() }));
vi.mock("@tauri-apps/api/window", () => ({ getCurrentWindow: vi.fn() }));

const row = (id: number): TauriSampleRow => ({ id, path: `/tmp/${id}.wav`, file_name: `${id}.wav`, duration: 1, bpm: null, periodicity: null, sample_rate: 44_100, low_ratio: null, attack_slope: null, decay_time: null, sample_type: "kick", waveform_peaks: "[]", playback_type: "oneshot", instrument_type: "kick", musical_key: null, source: null, pack_name: null, license: null, license_url: null, license_memo: null, imported_at: null, peak_db: null, rms_db: null, leading_silence_ms: null, clipping_count: null, channel_count: null, bit_depth: null, quality_flags: null, content_hash: null, duplicate_count: null, tags: [] });

describe("queued preview PlayerBar lifecycle", () => {
  beforeEach(() => { vi.mocked(invoke).mockReset(); vi.mocked(listen).mockReset(); });

  it("stops the old player once then explicitly starts the selected player", async () => {
    const oldStop = vi.fn(); const selectedPlay = vi.fn(); const selectSample = vi.fn();
    const ref: { current: PlayerBarHandle | null } = { current: { stop: oldStop, play: vi.fn(), playFromStart: vi.fn(), toggle: vi.fn(), isPlaying: true } };
    vi.mocked(listen).mockResolvedValue(vi.fn());
    vi.mocked(invoke).mockImplementation(async (command) => command === "claim_ui_command_queue" ? [{ id: 1, type: "PreviewSample", sample_id: 2 }] : command === "get_samples_by_ids" ? [row(2)] : undefined);
    const { result } = renderHook(() => useExternalApiCommands({ showExternalResults: vi.fn(), setViewMode: vi.fn(), setError: vi.fn(), playerBarRef: ref, selectSample }));
    await waitFor(() => expect(selectSample).toHaveBeenCalledOnce());
    ref.current = { stop: vi.fn(), play: vi.fn(), playFromStart: selectedPlay, toggle: vi.fn(), isPlaying: false };
    act(() => result.current.onPlayerBarReady());
    await waitFor(() => expect(selectedPlay).toHaveBeenCalledOnce());
    expect(oldStop).toHaveBeenCalledOnce();
  });

  it("rejects an incompatible player without delayed playback", async () => {
    const setError = vi.fn(); const laterPlay = vi.fn(); const selectSample = vi.fn(); let drains = 0;
    const ref: { current: PlayerBarHandle | null } = { current: { stop: vi.fn(), play: vi.fn(), toggle: vi.fn(), isPlaying: false } };
    vi.mocked(listen).mockResolvedValue(vi.fn());
    vi.mocked(invoke).mockImplementation(async (command) => { if (command === "claim_ui_command_queue") return drains++ === 0 ? [{ id: 2, type: "PreviewSample", sample_id: 2 }] : []; return command === "get_samples_by_ids" ? [row(2)] : undefined; });
    const { result } = renderHook(() => useExternalApiCommands({ showExternalResults: vi.fn(), setViewMode: vi.fn(), setError, playerBarRef: ref, selectSample }));
    await waitFor(() => expect(result.current.previewSampleId).toBe(2));
    act(() => result.current.onPlayerBarReady());
    await waitFor(() => expect(setError).toHaveBeenCalledWith("Could not preview the requested sample because the player is unavailable."));
    ref.current = { stop: vi.fn(), play: vi.fn(), playFromStart: laterPlay, toggle: vi.fn(), isPlaying: false };
    act(() => result.current.onPlayerBarReady());
    expect(laterPlay).not.toHaveBeenCalled();
  });
});
