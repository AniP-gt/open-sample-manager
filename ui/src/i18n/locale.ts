export type Language = "en" | "ja";

export function resolveLanguage(value: unknown): Language {
  return value === "ja" ? "ja" : "en";
}
