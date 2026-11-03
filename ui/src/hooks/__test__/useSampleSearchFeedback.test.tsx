import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import type { TauriSampleRow } from "../../types/tauri";
import { useSampleSearchPagination } from "../sampleState/useSampleSearchPagination";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
const invokeMock = vi.mocked(invoke);
const renderSearch = () => {
  const params = { pageLimit: 100, setError: vi.fn(), setSelected: vi.fn(), setRetryAction: vi.fn(), onInvokeError: vi.fn() };
  return renderHook(() => useSampleSearchPagination(params));
};

beforeEach(() => { invokeMock.mockReset(); invokeMock.mockResolvedValue([]); });

describe("Sample search feedback", () => {
  it("keeps the loading state until the initial request settles", async () => {
    const pending: { resolve?: (rows: TauriSampleRow[]) => void } = {};
    invokeMock.mockImplementation((command) => command === "list_samples_paginated"
      ? new Promise<TauriSampleRow[]>((resolve) => { pending.resolve = resolve; }) : Promise.resolve([]));
    const { result } = renderSearch();
    expect(result.current.isSearching).toBe(true);
    await act(async () => { pending.resolve?.([]); });
    expect(result.current.isSearching).toBe(false);
    expect(result.current.searchError).toBeNull();
  });

  it("clears the retrieval error when a retry succeeds", async () => {
    invokeMock.mockImplementation(async (command) => {
      if (command === "list_samples_paginated") throw new Error("Database unavailable");
      return [];
    });
    const { result } = renderSearch();
    await waitFor(() => expect(result.current.searchError).toBe("Database unavailable"));
    expect(result.current.isSearching).toBe(false);
    invokeMock.mockResolvedValue([]);
    await act(async () => { await result.current.handleSearch(""); });
    expect(result.current.searchError).toBeNull();
    expect(result.current.isSearching).toBe(false);
  });

  it("does not replace newer feedback with an older failed request", async () => {
    const { result } = renderSearch();
    await waitFor(() => expect(result.current.isSearching).toBe(false));
    const pending: { reject?: (error: Error) => void } = {};
    invokeMock.mockImplementation((command, payload) => command === "list_samples_paginated" && payload && "query" in payload && payload.query === "old"
      ? new Promise<TauriSampleRow[]>((_, reject) => { pending.reject = reject; }) : Promise.resolve([]));
    let olderSearch: Promise<void> | undefined;
    act(() => { olderSearch = result.current.handleSearch("old"); });
    expect(result.current.isSearching).toBe(true);
    await act(async () => { await result.current.handleSearch("new"); });
    await act(async () => { pending.reject?.(new Error("Old request failed")); await olderSearch; });
    expect(result.current.isSearching).toBe(false);
    expect(result.current.searchError).toBeNull();
  });
});
