import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FilterSidebar } from '../FilterSidebar';
import { invoke } from '@tauri-apps/api/core';
import { startDrag } from '@crabnebula/tauri-plugin-drag';
import { useRecentStore } from '../../../store/useRecentStore';
import type { Sample } from '../../../types/sample';
import { KEY_FILTER_OPTIONS } from '../../../utils/keyOptions';

vi.mock('../../../store/useRecentStore');

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockImplementation((cmd) => {
    if (cmd === 'get_drag_icon_path') return Promise.resolve('/tmp/icon.png');
    if (cmd === 'prepare_drag_file') return Promise.resolve('/tmp/prepared.wav');
    if (cmd === 'delete_file') return Promise.resolve();
    return Promise.resolve();
  }),
}));

vi.mock('@crabnebula/tauri-plugin-drag', () => ({
  startDrag: vi.fn().mockResolvedValue(undefined),
}));

function mockRecentStore(recentIds: number[]) {
  vi.mocked(useRecentStore).mockReturnValue({
    recentIds,
    addRecent: vi.fn(),
    clearRecent: vi.fn(),
  });
}

function createSample(overrides: Partial<Sample> = {}): Sample {
  return {
    id: 1,
    file_name: 'kick.wav',
    duration: 1,
    bpm: null,
    periodicity: 0,
    low_ratio: 0,
    attack_slope: 0,
    decay_time: null,
    sample_type: 'one-shot',
    tags: [],
    waveform_peaks: null,
    playback_type: 'oneshot',
    instrument_type: 'kick',
    ...overrides,
  };
}

describe('FilterSidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRecentStore([]);
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

  test('uses the shared key filter values with an All label for the empty value', () => {
    render(
      <FilterSidebar
        scannedPaths={[]}
        selectedPath={null}
        onFilterChange={vi.fn()}
      />
    );

    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(Array.from(select.options).map((option) => option.value)).toEqual([...KEY_FILTER_OPTIONS]);
    expect(select.options[0].textContent).toBe('All');
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

  test('allows file paths in the tree to start the same drag-out flow as lists', async () => {
    render(
      <FilterSidebar
        scannedPaths={['/Users/test/samples']}
        filePaths={['/Users/test/samples/kick.wav']}
        selectedPath={null}
        onFilterChange={vi.fn()}
      />
    );

    fireEvent.click(screen.getByText('samples'));
    const fileNode = screen.getByText('kick.wav').closest('[draggable="true"]');
    expect(fileNode).toBeInTheDocument();

    fireEvent.mouseDown(fileNode as Element, { button: 0 });
    expect(invoke).toHaveBeenCalledWith('prepare_drag_file', { path: '/Users/test/samples/kick.wav' });

    fireEvent.dragStart(fileNode as Element);
    expect(startDrag).toHaveBeenCalledWith({ item: ['/Users/test/samples/kick.wav'], icon: '/tmp/osm_drag_icon.png' });
  });

  test('renders recent items', () => {
    const mockSample = createSample();
    mockRecentStore([mockSample.id]);

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
    const mockSample = createSample();
    mockRecentStore([mockSample.id]);
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

  test('renders clear directory button and calls onClearDirectoryPath', () => {
    const onClearDirectoryPath = vi.fn();
    render(
      <FilterSidebar
        scannedPaths={['/Users/test']}
        selectedPath={null}
        onFilterChange={vi.fn()}
        activeDirectoryPath="/Users/test"
        onClearDirectoryPath={onClearDirectoryPath}
      />
    );
    const clearBtn = screen.getByTitle('Clear directory filter');
    expect(clearBtn).toBeInTheDocument();
    fireEvent.click(clearBtn);
    expect(onClearDirectoryPath).toHaveBeenCalledTimes(1);
  });

  test('does not render clear directory button when activeDirectoryPath is null', () => {
    render(
      <FilterSidebar
        scannedPaths={['/Users/test']}
        selectedPath={null}
        onFilterChange={vi.fn()}
        activeDirectoryPath={null}
      />
    );
    expect(screen.queryByTitle('Clear directory filter')).not.toBeInTheDocument();
  });
});
