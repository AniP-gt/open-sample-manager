import { beforeEach, describe, expect, it } from "vitest";
import { useFavoritesStore } from "../useFavoritesStore";
import { useRecentStore } from "../useRecentStore";
import { useSettingsStore } from "../useSettingsStore";

describe("persisted UI stores", () => {
  beforeEach(() => {
    localStorage.clear();
    useFavoritesStore.setState({ favorites: [] });
    useRecentStore.setState({ recentIds: [] });
    useSettingsStore.setState({ autoPlayOnSelect: false, instrumentColorCoding: false });
  });

  it("toggles favorites and clears them", () => {
    const store = useFavoritesStore.getState();

    store.toggleFavorite(7);
    expect(useFavoritesStore.getState().favorites).toEqual([7]);
    expect(useFavoritesStore.getState().isFavorite(7)).toBe(true);

    useFavoritesStore.getState().toggleFavorite(7);
    expect(useFavoritesStore.getState().favorites).toEqual([]);

    useFavoritesStore.getState().toggleFavorite(8);
    useFavoritesStore.getState().clearFavorites();
    expect(useFavoritesStore.getState().favorites).toEqual([]);
  });

  it("keeps recent IDs unique and capped at ten", () => {
    for (let id = 1; id <= 12; id += 1) {
      useRecentStore.getState().addRecent(id);
    }
    useRecentStore.getState().addRecent(8);

    expect(useRecentStore.getState().recentIds).toEqual([8, 12, 11, 10, 9, 7, 6, 5, 4, 3]);

    useRecentStore.getState().clearRecent();
    expect(useRecentStore.getState().recentIds).toEqual([]);
  });

  it("updates playback and color coding settings", () => {
    useSettingsStore.getState().setAutoPlayOnSelect(true);
    useSettingsStore.getState().setInstrumentColorCoding(true);

    expect(useSettingsStore.getState().autoPlayOnSelect).toBe(true);
    expect(useSettingsStore.getState().instrumentColorCoding).toBe(true);
  });
});
