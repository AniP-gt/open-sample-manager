import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { FreesoundWorkspace } from "../FreesoundWorkspace";
import type { FreesoundWorkspace as FreesoundWorkspaceState } from "../../../hooks/useFreesoundWorkspace";

const sound = { id: 1, name: "Kick", uploader: "alice", license: "CC0", licenseUrl: "https://license", pageUrl: "https://page", previewUrl: "https://preview" };

function workspace(overrides: Partial<FreesoundWorkspaceState> = {}): FreesoundWorkspaceState {
  return {
    credential: "configured", error: null, fetchPreview: vi.fn<() => Promise<void>>().mockResolvedValue(undefined), isBusy: false, page: 1,
    activeQuery: "kick", previewUrl: null, query: "kick", results: [sound], saveApiKey: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    search: vi.fn<() => Promise<void>>().mockResolvedValue(undefined), setQuery: vi.fn(), stopPreview: vi.fn(), totalCount: 1,
    deleteApiKey: vi.fn<() => Promise<void>>().mockResolvedValue(undefined), failPreview: vi.fn(), openHomepage: vi.fn<() => Promise<void>>().mockResolvedValue(undefined), openRegistration: vi.fn<() => Promise<void>>().mockResolvedValue(undefined), ...overrides,
  };
}

describe("FreesoundWorkspace", () => {
  it("disables preview actions while busy", () => {
    render(<FreesoundWorkspace workspace={workspace({ isBusy: true })} onOpenSettings={vi.fn()} />);
    expect(screen.getByRole("button", { name: "PREVIEW" })).toBeDisabled();
  });

  it("opens API registration from the unconfigured setup state", () => {
    const openRegistration = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    render(<FreesoundWorkspace workspace={workspace({ credential: "unset", results: [], openRegistration })} onOpenSettings={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "GET API KEY" }));

    expect(openRegistration).toHaveBeenCalledTimes(1);
  });

  it("shows the browser action while searching Freesound", () => {
    render(<FreesoundWorkspace workspace={workspace()} onOpenSettings={vi.fn()} />);

    expect(screen.getByRole("button", { name: "OPEN IN BROWSER" })).toBeEnabled();
  });

  it("uses the submitted query rather than a newer draft for page two", () => {
    const search = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    render(<FreesoundWorkspace workspace={workspace({ activeQuery: "kick", page: 1, query: "snare", search, totalCount: 40 })} onOpenSettings={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "NEXT" }));

    expect(search).toHaveBeenCalledWith("kick", 2);
  });

  it("clears the preview identity when the preview URL is removed", async () => {
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
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

  it("cleans the current preview when audio playback is rejected", async () => {
    const failPreview = vi.fn();
    vi.spyOn(HTMLMediaElement.prototype, "play").mockRejectedValue(new Error("autoplay denied"));
    render(<FreesoundWorkspace workspace={workspace({ previewUrl: "blob:preview", failPreview })} onOpenSettings={vi.fn()} />);

    await waitFor(() => expect(failPreview).toHaveBeenCalledWith("blob:preview"));
  });

  it("cleans the current preview when the audio element reports an error", () => {
    const failPreview = vi.fn();
    const { container } = render(<FreesoundWorkspace workspace={workspace({ previewUrl: "blob:preview", failPreview })} onOpenSettings={vi.fn()} />);
    const audio = container.querySelector("audio");
    if (!audio) throw new Error("expected preview audio element");

    fireEvent.error(audio);

    expect(failPreview).toHaveBeenCalledWith("blob:preview");
  });
});
