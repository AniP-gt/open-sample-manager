import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { SettingsModal } from "../SettingsModal";

describe("SettingsModal", () => {
  it("does not render when isOpen is false", () => {
    const { container } = render(
      <SettingsModal
        isOpen={false}
        onClose={vi.fn()}
        sampleCount={10}
        autoPlayOnSelect={true}
        onAutoPlayChange={vi.fn()}
        instrumentColorCoding={false}
        onInstrumentColorCodingChange={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders correctly when isOpen is true", () => {
    render(
      <SettingsModal
        isOpen={true}
        onClose={vi.fn()}
        sampleCount={1234}
        autoPlayOnSelect={true}
        onAutoPlayChange={vi.fn()}
        instrumentColorCoding={false}
        onInstrumentColorCodingChange={vi.fn()}
      />
    );

    expect(screen.getByText("SETTINGS")).toBeInTheDocument();
    expect(screen.getByText("1234 samples indexed")).toBeInTheDocument();
  });

  it("toggles autoPlayOnSelect", () => {
    const onChangeMock = vi.fn();
    render(
      <SettingsModal
        isOpen={true}
        onClose={vi.fn()}
        sampleCount={0}
        autoPlayOnSelect={false}
        onAutoPlayChange={onChangeMock}
        instrumentColorCoding={false}
        onInstrumentColorCodingChange={vi.fn()}
      />
    );

    const toggle = screen.getByRole("switch", { name: "Auto-play on select" });
    fireEvent.click(toggle);
    expect(onChangeMock).toHaveBeenCalledWith(true);
  });

  it("toggles instrumentColorCoding", () => {
    const onChangeMock = vi.fn();
    render(
      <SettingsModal
        isOpen={true}
        onClose={vi.fn()}
        sampleCount={0}
        autoPlayOnSelect={false}
        onAutoPlayChange={vi.fn()}
        instrumentColorCoding={true}
        onInstrumentColorCodingChange={onChangeMock}
      />
    );

    const toggle = screen.getByRole("switch", { name: "Instrument color coding" });
    fireEvent.click(toggle);
    expect(onChangeMock).toHaveBeenCalledWith(false);
  });

  it("calls onClose when close button is clicked", () => {
    const onCloseMock = vi.fn();
    render(
      <SettingsModal
        isOpen={true}
        onClose={onCloseMock}
        sampleCount={0}
        autoPlayOnSelect={false}
        onAutoPlayChange={vi.fn()}
        instrumentColorCoding={false}
        onInstrumentColorCodingChange={vi.fn()}
      />
    );

    const closeButton = screen.getByText("✕");
    fireEvent.click(closeButton);
    expect(onCloseMock).toHaveBeenCalledTimes(1);
  });

  it("dispatches confirm-clear-all event when clear all is clicked", () => {
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");
    render(
      <SettingsModal
        isOpen={true}
        onClose={vi.fn()}
        sampleCount={0}
        autoPlayOnSelect={false}
        onAutoPlayChange={vi.fn()}
        instrumentColorCoding={false}
        onInstrumentColorCodingChange={vi.fn()}
      />
    );

    const clearAllButton = screen.getByText("CLEAR ALL");
    fireEvent.click(clearAllButton);

    expect(dispatchSpy).toHaveBeenCalled();
    const eventArg = dispatchSpy.mock.calls[0][0] as CustomEvent;
    expect(eventArg.type).toBe("confirm-clear-all");
    
    dispatchSpy.mockRestore();
  });
});
