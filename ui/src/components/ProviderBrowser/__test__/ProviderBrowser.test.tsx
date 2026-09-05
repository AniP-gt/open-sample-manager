import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProviderBrowser } from "../ProviderBrowser";

describe("ProviderBrowser", () => {
  it("lists the supported sources in window mode", () => {
    render(<ProviderBrowser activeProvider={null} mode="window" onBrowse={vi.fn()} status={null} viewportRef={vi.fn()} />);

    expect(screen.getByText("MUSICRADAR")).toBeInTheDocument();
    expect(screen.getByText("FIFTYSOUNDS")).toBeInTheDocument();
  });

  it("keeps embedded provider context without covered history controls", () => {
    render(<ProviderBrowser activeProvider="music_radar" mode="embedded" onBrowse={vi.fn()} status="OPENING" viewportRef={vi.fn()} />);

    expect(screen.getByText("MUSICRADAR / SampleRadar")).toBeInTheDocument();
    expect(screen.getByText("OPENING")).toBeInTheDocument();
    expect(screen.getByTestId("provider-browser-viewport")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "BACK TO SOURCES" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Go back" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Go forward" })).not.toBeInTheDocument();
  });
});
