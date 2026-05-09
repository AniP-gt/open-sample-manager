import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MidiList } from '../MidiList';
import { Midi } from '../../../types/midi';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockImplementation((cmd) => {
    if (cmd === 'get_drag_icon_path') return Promise.resolve('/tmp/icon.png');
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
    path: '/test2.mid',
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
  
  test('handles sorting headers', () => {
    render(
      <MidiList
        midis={mockMidis}
        selectedMidi={null}
        onMidiSelect={vi.fn()}
      />
    );
    
    fireEvent.click(screen.getByText('FILENAME'));
    fireEvent.click(screen.getByText('TAG'));
    fireEvent.click(screen.getByText('TEMPO'));
    fireEvent.click(screen.getByText('TIME SIG'));
    fireEvent.click(screen.getByText('TRACKS'));
    fireEvent.click(screen.getByText('NOTES'));
    fireEvent.click(screen.getByText('KEY'));
    fireEvent.click(screen.getByText('DURATION'));
    
    fireEvent.click(screen.getByText('FILENAME'));
    
    const buttons = screen.getAllByRole('button');
    if (buttons.length > 0) {
      fireEvent.click(buttons[0]);
    }
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
