import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";
import type { Dispatch, RefObject, SetStateAction } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import type { PlayerBarHandle } from "../../components";
import type { Sample } from "../../types/sample";
import { useUIState } from "../useUIState";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/event", () => ({ listen: vi.fn() }));

type DragPayload = { paths?: string[] };
type ListenHandler<T> = (event: { payload: T }) => void;
type ListenMock = <T>(event: string, handler: ListenHandler<T>) => Promise<() => void>;

const invokeMock = vi.mocked(invoke);
const listenMock = vi.mocked(listen) as unknown as Mock<ListenMock>;
const listeners = new Map<string, ListenHandler<DragPayload>>();

describe("useUIState", () => {
  beforeEach(() => {
    invokeMock.mockReset();
    invokeMock.mockResolvedValue(null);
    listenMock.mockReset();
    listeners.clear();
    listenMock.mockImplementation(async (event, handler) => {
      listeners.set(event, handler as ListenHandler<DragPayload>);
      return () => undefined;
    });
  });

  it("switches to MIDI view and stops active playback", async () => {
    const playerStop = vi.fn();
    const playerBarRef = {
      current: { stop: playerStop, play: vi.fn(), toggle: vi.fn(), isPlaying: true },
    } satisfies RefObject<PlayerBarHandle | null>;
    const setMidiPlaying = vi.fn();
    const setSelected: Dispatch<SetStateAction<Sample | null>> = vi.fn();
    const setMidiSearch = vi.fn();
    const { result } = renderHook(() => useUIState({ getHandleImportPaths: () => null }));

    await act(async () => {
      await result.current.handleViewModeChange("midi", {
        isMidiPlaying: true,
        setIsMidiPlaying: setMidiPlaying,
        playerBarRef,
        setSelected,
        setMidiSearch,
      });
    });

    expect(invokeMock).toHaveBeenCalledWith("stop_midi");
    expect(setMidiPlaying).toHaveBeenCalledWith(false);
    expect(playerStop).toHaveBeenCalled();
    expect(setSelected).toHaveBeenCalledWith(null);
    expect(setMidiSearch).toHaveBeenCalledWith("");
    expect(result.current.viewMode).toBe("midi");
  });

  it("resizes within sidebar bounds", () => {
    const { result } = renderHook(() => useUIState({ getHandleImportPaths: () => null }));

    act(() => result.current.handleMouseDown());
    act(() => result.current.handleMouseMove(new MouseEvent("mousemove", { clientX: 480 })));
    expect(result.current.sidebarWidth).toBe(400);

    act(() => result.current.handleMouseMove(new MouseEvent("mousemove", { clientX: 40 })));
    expect(result.current.sidebarWidth).toBe(100);

    act(() => result.current.handleMouseUp());
    expect(result.current.isResizing).toBe(false);
  });

  it("tracks Tauri drag state and dispatches dropped paths", async () => {
    const importPaths = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    renderHook(() => useUIState({ getHandleImportPaths: () => importPaths }));
    await waitFor(() => expect(listenMock).toHaveBeenCalledTimes(4));

    act(() => listeners.get("tauri://drag-enter")?.({ payload: {} }));
    act(() => listeners.get("tauri://drag-drop")?.({ payload: { paths: ["/samples/kick.wav"] } }));

    expect(importPaths).toHaveBeenCalledWith(["/samples/kick.wav"]);
  });
});
