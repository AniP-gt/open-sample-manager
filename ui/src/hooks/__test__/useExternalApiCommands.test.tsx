import { act, renderHook, waitFor } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TauriSampleRow } from "../../types/tauri";
import type { PlayerBarHandle } from "../../components";
import { useExternalApiCommands } from "../useExternalApiCommands";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn() }));

const invokeMock = vi.mocked(invoke);
const listenMock = vi.mocked(listen);

const sampleRow = (id: number): TauriSampleRow => ({
  id,
  path: `/Users/alice/Samples/sample-${id}.wav`,
  file_name: `sample-${id}.wav`,
  duration: 0.5,
  bpm: 124,
  periodicity: 0.4,
  sample_rate: 44_100,
  low_ratio: 0.8,
  attack_slope: 0.7,
  decay_time: 0.2,
  sample_type: "kick",
  waveform_peaks: "[0,1]",
  playback_type: "oneshot",
  instrument_type: "kick",
  musical_key: "C",
  source: null,
  pack_name: null,
  license: null,
  license_url: null,
  license_memo: null,
  imported_at: null,
  peak_db: null,
  rms_db: null,
  leading_silence_ms: null,
  clipping_count: null,
  channel_count: null,
  bit_depth: null,
  quality_flags: null,
  content_hash: null,
  duplicate_count: null,
  tags: [],
});

