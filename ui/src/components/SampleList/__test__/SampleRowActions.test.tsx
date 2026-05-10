import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, test, vi } from "vitest";
import { SampleRowActions } from "../SampleRowActions";

function renderActions(overrides: Partial<Parameters<typeof SampleRowActions>[0]> = {}) {
  const props: Parameters<typeof SampleRowActions>[0] = {
    samplePath: "/library/kick.wav",
    onOpenFolder: vi.fn(),
    onCopyPath: vi.fn(),
    onTrashSample: vi.fn(),
    toast: { message: "", visible: false },
    ...overrides,
  };

  render(<SampleRowActions {...props} />);
  return props;
}

describe("SampleRowActions", () => {
  test("calls row action handlers", () => {
    const props = renderActions();

    fireEvent.click(screen.getByTitle("Show in Finder"));
    expect(props.onOpenFolder).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTitle("Copy Full Path"));
    expect(props.onCopyPath).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTitle("Send to Trash"));
    expect(props.onTrashSample).toHaveBeenCalledTimes(1);
  });

  test("does not open a folder without a sample path", () => {
    const props = renderActions({ samplePath: undefined });

    fireEvent.click(screen.getByTitle("Show in Finder"));
    expect(props.onOpenFolder).not.toHaveBeenCalled();
  });

  test("renders toast", () => {
    renderActions({ toast: { message: "Path copied!", visible: true } });

    expect(screen.getByText("Path copied!")).toBeInTheDocument();
  });

  test("applies hover styles to icon buttons", () => {
    renderActions();

    for (const title of ["Show in Finder", "Copy Full Path", "Send to Trash"]) {
      const button = screen.getByTitle(title);

      fireEvent.mouseEnter(button);
      expect(button.style.transform).toBe("scale(1.15)");

      fireEvent.mouseLeave(button);
      expect(button.style.transform).toBe("scale(1)");
    }
  });

  test("stops mouse down propagation from action controls", () => {
    renderActions();

    for (const title of ["Show in Finder", "Copy Full Path", "Send to Trash"]) {
      fireEvent.mouseDown(screen.getByTitle(title));
    }

    const actions = screen.getByTitle("Show in Finder").parentElement;
    if (!actions) throw new Error("actions container not found");
    fireEvent.mouseDown(actions);

    expect(actions).toBeInTheDocument();
  });
});
