import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { EmbeddingResultsModal } from "../EmbeddingResultsModal";

describe("EmbeddingResultsModal", () => {
  const dummyResults = [
    {
      similarity: 0.85,
      row: {
        id: 1,
        path: "/test/file1.wav",
        file_name: "file1.wav",
        duration: 1.2,
        bpm: 120,
        periodicity: 0.5,
        low_ratio: 0.2,
        attack_slope: 0.1,
        decay_time: 0.3,
        sample_type: "one-shot",
        waveform_peaks: "[0.1, 0.2]",
        playback_type: "loop",
        instrument_type: "kick",
        content_hash: null,
        duplicate_count: null,
      },
    },
    {
      similarity: 0.95,
      row: {
        id: 2,
        path: "/test/file2.wav",
        file_name: "file2.wav",
        duration: 0.8,
        bpm: null,
        periodicity: 0.8,
        low_ratio: 0.4,
        attack_slope: 0.2,
        decay_time: 0.5,
        sample_type: "loop",
        waveform_peaks: null,
        playback_type: "oneshot",
        instrument_type: "snare",
        content_hash: null,
        duplicate_count: null,
      },
    },
  ];

  it("does not render when not open", () => {
    const { container } = render(
      <EmbeddingResultsModal isOpen={false} results={dummyResults} onClose={vi.fn()} onSelect={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders correctly and sorts results descending", () => {
    render(
      <EmbeddingResultsModal isOpen={true} results={dummyResults} onClose={vi.fn()} onSelect={vi.fn()} />
    );
    expect(screen.getByText("Similar samples")).toBeInTheDocument();
    
    const items = screen.getAllByText(/^file[12]\.wav$/);
    expect(items[0]).toHaveTextContent("file2.wav");
    expect(items[1]).toHaveTextContent("file1.wav");

    expect(screen.getByText("95.0%")).toBeInTheDocument();
    expect(screen.getByText("85.0%")).toBeInTheDocument();
  });

  it("shows empty state when no results", () => {
    render(
      <EmbeddingResultsModal isOpen={true} results={[]} onClose={vi.fn()} onSelect={vi.fn()} />
    );
    expect(screen.getByText("No similar samples found.")).toBeInTheDocument();
  });

  it("calls onClose when close button clicked", () => {
    const onCloseMock = vi.fn();
    render(
      <EmbeddingResultsModal isOpen={true} results={[]} onClose={onCloseMock} onSelect={vi.fn()} />
    );
    fireEvent.click(screen.getByText("✕"));
    expect(onCloseMock).toHaveBeenCalledTimes(1);
  });

  it("calls onSelect when an item is clicked", () => {
    const onSelectMock = vi.fn();
    render(
      <EmbeddingResultsModal isOpen={true} results={dummyResults} onClose={vi.fn()} onSelect={onSelectMock} />
    );

    fireEvent.click(screen.getByText("file1.wav"));
    
    expect(onSelectMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 1,
        file_name: "file1.wav",
        waveform_peaks: [0.1, 0.2],
      }),
      "/test/file1.wav"
    );
  });
});
