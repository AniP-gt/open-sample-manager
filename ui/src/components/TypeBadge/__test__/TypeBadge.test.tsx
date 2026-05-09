import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TypeBadge, InstrumentBadge, getInstrumentColor } from '../TypeBadge';

describe('TypeBadge', () => {
  test('renders loop badge', () => {
    render(<TypeBadge type="loop" />);
    const badge = screen.getByText('loop');
    expect(badge).toBeInTheDocument();
  });

  test('renders one-shot badge', () => {
    render(<TypeBadge type="one-shot" />);
    const badge = screen.getByText('one-shot');
    expect(badge).toBeInTheDocument();
  });

  test('renders unknown type falling back to one-shot style', () => {
    // @ts-expect-error - testing invalid type
    render(<TypeBadge type="unknown" />);
    const badge = screen.getByText('unknown');
    expect(badge).toBeInTheDocument();
  });

  test('calls onClick when clicked', () => {
    const onClick = vi.fn();
    render(<TypeBadge type="loop" onClick={onClick} />);
    fireEvent.click(screen.getByText('loop'));
    expect(onClick).toHaveBeenCalled();
  });
});

describe('InstrumentBadge', () => {
  test('renders instrument type', () => {
    render(<InstrumentBadge type="kick" />);
    const badge = screen.getByText('kick');
    expect(badge).toBeInTheDocument();
  });

  test('renders unknown type falling back to other style', () => {
    // @ts-expect-error - testing invalid type
    render(<InstrumentBadge type="unknown" />);
    const badge = screen.getByText('unknown');
    expect(badge).toBeInTheDocument();
  });
});

describe('getInstrumentColor', () => {
  test('returns style for known type', () => {
    const style = getInstrumentColor('kick');
    expect(style.color).toBe('#e53e3e');
  });

  test('returns fallback style for unknown type', () => {
    // @ts-expect-error - testing invalid type
    const style = getInstrumentColor('unknown');
    expect(style.color).toBe('#a0aec0');
  });
});
