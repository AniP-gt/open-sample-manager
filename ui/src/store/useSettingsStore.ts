import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SettingsState {
  autoPlayOnSelect: boolean;
  setAutoPlayOnSelect: (value: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      autoPlayOnSelect: false,
      setAutoPlayOnSelect: (value) => set({ autoPlayOnSelect: value }),
    }),
    {
      name: "osm_settings",
    },
  ),
);
