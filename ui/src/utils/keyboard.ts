const TEXT_INPUT_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);
const TEXT_INPUT_TYPES = new Set([
  "text",
  "search",
  "email",
  "url",
  "tel",
  "password",
  "number",
  "date",
  "time",
  "datetime-local",
  "month",
  "week",
  "color",
]);

export function isTextInputElement(element?: Element | null): boolean {
  if (!element) return false;

  const tag = element.tagName?.toUpperCase() ?? "";
  if (tag === "INPUT" && element instanceof HTMLInputElement) {
    return TEXT_INPUT_TYPES.has(element.type.toLowerCase());
  }
  if (TEXT_INPUT_TAGS.has(tag)) {
    return true;
  }
  if (element instanceof HTMLElement && element.isContentEditable) return true;
  if (typeof element.getAttribute === "function") {
    const editable = element.getAttribute("contenteditable");
    if (editable === "true" || editable === "") {
      return true;
    }
  }
  if (element.matches?.("[role=\"textbox\"]")) {
    return true;
  }
  return false;
}
