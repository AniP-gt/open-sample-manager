import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderSettingsModal } from "./settingsModalTestHarness";

describe("Settings category navigation", () => {
  it("shows one category at a time and returns to playback", () => {
    renderSettingsModal();
    expect(screen.getByRole("switch", { name: "Auto-play on select" })).toBeInTheDocument();
    expect(screen.queryByRole("switch", { name: "Instrument color coding" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Display" }));
    expect(screen.queryByRole("switch", { name: "Auto-play on select" })).not.toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Directory click filtering" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Display" })).toHaveAttribute("aria-current", "page");
    fireEvent.click(screen.getByRole("button", { name: "Playback" }));
    expect(screen.getByRole("switch", { name: "Auto-play on select" })).toBeInTheDocument();
  });

  it("traps focus among the current category controls and closes with Escape", () => {
    const onClose = vi.fn();
    renderSettingsModal({ onClose });
    fireEvent.click(screen.getByRole("button", { name: "Database" }));
    const dialog = screen.getByRole("dialog");
    const close = screen.getByRole("button", { name: "Close settings" });
    const last = screen.getByRole("button", { name: "IMPORT DB" });
    last.focus();
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(close).toHaveFocus();
    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(last).toHaveFocus();
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(onClose).toHaveBeenCalledOnce();
  });
});
