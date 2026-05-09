import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { MidiTagManagementModal } from "../MidiTagManagementModal";

describe("MidiTagManagementModal", () => {
  const dummyTags = [
    { id: 1, name: "melody", created_at: "" },
    { id: 2, name: "custom-tag", created_at: "" },
  ];

  it("does not render when not open", () => {
    const { container } = render(
      <MidiTagManagementModal
        isOpen={false}
        midiTags={dummyTags}
        onAdd={vi.fn()}
        onDelete={vi.fn()}
        onUpdate={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders with list of tags", () => {
    render(
      <MidiTagManagementModal
        isOpen={true}
        midiTags={dummyTags}
        onAdd={vi.fn()}
        onDelete={vi.fn()}
        onUpdate={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText("MANAGE MIDI TAGS")).toBeInTheDocument();
    expect(screen.getByText("melody")).toBeInTheDocument();
    expect(screen.getByText("custom-tag")).toBeInTheDocument();
    expect(screen.getByText("DEFAULT")).toBeInTheDocument();
  });

  it("adds new tag on button click or enter", () => {
    const onAddMock = vi.fn();
    render(
      <MidiTagManagementModal
        isOpen={true}
        midiTags={dummyTags}
        onAdd={onAddMock}
        onDelete={vi.fn()}
        onUpdate={vi.fn()}
        onClose={vi.fn()}
      />
    );

    const input = screen.getByPlaceholderText("new tag...");
    fireEvent.change(input, { target: { value: "synth " } });
    fireEvent.click(screen.getByText("ADD"));
    
    expect(onAddMock).toHaveBeenCalledWith("synth");

    fireEvent.change(input, { target: { value: "lead" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onAddMock).toHaveBeenCalledWith("lead");
  });

  it("shows error if adding empty or duplicate", () => {
    const onAddMock = vi.fn();
    render(
      <MidiTagManagementModal
        isOpen={true}
        midiTags={dummyTags}
        onAdd={onAddMock}
        onDelete={vi.fn()}
        onUpdate={vi.fn()}
        onClose={vi.fn()}
      />
    );

    const input = screen.getByPlaceholderText("new tag...");
    const addButton = screen.getByText("ADD");

    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.click(addButton);
    expect(screen.getByText("Please enter a name")).toBeInTheDocument();

    fireEvent.change(input, { target: { value: "MELODY" } });
    fireEvent.click(addButton);
    expect(screen.getByText("This tag already exists")).toBeInTheDocument();
    expect(onAddMock).not.toHaveBeenCalled();
  });

  it("edits an existing tag", () => {
    const onUpdateMock = vi.fn();
    const { container } = render(
      <MidiTagManagementModal
        isOpen={true}
        midiTags={dummyTags}
        onAdd={vi.fn()}
        onDelete={vi.fn()}
        onUpdate={onUpdateMock}
        onClose={vi.fn()}
      />
    );

    const rows = container.querySelectorAll("div[style*='border-bottom']");
    const customRow = Array.from(rows).find(r => r.textContent?.includes("custom-tag"));
    expect(customRow).toBeDefined();
    
    const editBtn = customRow!.querySelector("button[title='Edit']");
    fireEvent.click(editBtn!);

    const editInput = screen.getByDisplayValue("custom-tag");
    fireEvent.change(editInput, { target: { value: "custom-updated" } });
    
    fireEvent.click(screen.getByText("SAVE", { selector: "button" }));
    expect(onUpdateMock).toHaveBeenCalledWith(2, "custom-updated");
  });

  it("deletes a non-default tag", () => {
    const onDeleteMock = vi.fn();
    const { container } = render(
      <MidiTagManagementModal
        isOpen={true}
        midiTags={dummyTags}
        onAdd={vi.fn()}
        onDelete={onDeleteMock}
        onUpdate={vi.fn()}
        onClose={vi.fn()}
      />
    );

    const rows = container.querySelectorAll("div[style*='border-bottom']");
    const customRow = Array.from(rows).find(r => r.textContent?.includes("custom-tag"));
    const deleteBtn = customRow!.querySelector("button[title='Delete']");
    
    fireEvent.click(deleteBtn!);
    expect(onDeleteMock).toHaveBeenCalledWith(2);
  });
});
