import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ScannerOverlay } from "../ScannerOverlay";

describe("ScannerOverlay", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders with initializing state when progress is null", () => {
    render(<ScannerOverlay progress={null} onDone={vi.fn()} />);
    expect(screen.getByText("Initializing scanner...")).toBeInTheDocument();
    expect(screen.getByText("SCANNING LIBRARY")).toBeInTheDocument();
  });

  it("renders discovering stage", () => {
    render(
      <ScannerOverlay
        progress={{
          stage: "discovering",
          current: 10,
          total: 100,
          currentFile: "/some/path/file.wav",
        }}
        onDone={vi.fn()}
      />
    );
    expect(screen.getByText("DISCOVERING FILES")).toBeInTheDocument();
    expect(screen.getByText("/some/path/file.wav")).toBeInTheDocument();
    expect(screen.getByText("10 / 100 files")).toBeInTheDocument();
    expect(screen.getByText("10%")).toBeInTheDocument();
  });

  it("renders analyzing stage", () => {
    render(
      <ScannerOverlay
        progress={{
          stage: "analyzing",
          current: 50,
          total: 100,
          currentFile: "/some/path/file2.wav",
        }}
        onDone={vi.fn()}
      />
    );
    expect(screen.getByText("ANALYZING SAMPLES")).toBeInTheDocument();
    expect(screen.getByText("50%")).toBeInTheDocument();
  });

  it("triggers onDone after a delay when stage is complete", () => {
    const onDoneMock = vi.fn();
    render(
      <ScannerOverlay
        progress={{
          stage: "complete",
          current: 100,
          total: 100,
          currentFile: "Done",
        }}
        onDone={onDoneMock}
      />
    );
    
    expect(onDoneMock).not.toHaveBeenCalled();
    
    vi.advanceTimersByTime(500);
    
    expect(onDoneMock).toHaveBeenCalledTimes(1);
  });
});
