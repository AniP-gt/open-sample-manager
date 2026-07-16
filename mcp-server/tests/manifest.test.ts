import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConnectionManifest, ManifestError, redactSensitiveText } from '../src/manifest.js';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('connection manifest loading', () => {
  it('fails for missing manifest', async () => {
    vi.stubEnv('OPEN_SAMPLE_MANAGER_CONNECTION_FILE', '/tmp/definitely-missing.json');
    await expect(loadConnectionManifest()).rejects.toBeInstanceOf(ManifestError);
  });

  it('fails for malformed manifest json', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'mcp-manifest-'));
    const file = join(dir, 'connection.json');
    await writeFile(file, '{"token":"secret"', 'utf8');
    vi.stubEnv('OPEN_SAMPLE_MANAGER_CONNECTION_FILE', file);
    await expect(loadConnectionManifest()).rejects.toThrow(/not valid JSON/);
  });

  it('loads a valid manifest', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'mcp-manifest-'));
    const file = join(dir, 'connection.json');
    await writeFile(file, JSON.stringify({ version: 1, base_url: 'http://127.0.0.1:37421/v1', token: 'secret', pid: 1, instance_id: 'abc', issued_at: '2026-07-15T00:00:00Z' }), 'utf8');
    vi.stubEnv('OPEN_SAMPLE_MANAGER_CONNECTION_FILE', file);
    await expect(loadConnectionManifest()).resolves.toMatchObject({ filePath: file, manifest: { token: 'secret', instance_id: 'abc' } });
  });

  it.each([
    'http://localhost:37421/v1',
    'https://127.0.0.1:37421/v1',
    'http://127.0.0.1:37422/v1',
    'http://127.0.0.1:37421/',
    'http://user:password@127.0.0.1:37421/v1',
    'http://127.0.0.1:37421/v1?next=https://example.test',
    'http://127.0.0.1:37421/v1#fragment',
  ])('rejects a manifest with an unsafe base URL: %s', async (baseUrl) => {
    const dir = await mkdtemp(join(tmpdir(), 'mcp-manifest-'));
    const file = join(dir, 'connection.json');
    await writeFile(file, JSON.stringify({ version: 1, base_url: baseUrl, token: 'secret', pid: 1, instance_id: 'abc', issued_at: '2026-07-15T00:00:00Z' }), 'utf8');
    vi.stubEnv('OPEN_SAMPLE_MANAGER_CONNECTION_FILE', file);

    await expect(loadConnectionManifest()).rejects.toThrow(/missing required fields/);
  });

  it('rejects a manifest with a non-ISO timestamp', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'mcp-manifest-'));
    const file = join(dir, 'connection.json');
    await writeFile(file, JSON.stringify({ version: 1, base_url: 'http://127.0.0.1:37421/v1', token: 'secret', pid: 1, instance_id: 'abc', issued_at: '1721001600' }), 'utf8');
    vi.stubEnv('OPEN_SAMPLE_MANAGER_CONNECTION_FILE', file);

    await expect(loadConnectionManifest()).rejects.toThrow(/missing required fields/);
  });

  it('redacts token-like text', () => {
    expect(redactSensitiveText('Bearer secret token=abc user@example.com')).toBe('Bearer [redacted] token=[redacted] [redacted-email]');
  });
});
