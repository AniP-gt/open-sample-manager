import { fireEvent, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { renderSettingsModal } from "./settingsModalTestHarness";

describe("SettingsModal", () => {
  it("does not render when isOpen is false", () => {
    const { container } = renderSettingsModal({ isOpen: false, sampleCount: 10, autoPlayOnSelect: true });
    expect(container.firstChild).toBeNull();
  });

  it("renders correctly when isOpen is true", () => {
    renderSettingsModal({ sampleCount: 1234, autoPlayOnSelect: true });

    expect(screen.getByText("SETTINGS")).toBeInTheDocument();
    expect(screen.getByText("1234 samples indexed")).toBeInTheDocument();
    expect(screen.getByText("EXPORT DB")).toBeInTheDocument();
    expect(screen.getByText("IMPORT DB")).toBeInTheDocument();
  });

  it("toggles autoPlayOnSelect", () => {
    const onChangeMock = vi.fn();
    renderSettingsModal({ onAutoPlayChange: onChangeMock });

    const toggle = screen.getByRole("switch", { name: "Auto-play on select" });
    fireEvent.click(toggle);
    expect(onChangeMock).toHaveBeenCalledWith(true);
  });

  it("selects the embedded provider display mode", () => {
    const onProviderBrowserModeChange = vi.fn();
    renderSettingsModal({ providerBrowserMode: "window", onProviderBrowserModeChange });

    fireEvent.click(screen.getByRole("radio", { name: "EMBEDDED" }));
    expect(onProviderBrowserModeChange).toHaveBeenCalledWith("embedded");
  });

  it("calls onClose when close button is clicked", () => {
    const onCloseMock = vi.fn();
    renderSettingsModal({ onClose: onCloseMock });

    const closeButton = screen.getByText("✕");
    expect(closeButton).toHaveAccessibleName("Close settings");
    fireEvent.click(closeButton);
    expect(onCloseMock).toHaveBeenCalledTimes(1);
  });

  it("names the dialog and closes it with Escape", () => {
    const onCloseMock = vi.fn();
    renderSettingsModal({ onClose: onCloseMock });

    const dialog = screen.getByRole("dialog", { name: "SETTINGS" });
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(onCloseMock).toHaveBeenCalledTimes(1);
  });

  it("offers Freesound key configuration without displaying a saved key", () => {
    renderSettingsModal({ freesoundWorkspace: {
      credential: "configured", error: null, fetchPreview: vi.fn(), isBusy: false, page: 1, previewUrl: null, query: "", results: [], saveApiKey: vi.fn(), search: vi.fn(), setQuery: vi.fn(), stopPreview: vi.fn(), totalCount: 0, deleteApiKey: vi.fn(), openHomepage: vi.fn(),
    } });

    expect(screen.getByLabelText("Freesound API key")).toHaveAttribute("type", "password");
    expect(screen.getByRole("button", { name: "REPLACE KEY" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "REMOVE KEY" })).toBeInTheDocument();
    expect(screen.getByText("A key is configured. Its value is never shown.")).toBeInTheDocument();
  });

});
