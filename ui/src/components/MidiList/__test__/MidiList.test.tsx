import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MidiList } from '../MidiList';
import { Midi } from '../../../types/midi';
import { useMidiFavoritesStore } from '../../../store/useMidiFavoritesStore';

vi.mock('../../../store/useMidiFavoritesStore');

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockImplementation((cmd) => {
    if (cmd === 'get_drag_icon_path') return Promise.resolve('/tmp/icon.png');
    if (cmd === 'copy_to_clipboard') return Promise.resolve();
    if (cmd === 'open_folder') return Promise.resolve();
    return Promise.resolve();
  }),
}));

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: () => ({
    getVirtualItems: () => [
      { index: 0, start: 0, size: 48 },
      { index: 1, start: 48, size: 48 },
    ],
    getTotalSize: () => 96,
    scrollToIndex: vi.fn(),
  }),
}));

const mockMidis: Midi[] = [
  {
    id: 1,
    file_name: 'test-midi.mid',
    path: '/test.mid',
    tempo: 120,
    time_signature_numerator: 4,
    time_signature_denominator: 4,
    track_count: 2,
    note_count: 100,
    channel_count: 2,
    file_size: 1024,
    created_at: '2023-01-01T00:00:00Z',
    modified_at: '2023-01-01T00:00:00Z',
    key_estimate: 'C major',
    duration: 12.5,
    tag_name: 'drums',
  },
  {
    id: 2,
    file_name: 'test-midi-2.mid',
    path: '/path/to/test2.mid',
    tempo: 130,
    time_signature_numerator: 3,
    time_signature_denominator: 4,
    track_count: 1,
    note_count: 50,
    channel_count: 1,
    file_size: 512,
    created_at: '2023-01-02T00:00:00Z',
    modified_at: '2023-01-02T00:00:00Z',
    key_estimate: 'A minor',
    duration: 6.0,
    tag_name: 'bass',
  },
];

