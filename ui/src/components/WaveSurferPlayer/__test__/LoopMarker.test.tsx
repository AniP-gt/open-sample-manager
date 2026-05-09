import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { LoopMarker } from "../LoopMarker";
import type WaveSurfer from "wavesurfer.js";

const mockGetRegions = vi.fn().mockReturnValue([]);
const mockClearRegions = vi.fn();
const mockEnableDragSelection = vi.fn().mockReturnValue(vi.fn());
const mockOn = vi.fn();
const mockDestroy = vi.fn();

const mockPluginInstance = {
  getRegions: mockGetRegions,
  clearRegions: mockClearRegions,
  enableDragSelection: mockEnableDragSelection,
  on: mockOn,
  destroy: mockDestroy,
};

vi.mock("wavesurfer.js/dist/plugins/regions", () => {
  return {
    default: {
      create: () => mockPluginInstance
    }
  };
});

describe("LoopMarker", () => {
  let mockWavesurfer: Partial<WaveSurfer>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRegions.mockReturnValue([]);
    
    mockWavesurfer = {
      registerPlugin: vi.fn(),
      on: vi.fn(),
      un: vi.fn(),
      getDuration: vi.fn().mockReturnValue(10),
      seekTo: vi.fn(),
    };
  });

  it("renders disabled state initially", () => {
    render(<LoopMarker wavesurfer={mockWavesurfer as WaveSurfer} />);
    
    const toggleBtn = screen.getByRole("button", { name: "LOOP OFF" });
    expect(toggleBtn).toBeDisabled();
    expect(screen.getByText("drag on waveform to select")).toBeInTheDocument();
  });

  it("registers regions plugin and listens to events", () => {
    render(<LoopMarker wavesurfer={mockWavesurfer as WaveSurfer} />);
    
    expect(mockWavesurfer.registerPlugin).toHaveBeenCalledWith(mockPluginInstance);
    expect(mockEnableDragSelection).toHaveBeenCalled();
    expect(mockOn).toHaveBeenCalledWith("region-created", expect.any(Function));
    expect(mockOn).toHaveBeenCalledWith("region-updated", expect.any(Function));
    expect(mockOn).toHaveBeenCalledWith("region-removed", expect.any(Function));
    expect(mockWavesurfer.on).toHaveBeenCalledWith("timeupdate", expect.any(Function));
  });

  it("updates state when region is created", () => {
    render(<LoopMarker wavesurfer={mockWavesurfer as WaveSurfer} />);
    
    const createHandler = mockOn.mock.calls.find(call => call[0] === "region-created")?.[1];
    
    const mockRegion = { id: "r1", start: 2.5, end: 5.0, remove: vi.fn() };
    
    const otherRegion = { id: "r0", remove: vi.fn() };
    mockGetRegions.mockReturnValue([otherRegion, mockRegion]);
    
    act(() => {
      createHandler(mockRegion);
    });
    
    expect(otherRegion.remove).toHaveBeenCalled();
    
    const toggleBtn = screen.getByRole("button", { name: "LOOP OFF" });
    expect(toggleBtn).not.toBeDisabled();
    expect(screen.getByText("2.5s → 5.0s")).toBeInTheDocument();
    
    act(() => {
      fireEvent.click(toggleBtn);
    });
    expect(screen.getByRole("button", { name: "LOOP ON" })).toBeInTheDocument();
  });

  it("clears region when CLEAR is clicked", () => {
    render(<LoopMarker wavesurfer={mockWavesurfer as WaveSurfer} />);
    const createHandler = mockOn.mock.calls.find(call => call[0] === "region-created")?.[1];
    
    act(() => {
      createHandler({ id: "r1", start: 2.5, end: 5.0, remove: vi.fn() });
    });
    
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "LOOP OFF" }));
    });
    
    const clearBtn = screen.getByRole("button", { name: "CLEAR" });
    act(() => {
      fireEvent.click(clearBtn);
    });
    
    expect(mockClearRegions).toHaveBeenCalled();
    expect(screen.getByText("drag on waveform to select")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "LOOP OFF" })).toBeDisabled();
  });

  it("seeks when timeupdate exceeds region end and loop is ON", () => {
    render(<LoopMarker wavesurfer={mockWavesurfer as WaveSurfer} />);
    
    const createHandler = mockOn.mock.calls.find(call => call[0] === "region-created")?.[1];
    
    act(() => {
      createHandler({ id: "r1", start: 2.5, end: 5.0, remove: vi.fn() });
    });
    
    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "LOOP OFF" }));
    });
    
    const timeupdateHandler = (mockWavesurfer.on as ReturnType<typeof vi.fn>).mock.calls.find(call => call[0] === "timeupdate")?.[1];
    
    act(() => {
      timeupdateHandler(5.1);
    });
    
    expect(mockWavesurfer.seekTo).toHaveBeenCalledWith(2.5 / 10);
  });

  it("cleans up on unmount", () => {
    const { unmount } = render(<LoopMarker wavesurfer={mockWavesurfer as WaveSurfer} />);
    unmount();
    
    expect(mockWavesurfer.un).toHaveBeenCalledWith("timeupdate", expect.any(Function));
    expect(mockDestroy).toHaveBeenCalled();
  });
});
