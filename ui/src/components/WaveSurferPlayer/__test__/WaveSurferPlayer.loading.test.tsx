import { act, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  flushAudioLoad,
  mockConvertFileSrc,
  mockCreate,
  renderWaveSurferPlayer,
  waveSurfer,
} from "./waveSurferPlayerTestHarness";

describe("WaveSurferPlayer audio loading", () => {
  it("renders container and loads a main-provided preview URL", async () => {
    renderWaveSurferPlayer({ blobUrl: "blob:http://localhost/preview" });

    expect(mockCreate).toHaveBeenCalled();
    expect(screen.getByText("Loading...")).toBeInTheDocument();
    expect(mockConvertFileSrc).not.toHaveBeenCalled();

    await act(flushAudioLoad);

    expect(waveSurfer().load).toHaveBeenCalledWith("blob:http://localhost/preview");
  });

  it("uses provided blobUrl and bypasses convertFileSrc", async () => {
    renderWaveSurferPlayer({ blobUrl: "blob:http://localhost/abc" });

    await act(flushAudioLoad);

    expect(mockConvertFileSrc).not.toHaveBeenCalled();
    expect(waveSurfer().load).toHaveBeenCalledWith("blob:http://localhost/abc");
  });
});
