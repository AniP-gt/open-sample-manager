import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ProviderBrowserMode } from "../types/provider";
import { resolveLanguage, type Language } from "../i18n/locale";

interface SettingsState {
  readonly language: Language;
  readonly setLanguage: (value: Language) => void;
  autoPlayOnSelect: boolean;
  setAutoPlayOnSelect: (value: boolean) => void;
  instrumentColorCoding: boolean;
  setInstrumentColorCoding: (value: boolean) => void;
  directoryClickFiltering: boolean;
  setDirectoryClickFiltering: (value: boolean) => void;
  showSampleMetadataQuality: boolean;
  setShowSampleMetadataQuality: (value: boolean) => void;
  providerDownloadRoot: string | null;
  setProviderDownloadRoot: (value: string | null) => void;
  providerBrowserMode: ProviderBrowserMode;
  setProviderBrowserMode: (value: ProviderBrowserMode) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      language: resolveLanguage(undefined),
      setLanguage: (language) => set({ language }),
      autoPlayOnSelect: false,
      setAutoPlayOnSelect: (value) => set({ autoPlayOnSelect: value }),
      instrumentColorCoding: false,
      setInstrumentColorCoding: (value) => set({ instrumentColorCoding: value }),
      directoryClickFiltering: true,
      setDirectoryClickFiltering: (value) => set({ directoryClickFiltering: value }),
      showSampleMetadataQuality: true,
      setShowSampleMetadataQuality: (value) => set({ showSampleMetadataQuality: value }),
      providerDownloadRoot: null,
      setProviderDownloadRoot: (value) => set({ providerDownloadRoot: value }),
      providerBrowserMode: "window",
      setProviderBrowserMode: (value) => set({ providerBrowserMode: value }),
    }),
    {
      name: "osm_settings",
      merge: (persisted, current) => {
        const stored = typeof persisted === "object" && persisted !== null ? persisted : {};
        return {
          ...current,
          ...stored,
          language: resolveLanguage("language" in stored ? stored.language : undefined),
        };
      },
    },
  ),
);
