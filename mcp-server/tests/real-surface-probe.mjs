import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const [manifestPath, sourceId, similarId] = process.argv.slice(2);

if (!manifestPath || !sourceId || !similarId) {
  process.stderr.write('MCP real-surface probe failed\n');
  process.exitCode = 1;
} else {
  const currentDirectory = new URL('.', import.meta.url);
  const serverPath = fileURLToPath(new URL('../dist/stdio.js', currentDirectory));
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [serverPath],
    env: { ...process.env, OPEN_SAMPLE_MANAGER_CONNECTION_FILE: manifestPath },
  });
  const client = new Client({ name: 'real-surface-probe', version: '0.1.0' });

  try {
    await client.connect(transport);
    const operations = [
      ['search_samples', { instrument: 'kick', bpm_min: 120, bpm_max: 130, limit: 10 }],
      ['get_sample', { sample_id: Number(sourceId) }],
      ['find_similar_samples', { sample_id: Number(sourceId), limit: 1, exclude_duplicates: true }],
      ['show_samples_in_app', { sample_ids: [Number(similarId), Number(sourceId)], selected_id: Number(sourceId) }],
      ['preview_sample', { sample_id: Number(sourceId) }],
      ['add_to_collection', { collection_name: 'MCP E2E', sample_ids: [Number(similarId), Number(sourceId)] }],
    ];

    for (const [name, arguments_] of operations) {
      const response = await client.callTool({ name, arguments: arguments_ });
      assert.equal(response.isError, undefined);
      assert.ok(response.structuredContent);
    }

    process.stdout.write('mcp real-surface probe passed\n');
  } catch {
    process.stderr.write('MCP real-surface probe failed\n');
    process.exitCode = 1;
  } finally {
    await client.close();
  }
}
