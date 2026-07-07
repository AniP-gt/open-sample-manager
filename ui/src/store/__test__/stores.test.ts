import { beforeEach, describe, expect, it } from "vitest";
import { useFavoritesStore } from "../useFavoritesStore";
import { useMidiFavoritesStore } from "../useMidiFavoritesStore";
import { useRecentStore } from "../useRecentStore";
import { useSettingsStore } from "../useSettingsStore";

describe("persisted UI stores", () => {
  beforeEach(() => {
    localStorage.clear();
    useFavoritesStore.setState({ favorites: [] });
    useMidiFavoritesStore.setState({ favorites: [] });
    useRecentStore.setState({ recentIds: [] });
    useSettingsStore.setState({
      autoPlayOnSelect: false,
      instrumentColorCoding: false,
      directoryClickFiltering: true,
      showSampleMetadataQuality: true,
    });
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

  it("toggles MIDI favorites and clears them", () => {
    const store = useMidiFavoritesStore.getState();

    store.toggleFavorite(99);
    expect(useMidiFavoritesStore.getState().favorites).toEqual([99]);
    expect(useMidiFavoritesStore.getState().isFavorite(99)).toBe(true);

    useMidiFavoritesStore.getState().toggleFavorite(99);
    expect(useMidiFavoritesStore.getState().favorites).toEqual([]);

    useMidiFavoritesStore.getState().toggleFavorite(100);
    useMidiFavoritesStore.getState().clearFavorites();
    expect(useMidiFavoritesStore.getState().favorites).toEqual([]);
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
    useSettingsStore.getState().setDirectoryClickFiltering(false);
    useSettingsStore.getState().setShowSampleMetadataQuality(false);

    expect(useSettingsStore.getState().autoPlayOnSelect).toBe(true);
    expect(useSettingsStore.getState().instrumentColorCoding).toBe(true);
    expect(useSettingsStore.getState().directoryClickFiltering).toBe(false);
    expect(useSettingsStore.getState().showSampleMetadataQuality).toBe(false);
  });
});
