import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ResizeHandle } from "../ResizeHandle";

describe("ResizeHandle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders with separator role", () => {
    render(<ResizeHandle onWidthChange={vi.fn()} />);
    expect(screen.getByRole("separator")).toBeInTheDocument();
  });

  it("changes background on hover", () => {
    render(<ResizeHandle onWidthChange={vi.fn()} />);
    const handle = screen.getByRole("separator");
    
    fireEvent.mouseEnter(handle);
    expect(handle.style.background).toBe("rgb(55, 65, 81)");
    
    fireEvent.mouseLeave(handle);
    expect(handle.style.background).toBe("rgb(31, 41, 55)");
  });

  it("starts dragging on mousedown", () => {
    render(<ResizeHandle onWidthChange={vi.fn()} />);
    const handle = screen.getByRole("separator");
    
    fireEvent.mouseDown(handle);
    expect(handle.style.background).toBe("rgb(249, 115, 22)");
  });

  it("calls onWidthChange constrained by minWidth and maxWidth on mousemove during drag", () => {
    const onWidthChangeMock = vi.fn();
    render(<ResizeHandle onWidthChange={onWidthChangeMock} minWidth={200} maxWidth={500} />);
    const handle = screen.getByRole("separator");
    
    fireEvent.mouseDown(handle);
    
    fireEvent.mouseMove(document, { clientX: 300 });
    vi.runAllTimers();
    expect(onWidthChangeMock).toHaveBeenCalledWith(300);
    
    fireEvent.mouseMove(document, { clientX: 100 });
    vi.runAllTimers();
    expect(onWidthChangeMock).toHaveBeenCalledWith(200);
    
    fireEvent.mouseMove(document, { clientX: 600 });
    vi.runAllTimers();
    expect(onWidthChangeMock).toHaveBeenCalledWith(500);
  });

  it("stops dragging on mouseup", () => {
    const onWidthChangeMock = vi.fn();
    render(<ResizeHandle onWidthChange={onWidthChangeMock} />);
    const handle = screen.getByRole("separator");
    
    fireEvent.mouseDown(handle);
    fireEvent.mouseUp(document);
    
    fireEvent.mouseMove(document, { clientX: 300 });
    vi.runAllTimers();
    expect(onWidthChangeMock).not.toHaveBeenCalled();
  });
});
