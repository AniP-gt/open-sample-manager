import { act, renderHook, waitFor } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCollections } from "../useCollections";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

const invokeMock = vi.mocked(invoke);

type Deferred<T> = {
  readonly promise: Promise<T>;
  readonly reject: (reason?: unknown) => void;
  readonly resolve: (value: T) => void;
};

function deferred<T>(): Deferred<T> {
  let resolvePromise: (value: T) => void = () => undefined;
  let rejectPromise: (reason?: unknown) => void = () => undefined;
  const promise = new Promise<T>((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });
  return { promise, resolve: resolvePromise, reject: rejectPromise };
}

const sampleRow = (id: number) => ({
  id,
  path: `/Samples/sample-${id}.wav`,
  file_name: `sample-${id}.wav`,
  duration: 0.5,
  bpm: 120,
  periodicity: 0.5,
  sample_rate: 44_100,
  low_ratio: 0.5,
  attack_slope: 0.5,
  decay_time: 0.1,
  sample_type: "oneshot",
  waveform_peaks: null,
  playback_type: "oneshot",
  instrument_type: "kick",
  musical_key: null,
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
  duplicate_count: 1,
  tags: [],
});

describe("useCollections", () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it("refreshes the active collection in insertion order without changing sample selection", async () => {
    // Given: one active collection and an independently owned sample selection.
    const selectedSampleId = 99;
    invokeMock.mockImplementation(async (command) => {
      if (command === "list_collections") {
        return [{ id: 7, name: "drum rack", created_at: "2026-01-01", sample_count: 2 }];
      }
      if (command === "get_collection_members") return [sampleRow(3), sampleRow(1)];
      return undefined;
    });

    const { result } = renderHook(() => useCollections());
    await waitFor(() => expect(result.current.collections).toHaveLength(1));

    // When: the user selects a collection, then an external write requests a refresh.
    await act(async () => {
      await result.current.selectCollection(7);
      await result.current.refresh();
    });

    // Then: member order refreshes while selection ownership remains outside this hook.
    expect(selectedSampleId).toBe(99);
    expect(result.current.activeMembers.map((sample) => sample.id)).toEqual([3, 1]);
    expect(result.current.samplePaths).toEqual({ 1: "/Samples/sample-1.wav", 3: "/Samples/sample-3.wav" });
  });

  it("keeps a stable empty collection view when the active collection becomes stale", async () => {
    // Given: a selected collection that disappears between refreshes.
    let collectionRequests = 0;
    invokeMock.mockImplementation(async (command) => {
      if (command === "list_collections") {
        collectionRequests += 1;
        return collectionRequests === 1
          ? [{ id: 7, name: "drum rack", created_at: "2026-01-01", sample_count: 1 }]
          : [];
      }
      if (command === "get_collection_members") return [sampleRow(3)];
      return undefined;
    });
    const { result } = renderHook(() => useCollections());
    await waitFor(() => expect(result.current.collections).toHaveLength(1));
    await act(async () => {
      await result.current.selectCollection(7);
      await result.current.refresh();
    });

    // When: an external add/delete lifecycle refresh reports no active collection.
    await act(async () => {
      await result.current.refresh();
    });

    // Then: the selector remains a deliberate empty view instead of falling through to search rows.
    expect(result.current.isCollectionView).toBe(true);
    expect(result.current.activeCollectionId).toBeNull();
    expect(result.current.activeMembers).toEqual([]);
  });

  it("does not report an initial list failure after unmount", async () => {
    // Given: the initial collection request remains pending.
    const listRequest = deferred<unknown>();
    const onError = vi.fn();
    invokeMock.mockReturnValue(listRequest.promise);

    const { unmount } = renderHook(() => useCollections({ onError }));

    // When: the hook unmounts before the request rejects.
    unmount();
    await act(async () => {
      listRequest.reject(new Error("offline"));
      await listRequest.promise.catch(() => undefined);
    });

    // Then: the stale rejection cannot update hook-owned state or report an error.
    expect(onError).not.toHaveBeenCalled();
  });

  it("keeps newer collection B members when collection A resolves last", async () => {
    // Given: collection A and B member requests can resolve out of order.
    const membersA = deferred<unknown>();
    const membersB = deferred<unknown>();
    invokeMock.mockImplementation((command, args) => {
      if (command === "list_collections") {
        return Promise.resolve([
          { id: 1, name: "A", created_at: "2026-01-01", sample_count: 1 },
          { id: 2, name: "B", created_at: "2026-01-01", sample_count: 1 },
        ]);
      }
      if (command === "get_collection_members") {
        return args !== undefined && typeof args === "object" && args !== null && "collectionId" in args && args.collectionId === 1
          ? membersA.promise
          : membersB.promise;
      }
      return Promise.resolve(undefined);
    });
    const { result } = renderHook(() => useCollections());
    await waitFor(() => expect(result.current.collections).toHaveLength(2));

    // When: B becomes active before A completes, then A resolves last.
    let selectA: Promise<void>;
    let selectB: Promise<void>;
    act(() => {
      selectA = result.current.selectCollection(1);
      selectB = result.current.selectCollection(2);
    });
    await act(async () => {
      membersB.resolve([sampleRow(2)]);
      await membersB.promise;
      await selectB;
    });
    await act(async () => {
      membersA.resolve([sampleRow(1)]);
      await membersA.promise;
      await selectA;
    });

    // Then: the latest active collection owns the member state.
    expect(result.current.activeCollectionId).toBe(2);
    expect(result.current.activeMembers.map((sample) => sample.id)).toEqual([2]);
  });

  it("ignores an older refresh after a newer refresh invalidates the active collection", async () => {
    // Given: two refresh requests can observe different collection lists.
    const firstRefresh = deferred<unknown>();
    const secondRefresh = deferred<unknown>();
    let listCalls = 0;
    invokeMock.mockImplementation((command) => {
      if (command === "list_collections") {
        listCalls += 1;
        if (listCalls === 1) return Promise.resolve([{ id: 7, name: "drum rack", created_at: "2026-01-01", sample_count: 1 }]);
        return listCalls === 2 ? firstRefresh.promise : secondRefresh.promise;
      }
      if (command === "get_collection_members") return Promise.resolve([sampleRow(7)]);
      return Promise.resolve(undefined);
    });
    const { result } = renderHook(() => useCollections());
    await waitFor(() => expect(result.current.collections).toHaveLength(1));
    await act(async () => { await result.current.selectCollection(7); });

    // When: the newer refresh removes the active collection before the old refresh resolves.
    let olderRefresh: Promise<void>;
    let newerRefresh: Promise<void>;
    act(() => {
      olderRefresh = result.current.refresh();
      newerRefresh = result.current.refresh();
    });
    await act(async () => {
      secondRefresh.resolve([]);
      await secondRefresh.promise;
      await newerRefresh;
    });
    await act(async () => {
      firstRefresh.resolve([{ id: 7, name: "drum rack", created_at: "2026-01-01", sample_count: 1 }]);
      await firstRefresh.promise;
      await olderRefresh;
    });

    // Then: the stale refresh cannot restore a removed active collection.
    expect(result.current.activeCollectionId).toBeNull();
    expect(result.current.activeMembers).toEqual([]);
  });

  it("ignores an older list error after a newer refresh succeeds", async () => {
    // Given: the initial list request remains pending while a refresh is requested.
    const initialRequest = deferred<unknown>();
    const onError = vi.fn();
    let listCalls = 0;
    invokeMock.mockImplementation((command) => {
      if (command === "list_collections") {
        listCalls += 1;
        return listCalls === 1
          ? initialRequest.promise
          : Promise.resolve([{ id: 8, name: "fresh", created_at: "2026-01-01", sample_count: 0 }]);
      }
      return Promise.resolve(undefined);
    });
    const { result } = renderHook(() => useCollections({ onError }));

    // When: a newer refresh succeeds and the original request subsequently fails.
    await act(async () => { await result.current.refresh(); });
    await act(async () => {
      initialRequest.reject(new Error("stale failure"));
      await initialRequest.promise.catch(() => undefined);
    });

    // Then: the newest data remains visible without an obsolete error notification.
    expect(result.current.collections.map((collection) => collection.id)).toEqual([8]);
    expect(onError).not.toHaveBeenCalled();
  });
});
