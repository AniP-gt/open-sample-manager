import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FilterSidebar } from '../FilterSidebar';
import { useFavoritesStore } from '../../../store/useFavoritesStore';
import { useRecentStore } from '../../../store/useRecentStore';

vi.mock('../../../store/useFavoritesStore');
vi.mock('../../../store/useRecentStore');

describe('FilterSidebar', () => {
  beforeEach(() => {
    vi.mocked(useFavoritesStore).mockReturnValue({ favorites: [] } as any);
    vi.mocked(useRecentStore).mockReturnValue({ recentIds: [] } as any);
  });

  test('renders empty state when no scanned folders', () => {
    render(
      <FilterSidebar
        scannedPaths={[]}
        selectedPath={null}
        onFilterChange={vi.fn()}
      />
    );
    expect(screen.getByText('No folders scanned')).toBeInTheDocument();
  });

  test('calls onFilterChange when favorites toggle is clicked', () => {
    const onFilterChange = vi.fn();
    render(
      <FilterSidebar
        scannedPaths={[]}
        selectedPath={null}
        onFilterChange={onFilterChange}
        favoritesOnly={false}
      />
    );
    fireEvent.click(screen.getByText(/FAVORITES/));
    expect(onFilterChange).toHaveBeenCalledWith({ favoritesOnly: true });
  });

  test('calls onFilterChange when key filter changes', () => {
    const onFilterChange = vi.fn();
    render(
      <FilterSidebar
        scannedPaths={[]}
        selectedPath={null}
        onFilterChange={onFilterChange}
      />
    );
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'C' } });
    expect(onFilterChange).toHaveBeenCalledWith({ filterKey: 'C' });
  });

  test('renders file tree for scanned paths', () => {
    render(
      <FilterSidebar
        scannedPaths={['/Users/test/samples/drums']}
        selectedPath={null}
        onFilterChange={vi.fn()}
      />
    );
    expect(screen.getByText('Users')).toBeInTheDocument();
    expect(screen.getByText('test')).toBeInTheDocument();
  });

  test('renders recent items', () => {
    vi.mocked(useRecentStore).mockReturnValue({ recentIds: [1] } as any);
    const mockSample = { id: 1, file_name: 'kick.wav', path: '/kick.wav' } as any;

    render(
      <FilterSidebar
        scannedPaths={[]}
        selectedPath={null}
        onFilterChange={vi.fn()}
        samples={[mockSample]}
      />
    );
    expect(screen.getByText('RECENT')).toBeInTheDocument();
    expect(screen.getByText('♪ kick.wav')).toBeInTheDocument();
  });

  test('calls onSampleSelect when recent item is clicked', () => {
    vi.mocked(useRecentStore).mockReturnValue({ recentIds: [1] } as any);
    const mockSample = { id: 1, file_name: 'kick.wav', path: '/kick.wav' } as any;
    const onSampleSelect = vi.fn();

    render(
      <FilterSidebar
        scannedPaths={[]}
        selectedPath={null}
        onFilterChange={vi.fn()}
        samples={[mockSample]}
        onSampleSelect={onSampleSelect}
      />
    );
    fireEvent.click(screen.getByText('♪ kick.wav'));
    expect(onSampleSelect).toHaveBeenCalledWith(mockSample);
  });

  test('calls onPathSelect when a tree node is clicked', () => {
    const onPathSelect = vi.fn();
    render(
      <FilterSidebar
        scannedPaths={['/Users/test']}
        selectedPath={null}
        onFilterChange={vi.fn()}
        onPathSelect={onPathSelect}
      />
    );
    fireEvent.click(screen.getByText('test'));
    expect(onPathSelect).toHaveBeenCalledWith('/Users/test');
  });
});
