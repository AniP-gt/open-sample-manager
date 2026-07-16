import { act, renderHook, waitFor } from "@testing-library/react";
import { invoke } from "@tauri-apps/api/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FilterState, SortState } from "../../types/sample";
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

const collectionRow = (id: number, name: string, sampleCount: number) => ({
  id,
  name,
  description: null,
  created_at: "2026-01-01",
  updated_at: "2026-01-01",
  sample_count: sampleCount,
});

const savedSearchRow = () => ({
  id: 1,
  name: "kicks",
  search: "kick",
  filter_type: "all",
  filter_bpm_min: "",
  filter_bpm_max: "",
  filter_instrument_type: "",
  favorites_only: false,
  filter_key: "",
  directory_path: "",
  sort_field: "id",
  sort_direction: "asc",
  created_at: "2026-01-01",
  updated_at: "2026-01-01",
});

const filters: FilterState = {
  search: "",
  filterType: "all",
  filterBpmMin: "",
  filterBpmMax: "",
  filterInstrumentType: "",
  favoritesOnly: false,
  hideDuplicates: false,
  filterKey: "",
  filterLicense: "",
  qualityIssuesOnly: false,
  directoryPath: "",
};

const sort: SortState = { field: "id", direction: "asc" };

describe("useCollections", () => {
  beforeEach(() => {
    invokeMock.mockReset();
  });

  it("refreshes the active collection in insertion order without changing sample selection", async () => {
    // Given: one active collection and an independently owned sample selection.
    const selectedSampleId = 99;
    invokeMock.mockImplementation(async (command) => {
      if (command === "list_collections") {
        return [collectionRow(7, "drum rack", 2)];
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
          ? [collectionRow(7, "drum rack", 1)]
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
          collectionRow(1, "A", 1),
          collectionRow(2, "B", 1),
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

  it("keeps latest same collection members when an older same-collection request rejects", async () => {
    // Given: the same collection is selected twice, and the second request succeeds.
    const firstRequest = deferred<unknown>();
    const secondRequest = deferred<unknown>();
    let memberRequests = 0;
    invokeMock.mockImplementation((command, args) => {
      if (command === "list_collections") {
        return Promise.resolve([collectionRow(1, "A", 1)]);
      }
      if (command === "get_collection_members" && args !== undefined && typeof args === "object" && "collectionId" in args && args.collectionId === 1) {
        memberRequests += 1;
        return memberRequests === 1 ? firstRequest.promise : secondRequest.promise;
      }
      return Promise.resolve(undefined);
    });
    const onError = vi.fn();
    const { result } = renderHook(() => useCollections({ onError }));
    await waitFor(() => expect(result.current.collections).toHaveLength(1));

    let firstSelection: Promise<void>;
    let secondSelection: Promise<void>;
    act(() => {
      firstSelection = result.current.selectCollection(1);
      secondSelection = result.current.selectCollection(1);
    });

    // When: the newer request resolves, then the older one rejects.
    await act(async () => {
      secondRequest.resolve([sampleRow(2)]);
      await secondRequest.promise;
      await secondSelection;
    });
    await act(async () => {
      firstRequest.reject(new Error("stale failure"));
      await firstRequest.promise.catch(() => undefined);
      await firstSelection;
    });

    // Then: the latest same-collection result stays active and no stale error is reported.
    expect(result.current.activeCollectionId).toBe(1);
    expect(result.current.activeMembers.map((sample) => sample.id)).toEqual([2]);
    expect(onError).not.toHaveBeenCalled();
  });

  it("ignores an older refresh after a newer refresh invalidates the active collection", async () => {
    // Given: two refresh requests can observe different collection lists.
    const firstRefresh = deferred<unknown>();
    const secondRefresh = deferred<unknown>();
    let listCalls = 0;
    invokeMock.mockImplementation((command) => {
      if (command === "list_collections") {
        listCalls += 1;
        if (listCalls === 1) return Promise.resolve([collectionRow(7, "drum rack", 1)]);
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
      firstRefresh.resolve([collectionRow(7, "drum rack", 1)]);
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
          : Promise.resolve([collectionRow(8, "fresh", 0)]);
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

  it("refreshes active collection members after a collection mutation", async () => {
    let collectionCount = 1;
    invokeMock.mockImplementation(async (command) => {
      if (command === "list_collections") {
        return [collectionRow(7, "drum rack", collectionCount)];
      }
      if (command === "get_collection_members") return collectionCount === 1 ? [sampleRow(1)] : [sampleRow(1), sampleRow(2)];
      if (command === "add_samples_to_collection") {
        collectionCount = 2;
        return 1;
      }
      return undefined;
    });
    const { result } = renderHook(() => useCollections());
    await waitFor(() => expect(result.current.collections).toHaveLength(1));
    await act(async () => {
      await result.current.selectCollection(7);
      await result.current.addSelectedToCollection(7, [2]);
    });

    expect(result.current.collections[0]?.sample_count).toBe(2);
    expect(result.current.activeMembers.map((sample) => sample.id)).toEqual([1, 2]);
  });

  it("exits collection view before applying a saved search", async () => {
    const setFilters = vi.fn();
    const setSort = vi.fn();
    const runSearch = vi.fn<() => Promise<unknown>>().mockResolvedValue([]);
    invokeMock.mockImplementation(async (command) => {
      if (command === "list_collections") return [collectionRow(7, "drum rack", 1)];
      if (command === "list_saved_searches") return [];
      if (command === "get_collection_members") return [sampleRow(1)];
      return undefined;
    });
    const { result } = renderHook(() => useCollections({ filters, sort, setFilters, setSort, runSearch }));
    await waitFor(() => expect(result.current.collections).toHaveLength(1));
    await act(async () => {
      await result.current.selectCollection(7);
      await result.current.applySavedSearch({
        id: 1,
        name: "kicks",
        search: "kick",
        filter_type: "all",
        filter_bpm_min: "",
        filter_bpm_max: "",
        filter_instrument_type: "",
        favorites_only: false,
        filter_key: "",
        directory_path: "/packs",
        sort_field: "bpm",
        sort_direction: "desc",
        created_at: "2026-01-01",
        updated_at: "2026-01-01",
      });
    });

    expect(result.current.isCollectionView).toBe(false);
    expect(result.current.activeMembers).toEqual([]);
    expect(runSearch).toHaveBeenCalledWith("kick", "/packs");
  });

  it("clears stale members when collection B fails after collection A succeeds", async () => {
    const onError = vi.fn();
    invokeMock.mockImplementation(async (command, args) => {
      if (command === "list_collections") return [collectionRow(1, "A", 1), collectionRow(2, "B", 1)];
      if (command === "list_saved_searches") return [];
      if (command === "get_collection_members" && args !== undefined && typeof args === "object" && args !== null && "collectionId" in args && args.collectionId === 1) return [sampleRow(1)];
      if (command === "get_collection_members") throw new Error("offline");
      return undefined;
    });
    const { result } = renderHook(() => useCollections({ onError }));
    await waitFor(() => expect(result.current.collections).toHaveLength(2));
    await act(async () => { await result.current.selectCollection(1); });
    expect(result.current.activeMembers.map((sample) => sample.id)).toEqual([1]);

    await act(async () => { await result.current.selectCollection(2); });

    expect(result.current.isCollectionView).toBe(false);
    expect(result.current.activeCollectionId).toBeNull();
    expect(result.current.activeMembers).toEqual([]);
    expect(onError).toHaveBeenCalledWith("Could not load collection samples.");
  });

  it("rejects malformed IPC rows before they enter collection state", async () => {
    invokeMock.mockImplementation(async (command) => {
      if (command === "list_collections") return [collectionRow(1, "valid", 1), { id: 2, name: "missing fields" }];
      if (command === "list_saved_searches") return [savedSearchRow(), { id: 2, name: "missing fields" }];
      if (command === "get_collection_members") return [sampleRow(1), { id: 2, path: "/missing.wav" }];
      return undefined;
    });
    const { result } = renderHook(() => useCollections());
    await waitFor(() => expect(result.current.collections).toHaveLength(1));
    await act(async () => { await result.current.selectCollection(1); });

    expect(result.current.savedSearches).toHaveLength(1);
    expect(result.current.activeMembers.map((sample) => sample.id)).toEqual([1]);
  });

  it("reports and rethrows a failed collection mutation", async () => {
    const onError = vi.fn();
    invokeMock.mockImplementation(async (command) => {
      if (command === "list_collections" || command === "list_saved_searches") return [];
      if (command === "create_collection") throw new Error("offline");
      return undefined;
    });
    const { result } = renderHook(() => useCollections({ onError }));

    await act(async () => {
      await expect(result.current.createCollection("drum rack", "")).rejects.toThrow("offline");
    });

    expect(onError).toHaveBeenCalledWith("Could not create collection.");
  });
});
