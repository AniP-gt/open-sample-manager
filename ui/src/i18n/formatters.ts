import { i18n } from "./index";

export function formatDate(date: Date): string {
  return new Intl.DateTimeFormat(i18n.language === "ja" ? "ja-JP" : "en-US").format(date);
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat(i18n.language === "ja" ? "ja-JP" : "en-US").format(value);
}
