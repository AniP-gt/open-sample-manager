import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createServer, type ToolRequest } from '../src/server.js';

type JsonObject = Record<string, unknown>;

const searchSamplesFixture = {
  request_id: 'req-search-sentinel',
  operation: 'search_samples',
  results: [],
  limit: 10,
  offset: 0,
  has_more: false,
} satisfies JsonObject;

async function connectedSearchClient(request: ToolRequest) {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const server = createServer({ request });
  const client = new Client({ name: 'mcp-server-sentinel-client', version: '0.1.0' });
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return {
    client,
    close: async () => {
      await Promise.all([clientTransport.close(), serverTransport.close()]);
    },
  };
}

async function expectForwardedBody(
  clientArguments: JsonObject,
  request: ReturnType<typeof vi.fn<ToolRequest>>,
) {
  const connected = await connectedSearchClient(request);
  try {
    const result = await connected.client.callTool({
      name: 'search_samples',
      arguments: clientArguments,
    });

    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toEqual(searchSamplesFixture);
    expect(result.content).toHaveLength(1);
    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0]?.[0]).toBe('/v1/search_samples');
    return request.mock.calls[0]?.[1];
  } finally {
    await connected.close();
  }
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('search_samples sentinel normalization', () => {
  it('omits exact empty string fields', async () => {
    const request = vi.fn<ToolRequest>().mockResolvedValue(searchSamplesFixture);
    const body = await expectForwardedBody(
      {
        query: '',
        sample_type: '',
        instrument: '',
        key: '',
        directory_path: '',
        limit: 10,
        offset: 4,
      },
      request,
    );

    expect(body).toMatchObject({
      operation: 'search_samples',
      request_id: expect.stringMatching(/^mcp-[0-9a-f-]+$/),
      limit: 10,
      offset: 4,
    });
    expect(body).not.toHaveProperty('query');
    expect(body).not.toHaveProperty('sample_type');
    expect(body).not.toHaveProperty('instrument');
    expect(body).not.toHaveProperty('key');
    expect(body).not.toHaveProperty('directory_path');
  });

  it('omits whitespace-only string fields', async () => {
    const request = vi.fn<ToolRequest>().mockResolvedValue(searchSamplesFixture);
    const body = await expectForwardedBody(
      {
        query: '   ',
        sample_type: '\t',
        instrument: '\n',
        key: ' A ',
        directory_path: ' \t\n',
        limit: 10,
        offset: 4,
      },
      request,
    );

    expect(body).toMatchObject({
      operation: 'search_samples',
      request_id: expect.stringMatching(/^mcp-[0-9a-f-]+$/),
      limit: 10,
      offset: 4,
    });
    expect(body).not.toHaveProperty('query');
    expect(body).not.toHaveProperty('sample_type');
    expect(body).not.toHaveProperty('instrument');
    expect(body).not.toHaveProperty('directory_path');
    expect(body).toHaveProperty('key', ' A ');
  });

  it('omits empty tags', async () => {
    const request = vi.fn<ToolRequest>().mockResolvedValue(searchSamplesFixture);
    const body = await expectForwardedBody({ tags: ['\t', '  ', ''], limit: 10, offset: 0 }, request);

    expect(body).toHaveProperty('limit', 10);
    expect(body).toHaveProperty('offset', 0);
    expect(body).not.toHaveProperty('tags');
  });

  it('omits paired zero bpm bounds', async () => {
    const request = vi.fn<ToolRequest>().mockResolvedValue(searchSamplesFixture);
    const body = await expectForwardedBody(
      {
        bpm_min: 0,
        bpm_max: 0,
        limit: 10,
      },
      request,
    );

    expect(body).toHaveProperty('limit', 10);
    expect(body).not.toHaveProperty('bpm_min');
    expect(body).not.toHaveProperty('bpm_max');
  });

  it('preserves one-sided zero bpm_min', async () => {
    const request = vi.fn<ToolRequest>().mockResolvedValue(searchSamplesFixture);
    const body = await expectForwardedBody({ bpm_min: 0, limit: 10 }, request);

    expect(body).toMatchObject({ bpm_min: 0, limit: 10 });
    expect(body).not.toHaveProperty('bpm_max');
  });

  it('preserves one-sided zero bpm_max', async () => {
    const request = vi.fn<ToolRequest>().mockResolvedValue(searchSamplesFixture);
    const body = await expectForwardedBody({ bpm_max: 0, limit: 10 }, request);

    expect(body).toMatchObject({ bpm_max: 0, limit: 10 });
    expect(body).not.toHaveProperty('bpm_min');
  });

  it('preserves limit and offset', async () => {
    const request = vi.fn<ToolRequest>().mockResolvedValue(searchSamplesFixture);
    const body = await expectForwardedBody({ query: 'kick', limit: 50, offset: 5 }, request);

    expect(body).toMatchObject({
      query: 'kick',
      limit: 50,
      offset: 5,
      operation: 'search_samples',
    });
  });

  it('preserves meaningful filters and two-sided BPM bounds', async () => {
    const request = vi.fn<ToolRequest>().mockResolvedValue(searchSamplesFixture);
    const body = await expectForwardedBody(
      {
        query: 'kick 808',
        sample_type: 'oneshot',
        instrument: 'drum',
        key: 'C',
        tags: ['kick', '  ', 'electronic', '', '\n'],
        bpm_min: 60,
        bpm_max: 140,
      },
      request,
    );

    expect(body).toMatchObject({
      query: 'kick 808',
      sample_type: 'oneshot',
      instrument: 'drum',
      key: 'C',
      tags: ['kick', 'electronic'],
      bpm_min: 60,
      bpm_max: 140,
    });
  });
});
