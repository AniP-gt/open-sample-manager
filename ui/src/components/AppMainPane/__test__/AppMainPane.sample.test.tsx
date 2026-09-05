import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { renderPane, sample } from "./appMainPaneTestFixtures";

describe("AppMainPane sample view", () => {
  test("renders no library sidebar or detail layout in WEB mode", () => {
    renderPane({ viewMode: "web" });
    expect(screen.queryByTestId("filter-sidebar")).not.toBeInTheDocument();
    expect(screen.queryByTestId("sample-list")).not.toBeInTheDocument();
    expect(screen.queryByTestId("midi-list")).not.toBeInTheDocument();
  });

  test("routes sample sidebar file and directory selections", () => {
    const { uiState, sampleState, scanState, playerBarRef, handleSampleSelectWithRecent } = renderPane({ sampleDirectoryPath: "/library" });
    fireEvent.click(screen.getByText("filter file"));
    expect(sampleState.suppressNextSearch).toHaveBeenCalledTimes(1);
    expect(sampleState.handleFilterChange).toHaveBeenCalledWith({ directoryPath: "" });
    expect(sampleState.loadSampleByPath).toHaveBeenCalledWith("/library/kick.wav");
    fireEvent.click(screen.getByText("filter dir"));
    expect(playerBarRef.current?.stop).toHaveBeenCalledTimes(1);
    expect(sampleState.setSelected).toHaveBeenCalledWith(null);
    expect(sampleState.handleFilterChange).toHaveBeenCalledWith({ directoryPath: "/library/drums" });
    fireEvent.click(screen.getByText("sidebar import"));
    expect(scanState.handleSidebarImport).toHaveBeenCalledWith(["/drop.wav"]);
    fireEvent.click(screen.getByText("sidebar sample"));
    expect(handleSampleSelectWithRecent).toHaveBeenCalledWith({ id: 1 });
    fireEvent.click(screen.getByText("sidebar clear"));
    expect(sampleState.handleFilterChange).toHaveBeenCalledWith({ directoryPath: "" });
    const resizeHandle = screen.getByTestId("filter-sidebar").nextElementSibling as HTMLElement;
    fireEvent.mouseDown(resizeHandle);
    expect(uiState.handleMouseDown).toHaveBeenCalledTimes(1);
    fireEvent.mouseEnter(resizeHandle);
    expect(resizeHandle.style.background).toBe("rgb(55, 65, 81)");
    fireEvent.mouseLeave(resizeHandle);
    expect(resizeHandle.style.background).toBe("rgb(31, 41, 55)");
  });

  test("does not route sample sidebar directory selections when directoryClickFiltering is false", () => {
    const { sampleState, playerBarRef } = renderPane({ directoryClickFiltering: false });
    fireEvent.click(screen.getByText("filter dir"));
    expect(playerBarRef.current?.stop).not.toHaveBeenCalled();
    expect(sampleState.setSelected).not.toHaveBeenCalled();
    expect(sampleState.handleFilterChange).not.toHaveBeenCalled();
  });

  test("wires sample list and detail actions", () => {
    const { sampleState, scanState, handleSampleSelectWithRecent } = renderPane({ selectedSample: sample });
    fireEvent.click(screen.getByText("sample filter"));
    expect(sampleState.handleFilterChange).toHaveBeenCalledWith({ search: "kick" });
    fireEvent.click(screen.getByText("sample sort"));
    expect(sampleState.setSort).toHaveBeenCalledWith({ field: "bpm", direction: "desc" });
    fireEvent.click(screen.getByText("sample delete"));
    expect(sampleState.handleDeleteSample).toHaveBeenCalledWith(1);
    fireEvent.click(screen.getByText("sample trash"));
    expect(sampleState.requestTrash).toHaveBeenCalledWith(1);
    fireEvent.click(screen.getByText("sample type"));
    expect(sampleState.handleTypeClick).toHaveBeenCalledWith({ id: 1 });
    fireEvent.click(screen.getByText("sample import"));
    expect(scanState.handleImportPaths).toHaveBeenCalledWith(["/drop.wav"]);
    fireEvent.click(screen.getByText("sample more"));
    expect(sampleState.loadMore).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText("sample prev"));
    expect(sampleState.loadPrevious).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText("sample play"));
    expect(sampleState.togglePlayback).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText("detail error"));
    expect(scanState.setError).toHaveBeenCalledWith("detail failed");
    fireEvent.click(screen.getByText("detail select"));
    expect(handleSampleSelectWithRecent).toHaveBeenCalledWith({ id: 1 });
  });

  test("calls sample close logic correctly", () => {
    const { sampleState, playerBarRef } = renderPane({ selectedSample: sample });
    fireEvent.click(screen.getByText("detail close"));
    expect(sampleState.setSelected).toHaveBeenCalledWith(null);
    expect(playerBarRef.current?.stop).toHaveBeenCalled();
  });
});
