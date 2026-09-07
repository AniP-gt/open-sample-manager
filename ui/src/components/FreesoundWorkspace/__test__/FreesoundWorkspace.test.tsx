import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { FreesoundWorkspace } from "../FreesoundWorkspace";
import type { FreesoundWorkspace as FreesoundWorkspaceState } from "../../../hooks/useFreesoundWorkspace";

const sound = { id: 1, name: "Kick", uploader: "alice", license: "CC0", licenseUrl: "https://license", pageUrl: "https://page", previewUrl: "https://preview" };

function workspace(overrides: Partial<FreesoundWorkspaceState> = {}): FreesoundWorkspaceState {
  return {
    credential: "configured", error: null, fetchPreview: vi.fn<() => Promise<void>>().mockResolvedValue(undefined), isBusy: false, page: 1,
    previewUrl: null, query: "kick", results: [sound], saveApiKey: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    search: vi.fn<() => Promise<void>>().mockResolvedValue(undefined), setQuery: vi.fn(), stopPreview: vi.fn(), totalCount: 1,
    deleteApiKey: vi.fn<() => Promise<void>>().mockResolvedValue(undefined), openHomepage: vi.fn<() => Promise<void>>().mockResolvedValue(undefined), ...overrides,
  };
}

describe("FreesoundWorkspace", () => {
  it("disables preview actions while busy", () => {
    render(<FreesoundWorkspace workspace={workspace({ isBusy: true })} onOpenSettings={vi.fn()} />);
    expect(screen.getByRole("button", { name: "PREVIEW" })).toBeDisabled();
  });

  it("shows the browser action while setting up Freesound", () => {
    render(<FreesoundWorkspace workspace={workspace({ credential: "unset", results: [] })} onOpenSettings={vi.fn()} />);

    expect(screen.getByRole("button", { name: "OPEN IN BROWSER" })).toBeEnabled();
  });

  it("shows the browser action while searching Freesound", () => {
    render(<FreesoundWorkspace workspace={workspace()} onOpenSettings={vi.fn()} />);

    expect(screen.getByRole("button", { name: "OPEN IN BROWSER" })).toBeEnabled();
  });

  it("clears the preview identity when the preview URL is removed", async () => {
    function ControlledWorkspace() {
      const [previewUrl, setPreviewUrl] = useState<string | null>(null);
      const currentWorkspace = workspace({
        previewUrl,
        fetchPreview: async () => { setPreviewUrl("blob:preview"); },
        stopPreview: () => { setPreviewUrl(null); },
      });
      return <FreesoundWorkspace workspace={currentWorkspace} onOpenSettings={vi.fn()} />;
    }

    render(<ControlledWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: "PREVIEW" }));
    expect(await screen.findByRole("button", { name: "STOP" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "STOP" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "PREVIEW" })).toBeInTheDocument());
  });
});
