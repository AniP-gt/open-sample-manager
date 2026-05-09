import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RescanPrompt } from '../RescanPrompt';

describe('RescanPrompt', () => {
  test('does not render when isOpen is false', () => {
    const { container } = render(
      <RescanPrompt
        isOpen={false}
        path="/some/path"
        onRescan={vi.fn()}
        onSkip={vi.fn()}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  test('renders prompt with path and text', () => {
    render(
      <RescanPrompt
        isOpen={true}
        path="/my/audio/samples"
        onRescan={vi.fn()}
        onSkip={vi.fn()}
        isIncremental={true}
      />
    );
    expect(screen.getByText('Library Already Exists')).toBeInTheDocument();
    expect(screen.getByText('/my/audio/samples')).toBeInTheDocument();
    expect(screen.getByText('Only new files will be added (existing files in the library are skipped).')).toBeInTheDocument();
  });

  test('calls onSkip when Skip button is clicked', () => {
    const onSkip = vi.fn();
    render(
      <RescanPrompt
        isOpen={true}
        path="/path"
        onRescan={vi.fn()}
        onSkip={onSkip}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }));
    expect(onSkip).toHaveBeenCalled();
  });

  test('calls onRescan and shows loading state', async () => {
    let resolveRescan: () => void;
    const rescanPromise = new Promise<void>((resolve) => {
      resolveRescan = resolve;
    });
    const onRescan = vi.fn(() => rescanPromise);

    render(
      <RescanPrompt
        isOpen={true}
        path="/path"
        onRescan={onRescan}
        onSkip={vi.fn()}
      />
    );

    const rescanBtn = screen.getByRole('button', { name: 'Scan (Add New)' });
    fireEvent.click(rescanBtn);

    expect(onRescan).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Scanning...' })).toBeDisabled();

    // @ts-ignore
    resolveRescan();

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Scan (Add New)' })).not.toBeDisabled();
    });
  });

  test('renders correct text for non-incremental rescan', () => {
    render(
      <RescanPrompt
        isOpen={true}
        path="/path"
        onRescan={vi.fn()}
        onSkip={vi.fn()}
        isIncremental={false}
      />
    );
    expect(screen.getByText('All files will be analyzed again (useful for updating metadata like key detection).')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'ReScan' })).toBeInTheDocument();
  });
});
