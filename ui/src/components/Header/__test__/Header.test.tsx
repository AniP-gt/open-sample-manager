import { describe, expect, test, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { Header } from "../Header";

function renderHeader(overrides: Partial<ComponentProps<typeof Header>> = {}) {
  const props = {
    sampleCount: 0,
    scanned: false,
    onScanClick: vi.fn(),
    onSettingsClick: vi.fn(),
    onGoBack: vi.fn(),
    onGoForward: vi.fn(),
    onBackToSources: vi.fn(),
    showProviderControls: false,
    viewMode: "sample" as const,
    onViewModeChange: vi.fn(),
    ...overrides,
  };
  render(<Header {...props} />);
  return props;
}

describe("Header", () => {
  test("renders basic info and sample count when scanned", () => {
    renderHeader({ sampleCount: 1234, scanned: true });
    expect(screen.getByText("OPEN SAMPLE MANAGER")).toBeInTheDocument();
    expect(screen.getByText("✓ 1234 SAMPLES INDEXED")).toBeInTheDocument();
  });

  test("calls onScanClick when scan button is clicked", () => {
    const { onScanClick } = renderHeader();
    fireEvent.click(screen.getByText("SCAN LIBRARY"));
    expect(onScanClick).toHaveBeenCalled();
  });

  test("does not render the provider sources action in the global header", () => {
    renderHeader();

    expect(screen.queryByRole("button", { name: "BACK TO SOURCES" })).not.toBeInTheDocument();
  });

  test("renders provider controls beside WEB tabs only when enabled", () => {
    const { onGoBack, onGoForward, onBackToSources } = renderHeader({
      viewMode: "web",
      showProviderControls: true,
    });

    fireEvent.click(screen.getByRole("button", { name: "Go back" }));
    fireEvent.click(screen.getByRole("button", { name: "Go forward" }));
    fireEvent.click(screen.getByRole("button", { name: "Back to sources" }));

    expect(onGoBack).toHaveBeenCalledOnce();
    expect(onGoForward).toHaveBeenCalledOnce();
    expect(onBackToSources).toHaveBeenCalledOnce();
  });

  test("enables flow-based wrapping when every Header control is present", () => {
    renderHeader({ sampleCount: 1234, scanned: true, onReload: vi.fn(), onReScanClick: vi.fn() });

    const header = screen.getByText("OPEN SAMPLE MANAGER").parentElement?.parentElement?.parentElement;
    const controls = screen.getByRole("button", { name: "WEB" }).parentElement?.parentElement;

    expect(header).toHaveStyle({ flexWrap: "wrap", rowGap: "10px", columnGap: "16px" });
    expect(controls).toHaveStyle({ flexWrap: "wrap", justifyContent: "flex-end" });
  });

	test("routes SAMPLE, MIDI, and WEB selections to their exact view modes", () => {
		const { onViewModeChange } = renderHeader();
		expect(screen.getByRole("button", { name: "SAMPLE" })).toBeInTheDocument();
		fireEvent.click(screen.getByRole("button", { name: "SAMPLE" }));
		fireEvent.click(screen.getByRole("button", { name: "MIDI" }));
		fireEvent.click(screen.getByRole("button", { name: "WEB" }));
		expect(onViewModeChange).toHaveBeenCalledTimes(3);
		expect(onViewModeChange).toHaveBeenNthCalledWith(1, "sample");
		expect(onViewModeChange).toHaveBeenNthCalledWith(2, "midi");
		expect(onViewModeChange).toHaveBeenNthCalledWith(3, "web");
	});

  test("shows drag over affordance", () => {
    renderHeader({ isDragOver: true });
    expect(screen.getByText("DROP TO IMPORT")).toBeInTheDocument();
    expect(screen.queryByText("SCAN LIBRARY")).not.toBeInTheDocument();
  });

  test("calls onReScanClick when re-scan button is clicked", () => {
    const onReScanClick = vi.fn();
    renderHeader({ sampleCount: 10, scanned: true, onReScanClick });
    fireEvent.click(screen.getByText("RE-SCAN"));
    expect(onReScanClick).toHaveBeenCalled();
  });

  test("calls onReload when reload button is clicked", () => {
    const onReload = vi.fn();
    renderHeader({ sampleCount: 10, scanned: true, onReload });
    fireEvent.click(screen.getByTitle("Reload file tree"));
    expect(onReload).toHaveBeenCalled();
  });

  test("calls onSettingsClick when settings button is clicked", () => {
    const onSettingsClick = vi.fn();
    renderHeader({ sampleCount: 10, scanned: true, onSettingsClick });
    fireEvent.click(screen.getByTitle("Settings"));
    expect(onSettingsClick).toHaveBeenCalled();
  });
});