describe("useExternalApiCommands", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    listenMock.mockReset();
  });

  it("drains initially and idempotently acknowledges a re-presented lease on wake", async () => {
    const unlisten = vi.fn();
    let wake: (() => void) | undefined;
    const showExternalResults = vi.fn();
    const setViewMode = vi.fn();
    const setError = vi.fn();
    const window = {
      show: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
      setFocus: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    };
    listenMock.mockImplementation(async (_event, handler) => {
      wake = () => handler({} as never);
      return unlisten;
    });
    invokeMock.mockImplementation(async (command) => {
      if (command === "claim_ui_command_queue") {
        return [{ id: 1, type: "ShowSamples", sample_ids: [3, 1, 2], selected_id: 1 }];
      }
      if (command === "get_samples_by_ids") return [sampleRow(1), sampleRow(2), sampleRow(3)];
      return undefined;
    });

    const { unmount } = renderHook(() =>
      useExternalApiCommands({
        showExternalResults,
        setViewMode,
        setError,
        playerBarRef: { current: null },
        selectSample: vi.fn(),
        getAppWindow: () => window,
      }),
    );

    await waitFor(() => expect(showExternalResults).toHaveBeenCalledTimes(1));
    expect(showExternalResults).toHaveBeenCalledWith(expect.objectContaining({
      samples: expect.arrayContaining([expect.objectContaining({ id: 3 })]),
      selectedId: 1,
    }));
    expect(showExternalResults.mock.calls[0]?.[0].samples.map((sample: { id: number }) => sample.id)).toEqual([3, 1, 2]);
    expect(setViewMode).toHaveBeenCalledWith("sample");
    expect(window.show).toHaveBeenCalledOnce();
    expect(window.setFocus).toHaveBeenCalledOnce();

    await act(async () => {
      wake?.();
    });
    expect(invokeMock).toHaveBeenCalledWith("claim_ui_command_queue");
    await waitFor(() => expect(showExternalResults).toHaveBeenCalledOnce());

    unmount();
    expect(unlisten).toHaveBeenCalledOnce();
  });

  it("reports missing rows without replacing the active external results", async () => {
    const showExternalResults = vi.fn();
    const setError = vi.fn();

    listenMock.mockResolvedValue(vi.fn());
    invokeMock.mockImplementation(async (command) => {
      if (command === "claim_ui_command_queue") {
        return [{ id: 2, type: "ShowSamples", sample_ids: [3, 1, 2], selected_id: 1 }];
      }
      if (command === "get_samples_by_ids") return [sampleRow(1), sampleRow(3)];
      return undefined;
    });

    renderHook(() =>
      useExternalApiCommands({
        showExternalResults,
        setViewMode: vi.fn(),
        setError,
        playerBarRef: { current: null },
        selectSample: vi.fn(),
      }),
    );

    await waitFor(() => expect(setError).toHaveBeenCalledWith("Could not load every requested sample."));
    expect(showExternalResults).not.toHaveBeenCalled();
  });

  it("refreshes collections before acknowledging a collection-change lease", async () => {
    // Given: a durable collection-change lease and a focused collection refresh action.
    const refreshCollections = vi.fn().mockResolvedValue(undefined);
    listenMock.mockResolvedValue(vi.fn());
    invokeMock.mockImplementation(async (command) => {
      if (command === "claim_ui_command_queue") return [{ id: 60, type: "CollectionsChanged" }];
      return undefined;
    });

    renderHook(() => useExternalApiCommands({
      showExternalResults: vi.fn(),
      setViewMode: vi.fn(),
      setError: vi.fn(),
      playerBarRef: { current: null },
      selectSample: vi.fn(),
      refreshCollections,
    }));

    // When: the renderer drains the external collection update.
    await waitFor(() => expect(refreshCollections).toHaveBeenCalledOnce());

    // Then: the queue acknowledges only after the collection refresh completes.
    expect(invokeMock).toHaveBeenCalledWith("acknowledge_ui_command", { id: 60 });
  });

  it("stops, selects, and plays a delayed preview handle once without a timer", async () => {
    // Given: a queued preview for a different sample and a PlayerBar that has not mounted yet.
    const playerBarRef: { current: PlayerBarHandle | null } = { current: null };
    const stop = vi.fn();
    const playFromStart = vi.fn();
    const selectSample = vi.fn();
    const setError = vi.fn();
    const showExternalResults = vi.fn();
    const setViewMode = vi.fn();
    const commands = [[{ id: 3, type: "PreviewSample", sample_id: 2 }], []] as const;
    let drainCount = 0;
    let wake: (() => void) | undefined;

    listenMock.mockImplementation(async (_event, handler) => {
      wake = () => handler({} as never);
      return () => {};
    });
    invokeMock.mockImplementation(async (command) => {
      if (command === "claim_ui_command_queue") {
        const next = commands[drainCount] ?? [];
        drainCount += 1;
        return next;
      }
      if (command === "get_samples_by_ids") return [sampleRow(2)];
      return undefined;
    });

    const { result, unmount } = renderHook(() =>
      useExternalApiCommands({
        showExternalResults,
        setViewMode,
        setError,
        playerBarRef,
        selectSample,
      }),
    );

    await waitFor(() => expect(selectSample).toHaveBeenCalledWith(expect.objectContaining({ id: 2 })));
    expect(stop).not.toHaveBeenCalled();
    expect(playFromStart).not.toHaveBeenCalled();
    expect(result.current.previewSampleId).toBe(2);

    // When: React mounts the selected PlayerBar after selection.
    playerBarRef.current = { stop, play: vi.fn(), playFromStart, toggle: vi.fn(), isPlaying: false };
    act(() => {
      result.current.onPlayerBarReady();
    });

    // Then: prior playback stops before one explicit play-from-zero, with no fallback replay.
    await waitFor(() => expect(stop).toHaveBeenCalledOnce());
    expect(playFromStart).toHaveBeenCalledOnce();
    expect(setError).not.toHaveBeenCalled();

    await act(async () => {
      wake?.();
    });
    expect(playFromStart).toHaveBeenCalledOnce();

    unmount();
  });

  it("reports an unavailable preview target without selecting or playing", async () => {
    // Given: a preview command whose target cannot be resolved by the renderer.
    const playerBarRef: { current: PlayerBarHandle | null } = {
      current: { stop: vi.fn(), play: vi.fn(), playFromStart: vi.fn(), toggle: vi.fn(), isPlaying: false },
    };
    const setError = vi.fn();
    const selectSample = vi.fn();

    listenMock.mockResolvedValue(vi.fn());
    invokeMock.mockImplementation(async (command) => {
      if (command === "claim_ui_command_queue") return [{ id: 4, type: "PreviewSample", sample_id: 2 }];
      if (command === "get_samples_by_ids") return [];
      return undefined;
    });

    renderHook(() => useExternalApiCommands({
      showExternalResults: vi.fn(),
      setViewMode: vi.fn(),
      setError,
      playerBarRef,
      selectSample,
    }));

    // When: the queue is drained before a valid sample is available.
    await waitFor(() => expect(setError).toHaveBeenCalledWith(
      "Could not preview the requested sample because it is unavailable.",
    ));

    // Then: no partial selection or playback occurs.
    expect(selectSample).not.toHaveBeenCalled();
    expect(playerBarRef.current?.playFromStart).not.toHaveBeenCalled();
    expect(invokeMock).toHaveBeenCalledWith("acknowledge_ui_command", { id: 4 });
  });

  it("requeues a preview when renderer IPC is offline before scheduling", async () => {
    // Given: a claimed preview whose sample lookup rejects as an offline IPC failure.
    listenMock.mockResolvedValue(vi.fn());
    invokeMock.mockImplementation(async (command) => {
      if (command === "claim_ui_command_queue") {
        return [{ id: 40, type: "PreviewSample", sample_id: 2 }];
      }
      if (command === "get_samples_by_ids") throw new Error("offline");
      return undefined;
    });

    renderHook(() => useExternalApiCommands({
      showExternalResults: vi.fn(),
      setViewMode: vi.fn(),
      setError: vi.fn(),
      playerBarRef: { current: null },
      selectSample: vi.fn(),
    }));

    // When: the command cannot resolve its sample before it is scheduled.
    // Then: the durable lease is recoverably returned rather than terminally acknowledged.
    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith("nack_ui_command", { id: 40 }));
  });

  it("requeues an in-flight preview when unmounted during its sample lookup", async () => {
    // Given: a claimed preview whose lookup is still pending when the renderer closes.
    let resolveRows: ((rows: TauriSampleRow[]) => void) | undefined;
    const rows = new Promise<TauriSampleRow[]>((resolve) => {
      resolveRows = resolve;
    });
    listenMock.mockResolvedValue(vi.fn());
    invokeMock.mockImplementation(async (command) => {
      if (command === "claim_ui_command_queue") {
        return [{ id: 41, type: "PreviewSample", sample_id: 2 }];
      }
      if (command === "get_samples_by_ids") return rows;
      return undefined;
    });

    const { unmount } = renderHook(() => useExternalApiCommands({
      showExternalResults: vi.fn(),
      setViewMode: vi.fn(),
      setError: vi.fn(),
      playerBarRef: { current: null },
      selectSample: vi.fn(),
    }));
    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith(
      "get_samples_by_ids",
      { sampleIds: [2] },
    ));

    // When: React unmounts before the pending lookup resolves.
    unmount();
    resolveRows?.([sampleRow(2)]);

    // Then: the lease returns to the durable queue instead of being acknowledged or played.
    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith("nack_ui_command", { id: 41 }));
  });

  it("acknowledges a scheduled preview once despite duplicate wake events", async () => {
    // Given: one leased preview, a ready player, and a duplicate queue wake.
    let wake: (() => void) | undefined;
    const playFromStart = vi.fn();
    const selectSample = vi.fn().mockResolvedValue(undefined);
    listenMock.mockImplementation(async (_event, handler) => {
      wake = () => handler({} as never);
      return () => {};
    });
    let claims = 0;
    invokeMock.mockImplementation(async (command) => {
      if (command === "claim_ui_command_queue") {
        claims += 1;
        return claims === 1 ? [{ id: 42, type: "PreviewSample", sample_id: 2 }] : [];
      }
      if (command === "get_samples_by_ids") return [sampleRow(2)];
      return undefined;
    });
    const { result } = renderHook(() => useExternalApiCommands({
      showExternalResults: vi.fn(),
      setViewMode: vi.fn(),
      setError: vi.fn(),
      playerBarRef: {
        current: { stop: vi.fn(), play: vi.fn(), playFromStart, toggle: vi.fn(), isPlaying: false },
      },
      selectSample,
    }));

    // When: scheduling completes, the player reports readiness, and the same queue wakes again.
    await waitFor(() => expect(invokeMock).toHaveBeenCalledWith("acknowledge_ui_command", { id: 42 }));
    act(() => result.current.onPlayerBarReady());
    await act(async () => {
      wake?.();
    });

    // Then: the command is acknowledged and plays exactly once.
    await waitFor(() => expect(playFromStart).toHaveBeenCalledOnce());
    expect(selectSample).toHaveBeenCalledOnce();
  });

  it("terminally acknowledges an incompatible claimed envelope and shows an error", async () => {
    const setError = vi.fn();
    listenMock.mockResolvedValue(vi.fn());
    invokeMock.mockImplementation(async (command) => {
      if (command === "claim_ui_command_queue") return [{ id: 50, type: "UnsupportedCommand" }];
      return undefined;
    });

    renderHook(() => useExternalApiCommands({
      showExternalResults: vi.fn(),
      setViewMode: vi.fn(),
      setError,
      playerBarRef: { current: null },
      selectSample: vi.fn(),
    }));

    await waitFor(() => expect(setError).toHaveBeenCalledWith(
      "Could not process an incompatible external app command.",
    ));
    expect(invokeMock).toHaveBeenCalledWith("acknowledge_ui_command", { id: 50 });
  });

  it("retries a lost acknowledgement without scheduling or playing the lease twice", async () => {
    let wake: (() => void) | undefined;
    const playFromStart = vi.fn();
    const selectSample = vi.fn().mockResolvedValue(undefined);
    let claimCount = 0;
    let acknowledgementCount = 0;

    listenMock.mockImplementation(async (_event, handler) => {
      wake = () => handler({} as never);
      return () => {};
    });
    invokeMock.mockImplementation(async (command) => {
      if (command === "claim_ui_command_queue") {
        claimCount += 1;
        return claimCount <= 2 ? [{ id: 51, type: "PreviewSample", sample_id: 2 }] : [];
      }
      if (command === "get_samples_by_ids") return [sampleRow(2)];
      if (command === "acknowledge_ui_command") {
        acknowledgementCount += 1;
        if (acknowledgementCount === 1) throw new Error("ack lost");
      }
      return undefined;
    });

    const { result } = renderHook(() => useExternalApiCommands({
      showExternalResults: vi.fn(),
      setViewMode: vi.fn(),
      setError: vi.fn(),
      playerBarRef: {
        current: { stop: vi.fn(), play: vi.fn(), playFromStart, toggle: vi.fn(), isPlaying: false },
      },
      selectSample,
    }));

    await waitFor(() => expect(selectSample).toHaveBeenCalledOnce());
    act(() => result.current.onPlayerBarReady());
    await waitFor(() => expect(playFromStart).toHaveBeenCalledOnce());
    await act(async () => {
      wake?.();
    });

    await waitFor(() => expect(acknowledgementCount).toBe(2));
    expect(selectSample).toHaveBeenCalledOnce();
    expect(playFromStart).toHaveBeenCalledOnce();
    expect(invokeMock).toHaveBeenCalledWith("acknowledge_ui_command", { id: 51 });
  });

  it("bounds continuous lost acknowledgements to one idempotent retry per drain", async () => {
    // Given: a claimed preview is re-presented twice in one drain and every acknowledgement fails.
    let wake: (() => void) | undefined;
    const playFromStart = vi.fn();
    const selectSample = vi.fn().mockResolvedValue(undefined);
    let claimCount = 0;
    let acknowledgementCount = 0;
    listenMock.mockImplementation(async (_event, handler) => {
      wake = () => handler({} as never);
      return () => {};
    });
    invokeMock.mockImplementation(async (command) => {
      if (command === "claim_ui_command_queue") {
        claimCount += 1;
        return claimCount === 1
          ? [
              { id: 52, type: "PreviewSample", sample_id: 2 },
              { id: 52, type: "PreviewSample", sample_id: 2 },
            ]
          : [{ id: 52, type: "PreviewSample", sample_id: 2 }];
      }
      if (command === "get_samples_by_ids") return [sampleRow(2)];
      if (command === "acknowledge_ui_command") {
        acknowledgementCount += 1;
        throw new Error("ack lost");
      }
      return undefined;
    });

    const { result } = renderHook(() => useExternalApiCommands({
      showExternalResults: vi.fn(),
      setViewMode: vi.fn(),
      setError: vi.fn(),
      playerBarRef: {
        current: { stop: vi.fn(), play: vi.fn(), playFromStart, toggle: vi.fn(), isPlaying: false },
      },
      selectSample,
    }));

    // When: the player becomes ready, then a future wake retries the lost acknowledgement.
    await waitFor(() => expect(selectSample).toHaveBeenCalledOnce());
    act(() => result.current.onPlayerBarReady());
    await waitFor(() => expect(acknowledgementCount).toBe(1));
    await act(async () => {
      wake?.();
    });

    // Then: execution occurs once, each drain attempts only one acknowledgement, and future wakes resume it.
    await waitFor(() => expect(acknowledgementCount).toBe(2));
    expect(selectSample).toHaveBeenCalledOnce();
    expect(playFromStart).toHaveBeenCalledOnce();
  });
});
