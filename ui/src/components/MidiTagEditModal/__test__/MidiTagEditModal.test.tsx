import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MidiTagEditModal } from "../MidiTagEditModal";
import type { Midi, MidiTagRow } from "../../../types/midi";

describe("MidiTagEditModal", () => {
  const dummyMidi: Midi = {
    id: 1,
    file_name: "test.mid",
    path: "/test.mid",
    duration: 10,
    tempo: 120,
    time_signature_numerator: 4,
    time_signature_denominator: 4,
    track_count: 1,
    note_count: 8,
    channel_count: 1,
    key_estimate: "C",
    musical_role: "melody",
    polyphony: "monophonic",
    density: "medium",
    register: "mid",
    bar_count: 1,
    suggested_instrument: "piano",
    file_size: 100,
    created_at: "",
    modified_at: "",
    tag_name: "melody",
  };

  const dummyTags: MidiTagRow[] = [
    { id: 1, name: "melody", created_at: "" },
    { id: 2, name: "bass", created_at: "" },
  ];

  it("does not render when not open or no midi", () => {
    const { container } = render(
      <MidiTagEditModal
        isOpen={false}
        midi={dummyMidi}
        midiTags={dummyTags}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();

    const { container: container2 } = render(
      <MidiTagEditModal
        isOpen={true}
        midi={null}
        midiTags={dummyTags}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(container2.firstChild).toBeNull();
  });

  it("renders correctly", () => {
    render(
      <MidiTagEditModal
        isOpen={true}
        midi={dummyMidi}
        midiTags={dummyTags}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(screen.getByText("EDIT MIDI TAG")).toBeInTheDocument();
    expect(screen.getByText("test.mid")).toBeInTheDocument();
    expect(screen.getByText("melody")).toBeInTheDocument();
    expect(screen.getByText("bass")).toBeInTheDocument();
  });

  it("selects and deselects tags on click", () => {
    render(
      <MidiTagEditModal
        isOpen={true}
        midi={dummyMidi}
        midiTags={dummyTags}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />
    );

    const bassButton = screen.getByText("bass");
    fireEvent.click(bassButton);
    expect(bassButton.style.background).toBe("rgba(34, 211, 238, 0.125)");

    fireEvent.click(bassButton);
    expect(bassButton.style.background).toBe("rgb(8, 10, 15)");
  });

  it("live selection with text input", () => {
    render(
      <MidiTagEditModal
        isOpen={true}
        midi={dummyMidi}
        midiTags={dummyTags}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />
    );

    const input = screen.getByPlaceholderText("tag name...");
    fireEvent.change(input, { target: { value: "bass" } });

    const bassButton = screen.getByText("bass");
    expect(bassButton.style.background).toBe("rgba(34, 211, 238, 0.125)");

    fireEvent.keyDown(input, { key: "Enter" });
  });

  it("calls onSave with selected tag id", () => {
    const onSaveMock = vi.fn();
    render(
      <MidiTagEditModal
        isOpen={true}
        midi={dummyMidi}
        midiTags={dummyTags}
        onSave={onSaveMock}
        onClose={vi.fn()}
      />
    );

    const bassButton = screen.getByText("bass");
    fireEvent.click(bassButton);

    const saveButton = screen.getByText("SAVE", { selector: "button" });
    fireEvent.click(saveButton);

    expect(onSaveMock).toHaveBeenCalledWith(2);
  });

  it("calls onManageClick if provided", () => {
    const onManageClickMock = vi.fn();
    render(
      <MidiTagEditModal
        isOpen={true}
        midi={dummyMidi}
        midiTags={dummyTags}
        onSave={vi.fn()}
        onClose={vi.fn()}
        onManageClick={onManageClickMock}
      />
    );

    const manageBtn = screen.getByText("MANAGE");
    fireEvent.click(manageBtn);
    expect(onManageClickMock).toHaveBeenCalledTimes(1);
  });
});
