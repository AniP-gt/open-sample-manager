import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { App } from '../App';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn().mockImplementation((cmd) => {
    console.log('INVOKE CALLED:', cmd);
    switch (cmd) {
      case 'get_drag_icon_path': return Promise.resolve('/tmp/icon.png');
      case 'list_samples_paginated': return Promise.resolve([
        {
          id: 1,
          path: '/tmp/test.wav',
          filename: 'test.wav',
          duration_secs: 1.0,
          bpm: 120,
          musical_key: 'C',
          instrument_type: 'kick',
          created_at: Date.now(),
          updated_at: Date.now()
        }
      ]);
      case 'list_all_sample_paths': return Promise.resolve([]);
      case 'get_instrument_types': return Promise.resolve([]);
      case 'get_all_midi_paths': return Promise.resolve([]);
      case 'list_midis_paginated': return Promise.resolve([]);
      case 'get_midi_tags': return Promise.resolve([]);
      case 'check_timidity': return Promise.resolve({ installed: true, install_command: '' });
      default: return Promise.resolve();
    }
  }),
}));

vi.mock('@tauri-apps/plugin-window-state', () => ({
  restoreStateCurrent: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: () => ({
    getVirtualItems: () => [],
    getTotalSize: () => 0,
    scrollToIndex: vi.fn(),
  }),
}));

describe('App Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('renders initial App layout', async () => {
    await act(async () => {
      render(<App />);
    });
    
    expect(screen.getByText(/OPEN SAMPLE MANAGER/i)).toBeInTheDocument();
    expect(screen.getByText('Sample List')).toBeInTheDocument();
    expect(screen.getByText('SCAN LIBRARY')).toBeInTheDocument();
  });

  test('opens and closes settings modal', async () => {
    await act(async () => {
      render(<App />);
    });
    
    const settingsBtn = screen.getByTitle('Settings');
    fireEvent.click(settingsBtn);
    
    expect(screen.getByText('SETTINGS')).toBeInTheDocument();
    
    const closeBtn = screen.getByText('✕');
    fireEvent.click(closeBtn);
  });
  
  test('handles scan button click', async () => {
    await act(async () => {
      render(<App />);
    });
    
    const scanBtn = screen.getByText('SCAN LIBRARY');
    fireEvent.click(scanBtn);
  });

  test('handles reload file tree button', async () => {
    await act(async () => {
      render(<App />);
    });
    
    const reloadBtn = screen.getByTitle('Reload file tree');
    fireEvent.click(reloadBtn);
  });

  test('switches to MIDI list', async () => {
    await act(async () => {
      render(<App />);
    });
    
    const midiButton = screen.getByText('MIDI List');
    fireEvent.click(midiButton);
    
    expect(screen.getByText('MIDI List')).toBeInTheDocument();
  });

  test('toggles favorites filter', async () => {
    await act(async () => {
      render(<App />);
    });
    
    const favBtn = screen.getByText(/FAVORITES/);
    fireEvent.click(favBtn);
  });

  test('handles search input', async () => {
    await act(async () => {
      render(<App />);
    });
    
    const searchInput = await screen.findByPlaceholderText('Search by filename, tag, key...');
    fireEvent.change(searchInput, { target: { value: 'kick' } });
    
    expect(searchInput).toHaveValue('kick');
  });
});
