import { describe, expect, it, vi } from 'vitest';
import { redactAndWrap } from '../src/httpClient.js';

describe('stdout cleanliness', () => {
  it('redacts token-like content from errors', () => {
    const error = redactAndWrap(new Error('token=super-secret Bearer another-secret'));
    expect(error.message).not.toContain('super-secret');
    expect(error.message).not.toContain('another-secret');
  });

  it('does not write to stdout for redaction helpers', () => {
    const stdoutSpy = vi.spyOn(process.stdout, 'write');
    redactAndWrap(new Error('anything'));
    expect(stdoutSpy).not.toHaveBeenCalled();
  });
});
