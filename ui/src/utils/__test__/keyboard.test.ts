import { describe, expect, it } from "vitest";
import { isTextInputElement } from "../keyboard";

describe("isTextInputElement", () => {
  it("detects text-like form controls", () => {
    const input = document.createElement("input");
    input.type = "search";
    const textarea = document.createElement("textarea");
    const select = document.createElement("select");

    expect(isTextInputElement(input)).toBe(true);
    expect(isTextInputElement(textarea)).toBe(true);
    expect(isTextInputElement(select)).toBe(true);
  });

  it("ignores non-text inputs and passive elements", () => {
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    const button = document.createElement("button");

    expect(isTextInputElement(checkbox)).toBe(false);
    expect(isTextInputElement(button)).toBe(false);
    expect(isTextInputElement(null)).toBe(false);
  });

  it("detects editable regions and textbox roles", () => {
    const contentEditable = document.createElement("div");
    contentEditable.setAttribute("contenteditable", "true");
    const emptyEditable = document.createElement("div");
    emptyEditable.setAttribute("contenteditable", "");
    const textbox = document.createElement("div");
    textbox.setAttribute("role", "textbox");

    expect(isTextInputElement(contentEditable)).toBe(true);
    expect(isTextInputElement(emptyEditable)).toBe(true);
    expect(isTextInputElement(textbox)).toBe(true);
  });
});
