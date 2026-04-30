import { create } from "zustand";
import { persist } from "zustand/middleware";

interface RecentState {
  recentIds: number[];
  addRecent: (id: number) => void;
  clearRecent: () => void;
}

export const useRecentStore = create<RecentState>()(
  persist(
    (set) => ({
      recentIds: [],
      addRecent: (id) =>
        set((state) => {
          const filtered = state.recentIds.filter((x) => x !== id);
          return { recentIds: [id, ...filtered].slice(0, 10) };
        }),
      clearRecent: () => set({ recentIds: [] }),
    }),
    { name: "osm-recent" },
  ),
);
