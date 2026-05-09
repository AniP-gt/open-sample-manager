import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SpectrogramView } from "../SpectrogramView";
import type WaveSurfer from "wavesurfer.js";

const mockPluginDestroy = vi.fn();
const mockPluginCreate = vi.fn().mockReturnValue({ destroy: mockPluginDestroy });

vi.mock("wavesurfer.js/dist/plugins/spectrogram", () => {
  return {
    default: {
      create: (...args: unknown[]) => mockPluginCreate(...args)
    }
  };
});

describe("SpectrogramView", () => {
  let mockWavesurfer: Partial<WaveSurfer>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockWavesurfer = {
      registerPlugin: vi.fn(),
    };
  });

  it("renders the toggle button and shows OFF when not enabled", () => {
    const onToggle = vi.fn();
    render(
      <SpectrogramView
        wavesurfer={mockWavesurfer as WaveSurfer}
        enabled={false}
        onToggle={onToggle}
      />
    );

    const button = screen.getByRole("button", { name: "SPECTROGRAM OFF" });
    expect(button).toBeInTheDocument();
    
    fireEvent.click(button);
    expect(onToggle).toHaveBeenCalledTimes(1);
    
    expect(mockPluginCreate).not.toHaveBeenCalled();
    expect(mockWavesurfer.registerPlugin).not.toHaveBeenCalled();
  });

  it("creates plugin and registers it when enabled", () => {
    const onToggle = vi.fn();
    const { unmount } = render(
      <SpectrogramView
        wavesurfer={mockWavesurfer as WaveSurfer}
        enabled={true}
        onToggle={onToggle}
      />
    );

    expect(screen.getByRole("button", { name: "SPECTROGRAM ON" })).toBeInTheDocument();
    
    expect(mockPluginCreate).toHaveBeenCalledTimes(1);
    expect(mockWavesurfer.registerPlugin).toHaveBeenCalledTimes(1);
    
    unmount();
    expect(mockPluginDestroy).toHaveBeenCalledTimes(1);
  });

  it("handles plugin registration errors gracefully", () => {
    const onToggle = vi.fn();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    
    mockWavesurfer.registerPlugin = vi.fn().mockImplementation(() => {
      throw new Error("Registration failed");
    });

    render(
      <SpectrogramView
        wavesurfer={mockWavesurfer as WaveSurfer}
        enabled={true}
        onToggle={onToggle}
      />
    );

    expect(errorSpy).toHaveBeenCalledWith("Spectrogram registration failed:", expect.any(Error));
    errorSpy.mockRestore();
  });
});
