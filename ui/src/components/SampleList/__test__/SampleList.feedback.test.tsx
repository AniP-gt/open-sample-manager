import "./mockSampleListDependencies";
import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { defaultFilters, renderSampleList } from "./sampleListTestHelpers";

describe("SampleList feedback and active filters", () => {
  it("offers scanning for an empty library without claiming pagination ended", () => {
    const onScanLibrary = vi.fn();
    renderSampleList({ samples: [], canLoadMore: false, onScanLibrary });
    expect(screen.getByRole("heading", { name: "Your sample library is empty" })).toBeInTheDocument();
    expect(screen.queryByText("No more results")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Scan a folder" }));
    expect(onScanLibrary).toHaveBeenCalledOnce();
  });

  it("shows loading before an empty-library message", () => {
    renderSampleList({ samples: [], isLoading: true });
    expect(screen.getByRole("heading", { name: "Loading samples…" })).toBeInTheDocument();
    expect(screen.queryByText("Your sample library is empty")).not.toBeInTheDocument();
  });

  it("offers retry after retrieval failure instead of suggesting the library is empty", () => {
    const onRetry = vi.fn();
    renderSampleList({ samples: [], loadError: "Database is unavailable", onRetry });
    expect(screen.getByRole("alert")).toHaveTextContent("Database is unavailable");
    expect(screen.queryByText("Your sample library is empty")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry loading samples" }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("distinguishes an empty collection from an empty library", () => {
    renderSampleList({ samples: [], isCollectionView: true, preserveOrder: true });
    expect(screen.getByRole("heading", { name: "This collection is empty" })).toBeInTheDocument();
    expect(screen.queryByText("Your sample library is empty")).not.toBeInTheDocument();
  });

  it("clears all conditions from a no-match view and submits an empty query", () => {
    const onFilterChange = vi.fn();
    const onSearchSubmit = vi.fn();
    renderSampleList({ filters: { ...defaultFilters, search: "no-such-sample", filterKey: "D#", favoritesOnly: true, hideDuplicates: true, directoryPath: "/drums" }, onFilterChange, onSearchSubmit });
    expect(screen.getByRole("heading", { name: "No matching samples" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reset search and filters" }));
    expect(onFilterChange).toHaveBeenCalledWith(expect.objectContaining({ search: "", filterKey: "", favoritesOnly: false, hideDuplicates: false, directoryPath: "" }));
    expect(onSearchSubmit).toHaveBeenCalledWith("");
  });

  it("removes only the key condition and keeps search as a draft", () => {
    const onFilterChange = vi.fn();
    const onSearchSubmit = vi.fn();
    renderSampleList({ filters: { ...defaultFilters, filterKey: "C" }, onFilterChange, onSearchSubmit });
    fireEvent.click(screen.getByRole("button", { name: "Remove Key: C" }));
    expect(onFilterChange).toHaveBeenCalledWith({ filterKey: "" });
    expect(onSearchSubmit).not.toHaveBeenCalled();
    expect(screen.getAllByLabelText("Sample key filter")).toHaveLength(1);
  });
});
