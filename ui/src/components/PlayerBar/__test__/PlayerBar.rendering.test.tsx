import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PlayerBar } from "../PlayerBar";
import { dummySample, editedSettings, mockPause } from "./playerBarTestFixtures";

const { mockInvoke } = vi.hoisted(() => ({ mockInvoke: vi.fn() }));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    lazy: (_loader: () => Promise<unknown>) => (_props: Record<string, unknown>) => <div data-testid="lazy-wavesurfer-player" />,
    Suspense: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

vi.mock("@tauri-apps/api/core", () => ({
  convertFileSrc: (path: string) => `asset://${path}`,
  invoke: mockInvoke,
}));

beforeEach(() => {
  mockInvoke.mockResolvedValue(new Uint8Array([1, 2, 3]));
});

describe("PlayerBar rendering", () => {
  it("renders sample information and waveform", () => {
    render(<PlayerBar sample={dummySample} path="/test/test.wav" />);

    expect(screen.getByText("test.wav")).toBeInTheDocument();
    expect(screen.getByText("10.00s")).toBeInTheDocument();
  });

  it("shows volume controls and changes volume", () => {
    render(<PlayerBar sample={dummySample} path="/test/test.wav" />);

    const slider = screen.getByRole("slider");
    expect(slider).toBeInTheDocument();

    fireEvent.change(slider, { target: { value: "0.5" } });
    expect(slider).toHaveValue("0.5");
  });

  it("toggles advanced controls", () => {
    render(<PlayerBar sample={dummySample} path="/test/test.wav" />);

    fireEvent.click(screen.getByText("▾ CONTROLS"));

    expect(screen.getByText("▴ CONTROLS")).toBeInTheDocument();
    expect(screen.getByText(/SPECTROGRAM/)).toBeInTheDocument();
  });

  it("shows processing controls and sends reset and clear actions", () => {
    const onChange = vi.fn();
    const onReset = vi.fn();
    const onClear = vi.fn();
    render(
      <PlayerBar
        sample={dummySample}
        path="/test/test.wav"
        processingSettings={editedSettings}
        onProcessingSettingsChange={onChange}
        onProcessingSettingsReset={onReset}
        onProcessingSettingsClear={onClear}
      />,
    );

    fireEvent.click(screen.getByText("▾ CONTROLS"));
    fireEvent.change(screen.getByLabelText("TRIM START"), { target: { value: "2" } });
    expect(onChange).toHaveBeenCalledWith({ ...editedSettings, trimStartSeconds: 2 });

    fireEvent.click(screen.getByText("RESET"));
    fireEvent.click(screen.getByText("CLEAR EDIT"));
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(onClear).toHaveBeenCalledTimes(1);
    expect(screen.getByText("FADES: DRAG EXPORT ONLY")).toBeInTheDocument();
  });

  it("handles close button", () => {
    const onClose = vi.fn();
    render(<PlayerBar sample={dummySample} onClose={onClose} />);

    fireEvent.click(screen.getByLabelText("Close waveform UI"));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mockPause).toHaveBeenCalled();
  });
});
