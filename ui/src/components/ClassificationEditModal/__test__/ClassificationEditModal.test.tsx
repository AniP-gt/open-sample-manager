import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ClassificationEditModal } from "../ClassificationEditModal";
import type { Sample } from "../../../types/sample";

describe("ClassificationEditModal", () => {
  const dummySample: Sample = {
    id: 1,
    file_name: "kick.wav",
    duration: 1,
    bpm: 120,
    periodicity: 0,
    low_ratio: 0.8,
    sample_rate: 44100,
    attack_slope: 0.9,
    decay_time: null,
    sample_type: "one-shot",
    tags: [],
    waveform_peaks: null,
    playback_type: "oneshot",
    instrument_type: "kick",
    musical_key: "C",
  };

  it("does not render when isOpen is false or sample is null", () => {
    const { container } = render(
      <ClassificationEditModal
        isOpen={false}
        sample={dummySample}
        editInstrumentType="kick"
        editSampleType="one-shot"
        instrumentTypes={["kick", "snare"]}
        onInstrumentTypeChange={vi.fn()}
        onSampleTypeChange={vi.fn()}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();

    const { container: container2 } = render(
      <ClassificationEditModal
        isOpen={true}
        sample={null}
        editInstrumentType="kick"
        editSampleType="one-shot"
        instrumentTypes={["kick", "snare"]}
        onInstrumentTypeChange={vi.fn()}
        onSampleTypeChange={vi.fn()}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(container2.firstChild).toBeNull();
  });

  it("renders correctly when open and sample provided", () => {
    render(
      <ClassificationEditModal
        isOpen={true}
        sample={dummySample}
        editInstrumentType="kick"
        editSampleType="one-shot"
        instrumentTypes={["kick", "snare"]}
        onInstrumentTypeChange={vi.fn()}
        onSampleTypeChange={vi.fn()}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText("EDIT CLASSIFICATION")).toBeInTheDocument();
    expect(screen.getByText("kick.wav")).toBeInTheDocument();
    expect(screen.getByText("KICK")).toBeInTheDocument();
    expect(screen.getByText("SNARE")).toBeInTheDocument();
  });

  it("calls onSampleTypeChange when a sample type is clicked", () => {
    const onSampleTypeChangeMock = vi.fn();
    render(
      <ClassificationEditModal
        isOpen={true}
        sample={dummySample}
        editInstrumentType="kick"
        editSampleType="one-shot"
        instrumentTypes={["kick", "snare"]}
        onInstrumentTypeChange={vi.fn()}
        onSampleTypeChange={onSampleTypeChangeMock}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />
    );

    const loopButton = screen.getByText("loop").closest("button");
    if (loopButton) fireEvent.click(loopButton);
    expect(onSampleTypeChangeMock).toHaveBeenCalledWith("loop");
  });

  it("calls onInstrumentTypeChange when an instrument type is clicked", () => {
    const onInstrumentTypeChangeMock = vi.fn();
    render(
      <ClassificationEditModal
        isOpen={true}
        sample={dummySample}
        editInstrumentType="kick"
        editSampleType="one-shot"
        instrumentTypes={["kick", "snare"]}
        onInstrumentTypeChange={onInstrumentTypeChangeMock}
        onSampleTypeChange={vi.fn()}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText("SNARE"));
    expect(onInstrumentTypeChangeMock).toHaveBeenCalledWith("snare");
  });

  it("calls onSave when save button is clicked", () => {
    const onSaveMock = vi.fn();
    render(
      <ClassificationEditModal
        isOpen={true}
        sample={dummySample}
        editInstrumentType="kick"
        editSampleType="one-shot"
        instrumentTypes={["kick", "snare"]}
        onInstrumentTypeChange={vi.fn()}
        onSampleTypeChange={vi.fn()}
        onSave={onSaveMock}
        onClose={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText("SAVE"));
    expect(onSaveMock).toHaveBeenCalledTimes(1);
  });

  it("calls onManageClick if provided", () => {
    const onManageClickMock = vi.fn();
    render(
      <ClassificationEditModal
        isOpen={true}
        sample={dummySample}
        editInstrumentType="kick"
        editSampleType="one-shot"
        instrumentTypes={["kick", "snare"]}
        onInstrumentTypeChange={vi.fn()}
        onSampleTypeChange={vi.fn()}
        onSave={vi.fn()}
        onClose={vi.fn()}
        onManageClick={onManageClickMock}
      />
    );

    fireEvent.click(screen.getByText("MANAGE"));
    expect(onManageClickMock).toHaveBeenCalledTimes(1);
  });
});
