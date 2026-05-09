import { vi } from 'vitest';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockImplementation((cmd) => {
    if (cmd === 'get_drag_icon_path') return Promise.resolve('/tmp/icon.png');
    return Promise.resolve();
  }),
}));

vi.mock('../../../store/useFavoritesStore', () => ({
  useFavoritesStore: vi.fn(() => ({
    favorites: [],
    toggleFavorite: vi.fn(),
    isFavorite: vi.fn(),
    clearFavorites: vi.fn(),
  })),
}));

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: (options: { count?: number }) => {
    const count = options.count ?? 0;
    return {
      getVirtualItems: () =>
        Array.from({ length: count }, (_, index) => ({
          index,
          start: index * 48,
          size: 48,
        })),
      getTotalSize: () => count * 48,
      scrollToIndex: vi.fn(),
    };
  },
}));
