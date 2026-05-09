import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Header } from '../Header';

describe('Header', () => {
  test('renders basic info and sample count when scanned', () => {
    render(
      <Header
        sampleCount={1234}
        scanned={true}
        onScanClick={vi.fn()}
        onSettingsClick={vi.fn()}
        viewMode="sample"
        onViewModeChange={vi.fn()}
      />
    );
    expect(screen.getByText('OPEN SAMPLE MANAGER')).toBeInTheDocument();
    expect(screen.getByText('✓ 1234 SAMPLES INDEXED')).toBeInTheDocument();
  });

  test('calls onScanClick when scan button is clicked', () => {
    const onScanClick = vi.fn();
    render(
      <Header
        sampleCount={0}
        scanned={false}
        onScanClick={onScanClick}
        onSettingsClick={vi.fn()}
        viewMode="sample"
        onViewModeChange={vi.fn()}
      />
    );
    fireEvent.click(screen.getByText('SCAN LIBRARY'));
    expect(onScanClick).toHaveBeenCalled();
  });

  test('calls onViewModeChange when MIDI list toggle is clicked', () => {
    const onViewModeChange = vi.fn();
    render(
      <Header
        sampleCount={0}
        scanned={false}
        onScanClick={vi.fn()}
        onSettingsClick={vi.fn()}
        viewMode="sample"
        onViewModeChange={onViewModeChange}
      />
    );
    fireEvent.click(screen.getByText('MIDI List'));
    expect(onViewModeChange).toHaveBeenCalledWith('midi');
  });

  test('calls onViewModeChange when sample list toggle is clicked', () => {
    const onViewModeChange = vi.fn();
    render(
      <Header
        sampleCount={0}
        scanned={false}
        onScanClick={vi.fn()}
        onSettingsClick={vi.fn()}
        viewMode="midi"
        onViewModeChange={onViewModeChange}
      />
    );
    fireEvent.click(screen.getByText('Sample List'));
    expect(onViewModeChange).toHaveBeenCalledWith('sample');
  });

  test('shows drag over affordance', () => {
    render(
      <Header
        sampleCount={0}
        scanned={false}
        onScanClick={vi.fn()}
        onSettingsClick={vi.fn()}
        viewMode="sample"
        onViewModeChange={vi.fn()}
        isDragOver={true}
      />
    );
    expect(screen.getByText('DROP TO IMPORT')).toBeInTheDocument();
    expect(screen.queryByText('SCAN LIBRARY')).not.toBeInTheDocument();
  });

  test('calls onReScanClick when re-scan button is clicked', () => {
    const onReScanClick = vi.fn();
    render(
      <Header
        sampleCount={10}
        scanned={true}
        onScanClick={vi.fn()}
        onSettingsClick={vi.fn()}
        onReScanClick={onReScanClick}
        viewMode="sample"
        onViewModeChange={vi.fn()}
      />
    );
    fireEvent.click(screen.getByText('RE-SCAN'));
    expect(onReScanClick).toHaveBeenCalled();
  });

  test('calls onReload when reload button is clicked', () => {
    const onReload = vi.fn();
    render(
      <Header
        sampleCount={10}
        scanned={true}
        onScanClick={vi.fn()}
        onSettingsClick={vi.fn()}
        onReload={onReload}
        viewMode="sample"
        onViewModeChange={vi.fn()}
      />
    );
    fireEvent.click(screen.getByTitle('Reload file tree'));
    expect(onReload).toHaveBeenCalled();
  });

  test('calls onSettingsClick when settings button is clicked', () => {
    const onSettingsClick = vi.fn();
    render(
      <Header
        sampleCount={10}
        scanned={true}
        onScanClick={vi.fn()}
        onSettingsClick={onSettingsClick}
        viewMode="sample"
        onViewModeChange={vi.fn()}
      />
    );
    fireEvent.click(screen.getByTitle('Settings'));
    expect(onSettingsClick).toHaveBeenCalled();
  });
});
