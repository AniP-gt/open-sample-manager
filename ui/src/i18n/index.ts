import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import { useSettingsStore } from "../store/useSettingsStore";
import { en } from "./resources/en";
import { ja } from "./resources/ja";

export type TranslationKey = keyof typeof en;
export type TranslationValues = Readonly<Record<string, string | number>>;

export const i18n = i18next.createInstance();
void i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, ja: { translation: ja } },
  lng: useSettingsStore.getState().language,
  supportedLngs: ["en", "ja"],
  fallbackLng: "en",
  initAsync: false,
  interpolation: { escapeValue: false },
  react: { useSuspense: false },
});

function syncLanguage(language: "en" | "ja") {
  document.documentElement.lang = language;
  void i18n.changeLanguage(language);
}

syncLanguage(useSettingsStore.getState().language);
useSettingsStore.subscribe((state, previous) => {
  if (state.language !== previous.language) syncLanguage(state.language);
});

export function translate(key: TranslationKey, values: TranslationValues = {}): string {
  return i18n.t(key, { ...values, defaultValue: en[key] });
}

function isTranslationKey(key: string): key is TranslationKey {
  return Object.prototype.hasOwnProperty.call(en, key);
}

const textKeys = new Map<string, TranslationKey>(Object.keys(en).filter(isTranslationKey).map((key) => [en[key], key]));

export function translateLabel(label: string): string {
  const key = textKeys.get(label);
  return key === undefined ? label : translate(key);
}

export function instrumentName(instrument: string): string {
  switch (instrument) {
    case "kick": case "snare": case "hihat": case "bass": case "synth":
    case "fx": case "vocal": case "percussion": case "other":
      return translate(instrument);
    default: return instrument;
  }
}
