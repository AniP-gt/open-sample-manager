import { create } from "zustand";
import { persist } from "zustand/middleware";

interface MidiFavoritesState {
  favorites: number[];
  toggleFavorite: (id: number) => void;
  isFavorite: (id: number) => boolean;
  clearFavorites: () => void;
}

export const useMidiFavoritesStore = create<MidiFavoritesState>()(
  persist(
    (set, get) => ({
      favorites: [],
      toggleFavorite: (id) =>
        set((s) => ({
          favorites: s.favorites.includes(id)
            ? s.favorites.filter((f) => f !== id)
            : [...s.favorites, id],
        })),
      isFavorite: (id) => get().favorites.includes(id),
      clearFavorites: () => set({ favorites: [] }),
    }),
    {
      name: "osm-midi-favorites",
      merge: (_persisted, current) => {
        const stored = _persisted as Partial<MidiFavoritesState> | null;
        const raw = stored?.favorites;
        return {
          ...current,
          favorites:
            Array.isArray(raw) && raw.every((v) => typeof v === "number") ? raw : [],
        };
      },
    }
  )
);
