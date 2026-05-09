import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { InstrumentTypeManagementModal } from "../InstrumentTypeManagementModal";

describe("InstrumentTypeManagementModal", () => {
  const dummyTypes = [
    { id: 1, name: "kick", created_at: "" },
    { id: 2, name: "custom", created_at: "" },
  ];

  it("does not render when not open", () => {
    const { container } = render(
      <InstrumentTypeManagementModal
        isOpen={false}
        instrumentTypes={dummyTypes}
        onAdd={vi.fn()}
        onDelete={vi.fn()}
        onUpdate={vi.fn()}
        onClose={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders with list of types", () => {
    render(
      <InstrumentTypeManagementModal
        isOpen={true}
        instrumentTypes={dummyTypes}
        onAdd={vi.fn()}
        onDelete={vi.fn()}
        onUpdate={vi.fn()}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText("MANAGE INSTRUMENT TYPES")).toBeInTheDocument();
    expect(screen.getByText("kick")).toBeInTheDocument();
    expect(screen.getByText("custom")).toBeInTheDocument();
    expect(screen.getByText("DEFAULT")).toBeInTheDocument();
  });

  it("adds new type on button click or enter", () => {
    const onAddMock = vi.fn();
    render(
      <InstrumentTypeManagementModal
        isOpen={true}
        instrumentTypes={dummyTypes}
        onAdd={onAddMock}
        onDelete={vi.fn()}
        onUpdate={vi.fn()}
        onClose={vi.fn()}
      />
    );

    const input = screen.getByPlaceholderText("new instrument type...");
    fireEvent.change(input, { target: { value: "snare " } });
    fireEvent.click(screen.getByText("ADD"));
    
    expect(onAddMock).toHaveBeenCalledWith("snare");

    fireEvent.change(input, { target: { value: "hihat" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onAddMock).toHaveBeenCalledWith("hihat");
  });

  it("shows error if adding empty or duplicate", () => {
    const onAddMock = vi.fn();
    render(
      <InstrumentTypeManagementModal
        isOpen={true}
        instrumentTypes={dummyTypes}
        onAdd={onAddMock}
        onDelete={vi.fn()}
        onUpdate={vi.fn()}
        onClose={vi.fn()}
      />
    );

    const input = screen.getByPlaceholderText("new instrument type...");
    const addButton = screen.getByText("ADD");

    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.click(addButton);
    expect(screen.getByText("Please enter a name")).toBeInTheDocument();

    fireEvent.change(input, { target: { value: "KICK" } });
    fireEvent.click(addButton);
    expect(screen.getByText("This instrument type already exists")).toBeInTheDocument();
    expect(onAddMock).not.toHaveBeenCalled();
  });

  it("edits an existing type", () => {
    const onUpdateMock = vi.fn();
    const { container } = render(
      <InstrumentTypeManagementModal
        isOpen={true}
        instrumentTypes={dummyTypes}
        onAdd={vi.fn()}
        onDelete={vi.fn()}
        onUpdate={onUpdateMock}
        onClose={vi.fn()}
      />
    );

    const rows = container.querySelectorAll("div[style*='border-bottom']");
    const customRow = Array.from(rows).find(r => r.textContent?.includes("custom"));
    expect(customRow).toBeDefined();
    
    const editBtn = customRow!.querySelector("button[title='Edit']");
    fireEvent.click(editBtn!);

    const editInput = screen.getByDisplayValue("custom");
    fireEvent.change(editInput, { target: { value: "custom-updated" } });
    
    fireEvent.click(screen.getByText("SAVE", { selector: "button" }));
    expect(onUpdateMock).toHaveBeenCalledWith(2, "custom-updated");
  });

  it("deletes a non-default type", () => {
    const onDeleteMock = vi.fn();
    const { container } = render(
      <InstrumentTypeManagementModal
        isOpen={true}
        instrumentTypes={dummyTypes}
        onAdd={vi.fn()}
        onDelete={onDeleteMock}
        onUpdate={vi.fn()}
        onClose={vi.fn()}
      />
    );

    const rows = container.querySelectorAll("div[style*='border-bottom']");
    const customRow = Array.from(rows).find(r => r.textContent?.includes("custom"));
    const deleteBtn = customRow!.querySelector("button[title='Delete']");
    
    fireEvent.click(deleteBtn!);
    expect(onDeleteMock).toHaveBeenCalledWith(2);
  });
});