describe('MidiList', () => {
  beforeEach(() => {
    vi.mocked(useMidiFavoritesStore).mockReturnValue({
      favorites: [],
      toggleFavorite: vi.fn(),
      isFavorite: vi.fn(() => false),
      clearFavorites: vi.fn(),
    });
  });

  test('handles keyboard navigation', () => {
    vi.useFakeTimers();
    const handleSelect = vi.fn();
    const handleTogglePlay = vi.fn();

    const { unmount } = render(
      <MidiList
        midis={mockMidis}
        selectedMidi={mockMidis[0]}
        onMidiSelect={handleSelect}
        onTogglePlayback={handleTogglePlay}
        onTrashMidi={vi.fn()}
      />
    );

    fireEvent.keyDown(document.body, { key: 'ArrowDown' });
    vi.advanceTimersByTime(100);
    expect(handleSelect).toHaveBeenCalledWith(mockMidis[1]);

    fireEvent.keyDown(document.body, { key: 'End' });
    vi.advanceTimersByTime(100);
    expect(handleSelect).toHaveBeenCalledWith(mockMidis[1]);

    unmount();

    render(
      <MidiList
        midis={mockMidis}
        selectedMidi={mockMidis[1]}
        onMidiSelect={handleSelect}
        onTogglePlayback={handleTogglePlay}
        onTrashMidi={vi.fn()}
      />
    );

    fireEvent.keyDown(document.body, { key: 'ArrowUp' });
    vi.advanceTimersByTime(100);
    expect(handleSelect).toHaveBeenCalledWith(mockMidis[0]);

    fireEvent.keyDown(document.body, { key: 'Home' });
    vi.advanceTimersByTime(100);
    expect(handleSelect).toHaveBeenCalledWith(mockMidis[0]);

    fireEvent.keyDown(document.body, { key: ' ' });
    expect(handleTogglePlay).toHaveBeenCalled();

    vi.useRealTimers();
  });

  test('handles search input', () => {
    const handleSearchChange = vi.fn();
    render(
      <MidiList
        midis={mockMidis}
        selectedMidi={null}
        onMidiSelect={vi.fn()}
        onTogglePlayback={vi.fn()}
        onTrashMidi={vi.fn()}
        midiSearch=""
        onMidiSearchChange={handleSearchChange}
      />
    );

    const searchInput = screen.getByPlaceholderText('Search by filename...');
    fireEvent.change(searchInput, { target: { value: 'drum' } });

    expect(handleSearchChange).toHaveBeenCalledWith('drum');
  });

  test('renders empty state when no midis', () => {
    render(
      <MidiList
        midis={[]}
        selectedMidi={null}
        onMidiSelect={vi.fn()}
      />
    );
    expect(screen.getByText(/No MIDI files indexed/i)).toBeInTheDocument();
  });

  test('renders empty state when search has no results', () => {
    render(
      <MidiList
        midis={[]}
        selectedMidi={null}
        onMidiSelect={vi.fn()}
        midiSearch="notfound"
        onMidiSearchChange={vi.fn()}
      />
    );
    expect(screen.getByText("No results for 'notfound'")).toBeInTheDocument();
  });

  test('renders midi row and columns', () => {
    render(
      <MidiList
        midis={mockMidis}
        selectedMidi={null}
        onMidiSelect={vi.fn()}
      />
    );

    expect(screen.getByText('test-midi.mid')).toBeInTheDocument();
    expect(screen.getByText('120.0 BPM')).toBeInTheDocument();
    expect(screen.getByText('4/4')).toBeInTheDocument();
  });

  test('filters search text by case-insensitive filename substring', () => {
    render(
      <MidiList
        midis={[
          { ...mockMidis[0], id: 10, file_name: 'DrumFill.mid' },
          { ...mockMidis[1], id: 11, file_name: 'flute.mid' },
        ]}
        selectedMidi={null}
        onMidiSelect={vi.fn()}
        midiSearch="FILL"
      />
    );

    expect(screen.queryByText('DrumFill.mid')).toBeInTheDocument();
    expect(screen.queryByText('flute.mid')).not.toBeInTheDocument();
  });

  test('does not fuzzy-match non-contiguous MIDI filename letters', () => {
    render(
      <MidiList
        midis={[{ ...mockMidis[0], id: 10, file_name: 'DrumFill.mid' }]}
        selectedMidi={null}
        onMidiSelect={vi.fn()}
        midiSearch="fll"
      />
    );

    expect(screen.queryByText('DrumFill.mid')).not.toBeInTheDocument();
  });

  test('calls onMidiSearchChange when search input changes', () => {
    const onMidiSearchChange = vi.fn();
    render(
      <MidiList
        midis={mockMidis}
        selectedMidi={null}
        onMidiSelect={vi.fn()}
        midiSearch=""
        onMidiSearchChange={onMidiSearchChange}
      />
    );

    fireEvent.change(screen.getByPlaceholderText('Search by filename...'), { target: { value: 'drums' } });
    expect(onMidiSearchChange).toHaveBeenCalledWith('drums');
  });

  test('filters MIDI rows by tempo, key, and tag controls', () => {
    const onTempoMinChange = vi.fn();
    const onTempoMaxChange = vi.fn();
    const onFilterKeyChange = vi.fn();
    const onTagFilterChange = vi.fn();

    render(
      <MidiList
        midis={mockMidis}
        selectedMidi={null}
        onMidiSelect={vi.fn()}
        tempoMin="125"
        tempoMax="135"
        filterKey="A"
        onTempoMinChange={onTempoMinChange}
        onTempoMaxChange={onTempoMaxChange}
        onFilterKeyChange={onFilterKeyChange}
        midiTags={[{ id: 1, name: 'bass', created_at: '2023-01-01T00:00:00Z' }]}
        tagFilterId={1}
        onTagFilterChange={onTagFilterChange}
      />
    );

    expect(screen.queryByText('test-midi.mid')).not.toBeInTheDocument();
    expect(screen.queryByText('test-midi-2.mid')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('MIDI BPM minimum'), { target: { value: '110' } });
    fireEvent.change(screen.getByLabelText('MIDI BPM maximum'), { target: { value: '140' } });
    fireEvent.change(screen.getByLabelText('MIDI key filter'), { target: { value: 'C' } });
    fireEvent.change(screen.getByLabelText('MIDI tag filter'), { target: { value: '' } });

    expect(onTempoMinChange).toHaveBeenCalledWith('110');
    expect(onTempoMaxChange).toHaveBeenCalledWith('140');
    expect(onFilterKeyChange).toHaveBeenCalledWith('C');
    expect(onTagFilterChange).toHaveBeenCalledWith(null);
  });

  test('calls onMidiSelect when row is clicked', () => {
    const onMidiSelect = vi.fn();
    render(
      <MidiList
        midis={mockMidis}
        selectedMidi={null}
        onMidiSelect={onMidiSelect}
      />
    );

    fireEvent.click(screen.getByText('test-midi.mid'));
    expect(onMidiSelect).toHaveBeenCalledWith(mockMidis[0]);
  });

  test('handles load more and load previous', () => {
    const onLoadMore = vi.fn();
    const onLoadPrevious = vi.fn();

    const { rerender } = render(
      <MidiList
        midis={mockMidis}
        selectedMidi={null}
        onMidiSelect={vi.fn()}
        onLoadMore={onLoadMore}
        canLoadMore={true}
        isLoadingMore={false}
        onLoadPrevious={onLoadPrevious}
        canLoadPrevious={true}
        isLoadingPrevious={false}
      />
    );

    rerender(
      <MidiList
        midis={mockMidis}
        selectedMidi={null}
        onMidiSelect={vi.fn()}
        canLoadMore={false}
      />
    );

    expect(screen.getByText('No more results')).toBeInTheDocument();
  });

  test('uses a constrained scroll container for pagination sentinels', () => {
    render(
      <MidiList
        midis={mockMidis}
        selectedMidi={null}
        onMidiSelect={vi.fn()}
        onLoadMore={vi.fn()}
      />
    );

    const root = screen.getByTestId('midi-list-root');
    expect(root).toHaveStyle({ display: 'flex', flexDirection: 'column', overflow: 'hidden' });
    const scrollContainer = root.querySelector('div[aria-hidden="true"]')?.parentElement;
    expect(scrollContainer).toHaveStyle({ flex: '1', overflowY: 'auto', minHeight: '0' });
  });

  test('handles sorting headers and row order', () => {
    const { container } = render(
      <MidiList
        midis={mockMidis}
        selectedMidi={null}
        onMidiSelect={vi.fn()}
      />
    );

    const rowsBefore = container.querySelectorAll('.midi-row');
    expect(rowsBefore[0]).toHaveTextContent('test-midi.mid');
    expect(rowsBefore[1]).toHaveTextContent('test-midi-2.mid');

    fireEvent.click(screen.getByText(/DURATION/));
    const rowsAfter = container.querySelectorAll('.midi-row');
    expect(rowsAfter[0]).toHaveTextContent('test-midi-2.mid');
    expect(rowsAfter[1]).toHaveTextContent('test-midi.mid');

    fireEvent.click(screen.getByText(/DURATION/));
    const rowsDesc = container.querySelectorAll('.midi-row');
    expect(rowsDesc[0]).toHaveTextContent('test-midi.mid');
    expect(rowsDesc[1]).toHaveTextContent('test-midi-2.mid');

    fireEvent.click(screen.getByText(/FILENAME/));
    const rowsName = container.querySelectorAll('.midi-row');
    expect(rowsName[0]).toHaveTextContent('test-midi-2.mid');
    expect(rowsName[1]).toHaveTextContent('test-midi.mid');
  });

  test('handles trash button click', () => {
    const onTrashMidi = vi.fn();
    render(
      <MidiList
        midis={mockMidis}
        selectedMidi={null}
        onMidiSelect={vi.fn()}
        onTrashMidi={onTrashMidi}
      />
    );

    const trashBtns = screen.getAllByTitle('Send to Trash');
    fireEvent.click(trashBtns[0]);
    expect(onTrashMidi).toHaveBeenCalledWith(1);
  });

  test('handles tag badge callback', () => {
    const onTagClick = vi.fn();
    render(
      <MidiList
        midis={mockMidis}
        selectedMidi={null}
        onMidiSelect={vi.fn()}
        onTagBadgeClick={onTagClick}
      />
    );
    const tagBadge = screen.getByText('drums');
    fireEvent.click(tagBadge);
    expect(onTagClick).toHaveBeenCalledWith(mockMidis[0]);
  });

  test('handles drop import overlay', () => {
    render(
      <MidiList
        midis={mockMidis}
        selectedMidi={null}
        onMidiSelect={vi.fn()}
      />
    );
    const container = screen.getByTestId('midi-list-root');
    fireEvent.dragEnter(container, { dataTransfer: { types: ['Files'] } });
    expect(screen.getByText(/Drop files or folders to import/i)).toBeInTheDocument();
  });


  test('handles drag drop', () => {
    render(
      <MidiList
        midis={mockMidis}
        selectedMidi={null}
        onMidiSelect={vi.fn()}
      />
    );
    const root = screen.getByTestId('midi-list-root');
    fireEvent.drop(root, { dataTransfer: { files: [{ path: '/test.mid' }] } });
    expect(screen.queryByText(/Drop files or folders to import/i)).not.toBeInTheDocument();
  });

  test('loading states', () => {
    render(
      <MidiList
        midis={mockMidis}
        selectedMidi={null}
        onMidiSelect={vi.fn()}
        isLoadingPrevious={true}
        isLoadingMore={true}
      />
    );
    expect(screen.getAllByText('Loading...').length).toBeGreaterThan(0);
  });

  test('handles open folder and copy path buttons', async () => {
    vi.useFakeTimers();
    const invokeMock = (await import('@tauri-apps/api/core')).invoke as unknown as ReturnType<typeof vi.fn>;
    invokeMock.mockClear();

    render(
      <MidiList
        midis={mockMidis}
        selectedMidi={null}
        onMidiSelect={vi.fn()}
      />
    );

    const openBtns = screen.getAllByTitle('Show in Finder');
    fireEvent.click(openBtns[0]);
    expect(invokeMock).toHaveBeenCalledWith('open_folder', { path: '/test.mid' });

    fireEvent.click(openBtns[1]);
    expect(invokeMock).toHaveBeenCalledWith('open_folder', { path: '/path/to' });

    const copyBtns = screen.getAllByTitle('Copy Full Path');
    fireEvent.click(copyBtns[0]);
    expect(invokeMock).toHaveBeenCalledWith('copy_to_clipboard', { text: '/test.mid' });

    await vi.runAllTimersAsync();

    invokeMock.mockRejectedValueOnce(new Error('Failed to copy'));
    fireEvent.click(copyBtns[0]);
    await vi.runAllTimersAsync();

    vi.useRealTimers();
  });

  test('handles trash stop propagation', () => {
    const onTrashMidi = vi.fn();
    const onMidiSelect = vi.fn();
    render(
      <MidiList
        midis={mockMidis}
        selectedMidi={null}
        onMidiSelect={onMidiSelect}
        onTrashMidi={onTrashMidi}
      />
    );

    const trashBtns = screen.getAllByTitle('Send to Trash');
    fireEvent.click(trashBtns[0]);
    expect(onTrashMidi).toHaveBeenCalledWith(1);
    expect(onMidiSelect).not.toHaveBeenCalled();
  });

  test('handles tag badge callback with no tag', () => {
    const midisWithNoTag = [{ ...mockMidis[0], tag_name: null as unknown as string }];
    const onTagClick = vi.fn();
    render(
      <MidiList
        midis={midisWithNoTag}
        selectedMidi={null}
        onMidiSelect={vi.fn()}
        onTagBadgeClick={onTagClick}
      />
    );
    const tagBadge = screen.getByText('+ tag');
    fireEvent.click(tagBadge);
    expect(onTagClick).toHaveBeenCalledWith(midisWithNoTag[0]);
  });

  test('handles key filtering', () => {
    render(
      <MidiList
        midis={mockMidis}
        selectedMidi={null}
        onMidiSelect={vi.fn()}
        filterKey="A"
      />
    );

    expect(screen.getByText('test-midi-2.mid')).toBeInTheDocument();
  });

  test('renders favorite star and toggles it', () => {
    const toggleFavorite = vi.fn();
    vi.mocked(useMidiFavoritesStore).mockReturnValue({
      favorites: [1],
      toggleFavorite,
      isFavorite: vi.fn((id: number) => id === 1),
      clearFavorites: vi.fn(),
    });

    const { container } = render(
      <MidiList
        midis={mockMidis}
        selectedMidi={null}
        onMidiSelect={vi.fn()}
      />
    );

    const stars = screen.getAllByText('★');
    const emptyStars = screen.getAllByText('☆');
    
    expect(stars.length).toBe(1);
    expect(emptyStars.length).toBe(2);
    expect(stars[0]).toBeVisible();
    expect(emptyStars[1]).toBeVisible();

    const rows = container.querySelectorAll('.midi-row');
    expect(rows[0].textContent).toMatch(/^★1test-midi\.mid/);
    expect(rows[1].textContent).toMatch(/^☆2test-midi-2\.mid/);

    fireEvent.click(emptyStars[1]);
    expect(toggleFavorite).toHaveBeenCalledWith(2);
  });
});
