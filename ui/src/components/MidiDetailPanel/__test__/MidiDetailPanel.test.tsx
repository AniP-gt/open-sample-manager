import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MidiDetailPanel } from '../MidiDetailPanel';
import { Midi, MidiTagRow } from '../../../types/midi';

const mockMidi: Midi = {
  id: 1,
  file_name: 'test.mid',
  path: '/test.mid',
  duration: 10,
  tempo: 120,
  time_signature_numerator: 4,
  time_signature_denominator: 4,
  track_count: 1,
  note_count: 100,
  channel_count: 1,
  key_estimate: 'C',
  musical_role: 'melody',
  polyphony: 'monophonic',
  density: 'medium',
  register: 'mid',
  bar_count: 1,
  suggested_instrument: 'piano',
  file_size: 1024,
  created_at: '2023-01-01',
  modified_at: '2023-01-01',
  tag_name: ''
};

const mockTags: MidiTagRow[] = [
  { id: 1, name: 'drums', created_at: '2023-01-01' },
  { id: 2, name: 'bass', created_at: '2023-01-01' },
];

describe('MidiDetailPanel', () => {
  test('calls onTagFilterChange when tag is clicked', () => {
    const onTagFilterChange = vi.fn();
    render(
      <MidiDetailPanel
        midi={mockMidi}
        midiTags={mockTags}
        tagFilterId={null}
        onTagFilterChange={onTagFilterChange}
      />
    );
    fireEvent.click(screen.getByText('DRUMS'));
    expect(onTagFilterChange).toHaveBeenCalledWith(1);
  });

  test('clears tag filter when active tag is clicked', () => {
    const onTagFilterChange = vi.fn();
    render(
      <MidiDetailPanel
        midi={mockMidi}
        midiTags={mockTags}
        tagFilterId={1}
        onTagFilterChange={onTagFilterChange}
      />
    );
    fireEvent.click(screen.getByText('DRUMS'));
    expect(onTagFilterChange).toHaveBeenCalledWith(null);
  });

  test('calls onManageTags when Manage is clicked', () => {
    const onManageTags = vi.fn();
    render(
      <MidiDetailPanel
        midi={mockMidi}
        midiTags={mockTags}
        tagFilterId={null}
        onTagFilterChange={vi.fn()}
        onManageTags={onManageTags}
      />
    );
    fireEvent.click(screen.getByText('Manage'));
    expect(onManageTags).toHaveBeenCalled();
  });

  test('renders playback button and handles toggle', () => {
    const onTogglePlay = vi.fn();
    render(
      <MidiDetailPanel
        midi={mockMidi}
        midiTags={mockTags}
        tagFilterId={null}
        onTagFilterChange={vi.fn()}
        isPlaying={false}
        onTogglePlay={onTogglePlay}
      />
    );
    
    const playBtn = screen.getByRole('button', { name: 'Play MIDI' });
    expect(playBtn).toHaveTextContent('Play');
    
    fireEvent.click(playBtn);
    expect(onTogglePlay).toHaveBeenCalled();
  });

  test('shows Stop when playing', () => {
    render(
      <MidiDetailPanel
        midi={mockMidi}
        midiTags={mockTags}
        tagFilterId={null}
        onTagFilterChange={vi.fn()}
        isPlaying={true}
        onTogglePlay={vi.fn()}
      />
    );
    
    const stopBtn = screen.getByRole('button', { name: 'Stop MIDI playback' });
    expect(stopBtn).toHaveTextContent('Stop');
  });

  test('shows TiMidity prompt and copies command when not installed', async () => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn(),
      },
    });

    render(
      <MidiDetailPanel
        midi={mockMidi}
        midiTags={mockTags}
        tagFilterId={null}
        onTagFilterChange={vi.fn()}
        onTogglePlay={vi.fn()}
        timidityStatus={{ installed: false, install_command: 'brew install timidity' }}
      />
    );
    
    expect(screen.getByText('TiMidity not installed')).toBeInTheDocument();
    
    const copyBtn = screen.getByText('Copy Install Command');
    fireEvent.click(copyBtn);
    
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('brew install timidity');
  });

  test('calls onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(
      <MidiDetailPanel
        midi={mockMidi}
        midiTags={mockTags}
        tagFilterId={null}
        onTagFilterChange={vi.fn()}
        onClose={onClose}
      />
    );
    const closeBtn = screen.getByLabelText('Close detail panel');
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalled();
  });
});
