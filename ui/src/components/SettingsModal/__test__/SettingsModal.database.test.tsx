import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderSettingsModal } from "./settingsModalTestHarness";

describe("SettingsModal database actions", () => {
  it("dispatches confirm-clear-all event when clear all is clicked", () => {
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");
    try {
      renderSettingsModal();
      fireEvent.click(screen.getByText("CLEAR ALL"));

      expect(dispatchSpy).toHaveBeenCalled();
      const eventArg = dispatchSpy.mock.calls[0]?.[0];
      expect(eventArg).toBeInstanceOf(CustomEvent);
      expect(eventArg?.type).toBe("confirm-clear-all");
    } finally {
      dispatchSpy.mockRestore();
    }
  });

  it("calls database migration handlers", () => {
    const onDatabaseExport = vi.fn();
    const onDatabaseImport = vi.fn();
    renderSettingsModal({
      onDatabaseExport,
      onDatabaseImport,
      databaseMigrationStatus: "Exported 1 samples and 0 MIDI files.",
    });

    fireEvent.click(screen.getByText("EXPORT DB"));
    fireEvent.click(screen.getByText("IMPORT DB"));

    expect(onDatabaseExport).toHaveBeenCalledTimes(1);
    expect(onDatabaseImport).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Exported 1 samples and 0 MIDI files.")).toBeInTheDocument();
  });
});
