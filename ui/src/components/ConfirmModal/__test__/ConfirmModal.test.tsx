import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { ConfirmModal } from "../ConfirmModal";

describe("ConfirmModal", () => {
  it("does not render when isOpen is false", () => {
    const { container } = render(
      <ConfirmModal isOpen={false} message="Are you sure?" onConfirm={vi.fn()} onCancel={vi.fn()} />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders correctly when isOpen is true", () => {
    render(
      <ConfirmModal
        isOpen={true}
        title="Delete Item"
        message="Are you really sure?"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    
    expect(screen.getByText("Delete Item")).toBeInTheDocument();
    expect(screen.getByText("Are you really sure?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Yes" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "No" })).toBeInTheDocument();
  });

  it("calls onCancel when Cancel button is clicked", () => {
    const onCancelMock = vi.fn();
    render(
      <ConfirmModal
        isOpen={true}
        message="Are you sure?"
        onConfirm={vi.fn()}
        onCancel={onCancelMock}
      />
    );
    
    fireEvent.click(screen.getByRole("button", { name: "No" }));
    expect(onCancelMock).toHaveBeenCalledTimes(1);
  });

  it("calls onConfirm when Confirm button is clicked", async () => {
    const onConfirmMock = vi.fn().mockResolvedValue(undefined);
    render(
      <ConfirmModal
        isOpen={true}
        message="Are you sure?"
        onConfirm={onConfirmMock}
        onCancel={vi.fn()}
      />
    );
    
    fireEvent.click(screen.getByRole("button", { name: "Yes" }));
    expect(onConfirmMock).toHaveBeenCalledTimes(1);
    
    expect(await screen.findByRole("button", { name: "Working..." })).toBeInTheDocument();
  });

  it("renders custom labels", () => {
    render(
      <ConfirmModal
        isOpen={true}
        message="Are you sure?"
        confirmLabel="Absolutely"
        cancelLabel="Nevermind"
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    
    expect(screen.getByRole("button", { name: "Absolutely" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Nevermind" })).toBeInTheDocument();
  });

  it("renders with danger style", () => {
    const { getByRole } = render(
      <ConfirmModal
        isOpen={true}
        message="Are you sure?"
        danger={true}
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    );
    
    const confirmButton = getByRole("button", { name: "Yes" });
    expect(confirmButton.style.background).toBe("rgb(185, 28, 28)");
  });
});
