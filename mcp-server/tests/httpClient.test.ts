import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { isProcessAlive, postJson, postJsonWithRetry } from '../src/httpClient.js';
import type { ConnectionManifest, ManifestSource } from '../src/manifest.js';

afterEach(() => {
  vi.unstubAllEnvs();
});

async function writeManifest(token: string, instanceId = 'instance-a'): Promise<string> {
  const dir = await mkdtemp(join(tmpdir(), 'mcp-client-'));
  const file = join(dir, 'connection.json');
  await writeFile(file, JSON.stringify({ version: 1, base_url: 'http://127.0.0.1:37421/v1', token, pid: 1, instance_id: instanceId, issued_at: '2026-07-15T00:00:00Z' }), 'utf8');
  return file;
}

function manifestSource(filePath: string, token: string, instanceId = 'instance-a'): ManifestSource {
  return {
    filePath,
    manifest: { version: 1, base_url: 'http://127.0.0.1:37421/v1', token, pid: 1, instance_id: instanceId, issued_at: '2026-07-15T00:00:00Z' } satisfies ConnectionManifest,
  };
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

describe('http client', () => {
  it('attaches bearer auth and serializes JSON', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(jsonResponse({ ok: true }));
    vi.stubEnv('OPEN_SAMPLE_MANAGER_CONNECTION_FILE', await writeManifest('secret-token'));

    await expect(postJson<{ ok: boolean }>('/v1/search_samples', { query: 'kick' }, { fetchImpl, isProcessAlive: () => true })).resolves.toMatchObject({ data: { ok: true } });

    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(url).toBeInstanceOf(URL);
    expect(url?.toString()).toBe('http://127.0.0.1:37421/v1/search_samples');
    expect(init).toMatchObject({ headers: { authorization: 'Bearer secret-token' }, body: '{"query":"kick"}' });
  });

  it('rejects non-json responses', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response('not json', { status: 200 }));
    vi.stubEnv('OPEN_SAMPLE_MANAGER_CONNECTION_FILE', await writeManifest('secret-token'));
    await expect(postJson('/v1/get_sample', { id: 'abc' }, { fetchImpl, isProcessAlive: () => true })).rejects.toThrow(/valid JSON/);
  });

  it('times out and aborts', async () => {
    const fetchImpl: typeof fetch = async (_url, init) => new Promise((_, reject) => {
      init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true });
    });
    vi.stubEnv('OPEN_SAMPLE_MANAGER_CONNECTION_FILE', await writeManifest('secret-token'));
    await expect(postJson('/v1/get_sample', { id: 'abc' }, { timeoutMs: 10, fetchImpl, isProcessAlive: () => true })).rejects.toThrow();
  });

  it('does not retry on unchanged instance after 401', async () => {
    let count = 0;
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async () => {
      count += 1;
      return jsonResponse({ error: 'nope' }, 401);
    });
    vi.stubEnv('OPEN_SAMPLE_MANAGER_CONNECTION_FILE', await writeManifest('secret-token', 'instance-a'));
    await expect(postJsonWithRetry('/v1/get_sample', { id: 'abc' }, { fetchImpl, isProcessAlive: () => true })).rejects.toThrow(/Authentication failed/);
    expect(count).toBe(1);
  });

  it('retries once when instance changes after 401', async () => {
    let count = 0;
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async (_url, init) => {
      count += 1;
      if (count === 1) {
        return jsonResponse({ error: 'first' }, 401);
      }
      return jsonResponse({ ok: true, auth: new Headers(init?.headers).get('authorization') });
    });

    const firstManifest = manifestSource('/tmp/manifest-a.json', 'old-token', 'instance-a');
    const secondManifest = manifestSource('/tmp/manifest-b.json', 'new-token', 'instance-b');
    const loader = vi.fn<() => Promise<ManifestSource>>()
      .mockResolvedValueOnce(firstManifest)
      .mockResolvedValueOnce(secondManifest);

    await expect(postJsonWithRetry<{ ok: boolean; auth: string }>('/v1/get_sample', { id: 'abc' }, { loadManifest: loader, fetchImpl, isProcessAlive: () => true })).resolves.toMatchObject({ data: { ok: true, auth: 'Bearer new-token' } });
    expect(count).toBe(2);
  });

  it('rejects a dead manifest PID before sending its bearer token', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    vi.stubEnv('OPEN_SAMPLE_MANAGER_CONNECTION_FILE', await writeManifest('secret-token'));

    await expect(postJson('/v1/get_sample', { id: 'abc' }, { fetchImpl, isProcessAlive: () => false })).rejects.toThrow(/not running/);

    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('treats EPERM from a process probe as alive', () => {
    const denied = Object.assign(new Error('operation not permitted'), { code: 'EPERM' });

    expect(isProcessAlive(123, () => { throw denied; })).toBe(true);
  });

  it('does not write to stdout on diagnostics', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response('not json', { status: 200 }));
    const stdoutSpy = vi.spyOn(process.stdout, 'write');
    const stderrSpy = vi.spyOn(process.stderr, 'write');
    vi.stubEnv('OPEN_SAMPLE_MANAGER_CONNECTION_FILE', await writeManifest('secret-token'));
    await expect(postJson('/v1/get_sample', { id: 'abc' }, { fetchImpl, isProcessAlive: () => true })).rejects.toThrow();
    expect(stdoutSpy).not.toHaveBeenCalled();
    expect(stderrSpy).toHaveBeenCalled();
    const stderr = stderrSpy.mock.calls.map(([chunk]) => String(chunk)).join('');
    expect(stderr).not.toContain('secret-token');
  });
});
