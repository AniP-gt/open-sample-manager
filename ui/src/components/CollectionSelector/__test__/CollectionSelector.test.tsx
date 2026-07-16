import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CollectionSelector } from "../CollectionSelector";

describe("CollectionSelector", () => {
  it("selects named collections and exposes a stable empty collection state", () => {
    // Given: a dense sidebar collection section with an empty active collection.
    const onSelect = vi.fn();
    render(
      <CollectionSelector
        collections={[{
          id: 7,
          name: "drum rack",
          description: null,
          created_at: "2026-01-01",
          updated_at: "2026-01-01",
          sample_count: 0,
        }]}
        activeCollectionId={7}
        isCollectionView={true}
        onSelectCollection={onSelect}
        onClearCollection={vi.fn()}
      />,
    );

    // When: the visible collection is activated.
    fireEvent.click(screen.getByRole("button", { name: /drum rack/i }));

    // Then: the selector preserves the empty state and reports the collection id.
    expect(screen.getByText("No samples in this collection")).toBeInTheDocument();
    expect(onSelect).toHaveBeenCalledWith(7);
    expect(screen.getByRole("button", { name: /drum rack/i })).toHaveAttribute("aria-pressed", "true");
  });

  it("exposes the accessible clear control for an active collection view", () => {
    // Given: an active collection view with a clear callback.
    const onClearCollection = vi.fn();
    render(
      <CollectionSelector
        collections={[{
          id: 7,
          name: "drum rack",
          description: null,
          created_at: "2026-01-01",
          updated_at: "2026-01-01",
          sample_count: 1,
        }]}
        activeCollectionId={7}
        isCollectionView={true}
        onSelectCollection={vi.fn()}
        onClearCollection={onClearCollection}
      />,
    );

    // When: the accessible clear control is activated.
    fireEvent.click(screen.getByRole("button", { name: "Clear collection view" }));

    // Then: the selector delegates clearing to its owner.
    expect(onClearCollection).toHaveBeenCalledOnce();
  });
});
