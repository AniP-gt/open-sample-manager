import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { midi, renderPane } from "./appMainPaneTestFixtures";

describe("AppMainPane MIDI view", () => {
  test("routes midi sidebar selections and detail actions", () => {
    const { midiState } = renderPane({ viewMode: "midi", selectedMidi: midi, midiDirectoryPath: "/library", isMidiPlaying: true });
    fireEvent.click(screen.getByText("filter file"));
    expect(midiState.suppressNextMidiSearch).toHaveBeenCalledTimes(1);
    expect(midiState.setDirectoryPath).toHaveBeenCalledWith("");
    expect(midiState.loadMidiByPath).toHaveBeenCalledWith("/library/kick.wav", "");
    fireEvent.click(screen.getByText("filter dir"));
    expect(midiState.togglePlaySelectedMidi).toHaveBeenCalledTimes(1);
    expect(midiState.setSelectedMidi).toHaveBeenCalledWith(null);
    expect(midiState.setDirectoryPath).toHaveBeenCalledWith("/library/drums");
    fireEvent.click(screen.getByText("sidebar clear"));
    expect(midiState.setDirectoryPath).toHaveBeenCalledWith("");
    fireEvent.click(screen.getByText("midi detail filter"));
    expect(midiState.setMidiTagFilterId).toHaveBeenCalledWith(4);
    fireEvent.click(screen.getByText("midi detail manage"));
    expect(midiState.setMidiTagModalOpen).toHaveBeenCalledWith(true);
    fireEvent.click(screen.getByText("midi detail play"));
    expect(midiState.togglePlaySelectedMidi).toHaveBeenCalledTimes(2);
  });

  test("does not route midi sidebar directory selections when directoryClickFiltering is false", () => {
    const { midiState } = renderPane({ viewMode: "midi", isMidiPlaying: true, directoryClickFiltering: false });
    fireEvent.click(screen.getByText("filter dir"));
    expect(midiState.togglePlaySelectedMidi).not.toHaveBeenCalled();
    expect(midiState.setSelectedMidi).not.toHaveBeenCalled();
    expect(midiState.setDirectoryPath).not.toHaveBeenCalled();
  });

  test("wires midi list actions", () => {
    const { midiState, scanState } = renderPane({ viewMode: "midi" });
    fireEvent.click(screen.getByText("midi select"));
    expect(midiState.handleMidiSelect).toHaveBeenCalledWith({ id: 2 });
    fireEvent.click(screen.getByText("midi tag"));
    expect(midiState.setMidiTagEditTarget).toHaveBeenCalledWith({ id: 2 });
    expect(midiState.setMidiTagEditOpen).toHaveBeenCalledWith(true);
    fireEvent.click(screen.getByText("midi filter"));
    expect(midiState.setMidiTagFilterId).toHaveBeenCalledWith(3);
    fireEvent.click(screen.getByText("midi trash"));
    expect(midiState.requestTrashMidi).toHaveBeenCalledWith(2);
    fireEvent.click(screen.getByText("midi more"));
    expect(midiState.loadMoreMidi).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText("midi prev"));
    expect(midiState.loadPreviousMidi).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText("midi import"));
    expect(scanState.handleImportPaths).toHaveBeenCalledWith(["/drop.mid"]);
    fireEvent.click(screen.getByText("midi search"));
    expect(midiState.setMidiSearch).toHaveBeenCalledWith("piano");
    fireEvent.click(screen.getByText("midi play"));
    expect(midiState.togglePlaySelectedMidi).toHaveBeenCalledTimes(1);
  });

  test("calls midi close logic correctly when not playing", () => {
    const { midiState } = renderPane({ viewMode: "midi", selectedMidi: midi, isMidiPlaying: false });
    fireEvent.click(screen.getByText("midi detail close"));
    expect(midiState.setSelectedMidi).toHaveBeenCalledWith(null);
    expect(midiState.togglePlaySelectedMidi).not.toHaveBeenCalled();
  });

  test("calls midi close logic correctly when playing", () => {
    const { midiState } = renderPane({ viewMode: "midi", selectedMidi: midi, isMidiPlaying: true });
    fireEvent.click(screen.getByText("midi detail close"));
    expect(midiState.setSelectedMidi).toHaveBeenCalledWith(null);
    expect(midiState.togglePlaySelectedMidi).toHaveBeenCalledTimes(1);
  });
});
