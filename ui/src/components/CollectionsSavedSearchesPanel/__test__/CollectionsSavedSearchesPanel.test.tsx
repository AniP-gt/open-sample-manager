import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CollectionsSavedSearchesPanel } from "../CollectionsSavedSearchesPanel";

describe("CollectionsSavedSearchesPanel", () => {
  it("retains collection form values after a rejected create mutation", async () => {
    const onCreateCollection = vi.fn<() => Promise<void>>().mockRejectedValue(new Error("offline"));
    render(
      <CollectionsSavedSearchesPanel
        collections={[]}
        savedSearches={[]}
        activeCollectionId={null}
        selectedIds={new Set<number>()}
        onCreateCollection={onCreateCollection}
        onUpdateCollection={vi.fn<() => Promise<void>>().mockResolvedValue(undefined)}
        onDeleteCollection={vi.fn<() => Promise<void>>().mockResolvedValue(undefined)}
        onOpenCollection={vi.fn<() => Promise<void>>().mockResolvedValue(undefined)}
        onClearCollection={vi.fn<() => Promise<void>>().mockResolvedValue(undefined)}
        onAddSelected={vi.fn<() => Promise<void>>().mockResolvedValue(undefined)}
        onRemoveSelected={vi.fn<() => Promise<void>>().mockResolvedValue(undefined)}
        onCreateSavedSearch={vi.fn<() => Promise<void>>().mockResolvedValue(undefined)}
        onUpdateSavedSearch={vi.fn<() => Promise<void>>().mockResolvedValue(undefined)}
        onDeleteSavedSearch={vi.fn<() => Promise<void>>().mockResolvedValue(undefined)}
        onApplySavedSearch={vi.fn()}
      />,
    );

    const name = screen.getByPlaceholderText("collection name");
    const description = screen.getByPlaceholderText("description");
    fireEvent.change(name, { target: { value: "drum rack" } });
    fireEvent.change(description, { target: { value: "favorite kicks" } });
    fireEvent.click(screen.getByRole("button", { name: "NEW COLLECTION" }));

    await waitFor(() => expect(onCreateCollection).toHaveBeenCalledWith("drum rack", "favorite kicks"));
    expect(name).toHaveValue("drum rack");
    expect(description).toHaveValue("favorite kicks");
  });
});
