import { en } from "./resources/en";
import { ja } from "./resources/ja";
import { translate, type TranslationKey, type TranslationValues } from "./index";

export type UiMessage =
  | { readonly kind: "translated"; readonly key: TranslationKey; readonly values: TranslationValues }
  | { readonly kind: "withDetails"; readonly message: UiMessage; readonly details: string }
  | { readonly kind: "detail"; readonly text: string };

function isKey(value: string): value is TranslationKey {
  return Object.prototype.hasOwnProperty.call(en, value);
}

const entries = Object.keys(en).filter(isKey).flatMap((key) => [
  { key, text: en[key] }, { key, text: ja[key] },
]);
const exactKeys = new Map(entries.map(({ key, text }) => [text, key]));

export function localizedMessage(key: TranslationKey, values: TranslationValues = {}): UiMessage {
  return { kind: "translated", key, values };
}
const templates = entries.filter(({ text }) => text.includes("{{")).map(({ key, text }) => {
  const names: string[] = [];
  const pattern = text.split(/(\{\{\w+\}\})/).map((part) => {
    if (part.startsWith("{{")) {
      names.push(part.slice(2, -2));
      return "([\\s\\S]*?)";
    }
    return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }).join("");
  return { key, names, pattern: new RegExp(`^${pattern}$`) };
});

export function messageFromText(text: string): UiMessage {
  const key = exactKeys.get(text);
  if (key !== undefined) return { kind: "translated", key, values: {} };
  for (const template of templates) {
    const match = template.pattern.exec(text);
    if (match) return {
      kind: "translated", key: template.key,
      values: Object.fromEntries(template.names.map((name, index) => {
        const value = match[index + 1] ?? "";
        return [name, name === "count" && /^\d+$/.test(value) ? Number(value) : value];
      })),
    };
  }
  for (const entry of entries) {
    if (!/^(Could not |Provider browser |Freesound )/.test(entry.text) || entry.text.includes("{{")) continue;
    const prefix = entry.text.replace(/\.$/, "");
    if (text.startsWith(`${prefix} (`) || text.startsWith(`${entry.text}: `)) return {
      kind: "withDetails",
      message: { kind: "translated", key: entry.key, values: {} },
      details: text.slice(prefix.length).replace(/^[.:\s]+/, ""),
    };
  }
  return { kind: "detail", text };
}

export function renderMessage(message: UiMessage): string {
  switch (message.kind) {
    case "translated": return translate(message.key, message.values);
    case "withDetails": return `${renderMessage(message.message)} ${message.details}`;
    case "detail": return message.text;
  }
}
