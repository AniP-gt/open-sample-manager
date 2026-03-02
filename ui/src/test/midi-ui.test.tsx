import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
// Mutable mock return values so tests can update behavior before rendering
let mockedMidis: any[] = []
let timidityStatus = { installed: false, install_command: 'brew install timidity' }

vi.mock('@tauri-apps/api/core', () => {
  const invoke = vi.fn((cmd: string) => {
    if (cmd === 'check_timidity') return Promise.resolve(timidityStatus)
    if (cmd === 'list_midis_paginated') return Promise.resolve(mockedMidis)
    if (cmd === 'get_midi_tags') return Promise.resolve([])
    return Promise.resolve(null)
  })
  return { invoke }
})

describe('Header view toggle', () => {
  it('renders buttons and calls onViewModeChange with "midi" when MIDI List clicked', async () => {
    const { Header } = await import('../components/Header/Header')
    const mockChange = vi.fn()
    render(
      <Header
        sampleCount={0}
        scanned={false}
        onScanClick={() => {}}
        onSettingsClick={() => {}}
        viewMode={'sample'}
        onViewModeChange={mockChange}
      />,
    )

    const midiButton = screen.getByText('MIDI List')
    expect(midiButton).toBeInTheDocument()
    fireEvent.click(midiButton)
    expect(mockChange).toHaveBeenCalledWith('midi')
  })
})

describe('MidiList component', () => {
  const rows = [
    {
      id: 1,
      path: '/foo/a.mid',
      file_name: 'a.mid',
      duration: 12,
      tempo: 120,
      time_signature_numerator: 4,
      time_signature_denominator: 4,
      track_count: 2,
      note_count: 32,
      channel_count: 1,
      key_estimate: 'C',
      file_size: 1000,
      created_at: '',
      modified_at: '',
      tag_name: '',
    },
  ]

  it('renders rows with filename, tempo and track_count', async () => {
    const { MidiList } = await import('../components/MidiList/MidiList')
    const onSelect = vi.fn()
    render(<MidiList midis={rows} selectedMidi={null} onMidiSelect={onSelect} />)

    expect(screen.getByText('a.mid')).toBeInTheDocument()
    expect(screen.getByText('120.0 BPM')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
  })

  it('shows empty-state when midis is empty', async () => {
    const { MidiList } = await import('../components/MidiList/MidiList')
    const onSelect = vi.fn()
    render(<MidiList midis={[]} selectedMidi={null} onMidiSelect={onSelect} />)
    expect(screen.getByText(/No MIDI files indexed/)).toBeInTheDocument()
  })
})

describe('TiMidity prompt in App', () => {
  beforeEach(() => {
    // reset mocked return values used by the module-level vi.mock
    mockedMidis = []
    timidityStatus = { installed: false, install_command: 'brew install timidity' }
  })

  it('shows install prompt when timidity not installed', async () => {
    // select none (midis empty) but ensure component asked check_timidity and bar prompt would render when MIDI selected
    // Instead, simulate selecting a midi by setting selectedMidi via invoking list_midis_paginated to return one and render the app
    mockedMidis = [
      {
        id: 2,
        path: '/foo/b.mid',
        file_name: 'b.mid',
        duration: 8,
        tempo: 100,
        time_signature_numerator: 3,
        time_signature_denominator: 4,
        track_count: 1,
        note_count: 10,
        channel_count: 1,
        key_estimate: 'G',
        file_size: 500,
        created_at: '',
        modified_at: '',
        tag_name: '',
      },
    ]

    const { App } = await import('../App')
    render(<App />)

    // Click MIDI List to trigger loading midis
    const midiButton2 = await screen.findByText('MIDI List')
    fireEvent.click(midiButton2)

    const midiRow = await screen.findByText('b.mid')
    expect(midiRow).toBeInTheDocument()

    fireEvent.click(midiRow)

    const prompt = await screen.findByText('TiMidity not installed')
    expect(prompt).toBeInTheDocument()
    expect(screen.getByText('Copy Install Command')).toBeInTheDocument()
  })
})
