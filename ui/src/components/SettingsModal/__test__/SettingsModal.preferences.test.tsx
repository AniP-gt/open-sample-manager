import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderSettingsModal } from "./settingsModalTestHarness";

describe("SettingsModal preferences", () => {
  it("toggles instrumentColorCoding", () => {
    const onInstrumentColorCodingChange = vi.fn();
    renderSettingsModal({ instrumentColorCoding: true, onInstrumentColorCodingChange });

    fireEvent.click(screen.getByRole("switch", { name: "Instrument color coding" }));
    expect(onInstrumentColorCodingChange).toHaveBeenCalledWith(false);
  });

  it("toggles directoryClickFiltering", () => {
    const onDirectoryClickFilteringChange = vi.fn();
    renderSettingsModal({ onDirectoryClickFilteringChange });

    fireEvent.click(screen.getByRole("switch", { name: "Directory click filtering" }));
    expect(onDirectoryClickFilteringChange).toHaveBeenCalledWith(false);
  });

  it("toggles sample metadata and quality UI", () => {
    const onShowSampleMetadataQualityChange = vi.fn();
    renderSettingsModal({ onShowSampleMetadataQualityChange });

    fireEvent.click(screen.getByRole("switch", { name: "Sample metadata and quality UI" }));
    expect(onShowSampleMetadataQualityChange).toHaveBeenCalledWith(false);
  });
});
