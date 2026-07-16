import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  addToCollectionInputSchema,
  addToCollectionResponseSchema,
  apiErrorSchema,
  findSimilarSamplesInputSchema,
  findSimilarSamplesResponseSchema,
  getSampleInputSchema,
  getSampleResponseSchema,
  operationSchema,
  previewSampleInputSchema,
  previewSampleResponseSchema,
  searchSamplesInputSchema,
  searchSamplesResponseSchema,
  showSamplesInAppInputSchema,
  showSamplesInAppResponseSchema,
  type Operation,
} from './contracts.js';
import { HttpClientError, postJsonWithRetry } from './httpClient.js';
import { redactSensitiveText } from './manifest.js';

export type ToolRequest = (route: string, body: unknown) => Promise<unknown>;

export interface ServerOptions {
  readonly request?: ToolRequest;
}

type ToolDefinition = {
  readonly name: Operation;
  readonly description: string;
  readonly inputSchema: Record<string, unknown>;
};

type ToolInvocation = {
  readonly operation: Operation;
  readonly inputSchema: z.ZodType<Record<string, unknown>>;
  readonly outputSchema: z.ZodType<Record<string, unknown>>;
  readonly arguments: Record<string, unknown>;
  readonly request: ToolRequest;
};

const tools = [
  { name: 'search_samples', description: 'Search the local sample library using structured filters.', inputSchema: objectSchema({ query: stringSchema(512), sample_type: stringSchema(128), instrument: stringSchema(128), bpm_min: numberSchema(0), bpm_max: numberSchema(0), key: stringSchema(128), tags: arraySchema(stringSchema(128), 100), directory_path: stringSchema(128), limit: integerSchema(1, 100), offset: integerSchema(0, 10_000) }) },
  { name: 'get_sample', description: 'Get one sample by its library ID.', inputSchema: objectSchema({ sample_id: sampleIdSchema() }, ['sample_id']) },
  { name: 'find_similar_samples', description: 'Find samples similar to one library sample.', inputSchema: objectSchema({ sample_id: sampleIdSchema(), limit: integerSchema(1, 100), exclude_duplicates: { ...booleanSchema(), default: false } }, ['sample_id', 'limit']) },
  { name: 'show_samples_in_app', description: 'Show an ordered set of sample IDs in the running desktop app.', inputSchema: objectSchema({ sample_ids: sampleIdsSchema(), selected_id: sampleIdSchema() }, ['sample_ids']) },
  { name: 'preview_sample', description: 'Preview one sample in the running desktop app.', inputSchema: objectSchema({ sample_id: sampleIdSchema() }, ['sample_id']) },
  { name: 'add_to_collection', description: 'Atomically add ordered sample IDs to a named collection.', inputSchema: objectSchema({ collection_name: stringSchema(128), sample_ids: sampleIdsSchema() }, ['collection_name', 'sample_ids']) },
] as const satisfies readonly ToolDefinition[];

export function createServer(options: ServerOptions = {}): Server {
  const request = options.request ?? defaultToolRequest;
  const server = new Server(
    { name: '@open-sample-manager/mcp-server', version: '0.1.0' },
    { capabilities: { tools: {} } },
  );
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));
  server.setRequestHandler(CallToolRequestSchema, async ({ params }) => invokeTool(params.name, params.arguments ?? {}, request));
  return server;
}

export async function startStdioServer(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

async function defaultToolRequest(route: string, body: unknown): Promise<unknown> {
  const response = await postJsonWithRetry<unknown>(route, body);
  return response.data;
}

async function invokeTool(name: string, arguments_: Record<string, unknown>, request: ToolRequest) {
  switch (name) {
    case 'search_samples':
      return invokeOperation({ operation: 'search_samples', inputSchema: searchSamplesInputSchema, outputSchema: searchSamplesResponseSchema, arguments: arguments_, request });
    case 'get_sample':
      return invokeOperation({ operation: 'get_sample', inputSchema: getSampleInputSchema, outputSchema: getSampleResponseSchema, arguments: arguments_, request });
    case 'find_similar_samples':
      return invokeOperation({ operation: 'find_similar_samples', inputSchema: findSimilarSamplesInputSchema, outputSchema: findSimilarSamplesResponseSchema, arguments: arguments_, request });
    case 'show_samples_in_app':
      return invokeOperation({ operation: 'show_samples_in_app', inputSchema: showSamplesInAppInputSchema, outputSchema: showSamplesInAppResponseSchema, arguments: arguments_, request });
    case 'preview_sample':
      return invokeOperation({ operation: 'preview_sample', inputSchema: previewSampleInputSchema, outputSchema: previewSampleResponseSchema, arguments: arguments_, request });
    case 'add_to_collection':
      return invokeOperation({ operation: 'add_to_collection', inputSchema: addToCollectionInputSchema, outputSchema: addToCollectionResponseSchema, arguments: arguments_, request });
    default:
      return safeError('invalid_request', 'Unknown MCP tool', `mcp-${randomUUID()}`);
  }
}

async function invokeOperation(invocation: ToolInvocation) {
  const requestId = `mcp-${randomUUID()}`;
  const parsedInput = invocation.inputSchema.safeParse(invocation.arguments);
  if (!parsedInput.success) {
    return safeError('invalid_request', 'Tool arguments do not match the local API contract', requestId);
  }

  try {
    const data = await invocation.request(`/v1/${invocation.operation}`, { request_id: requestId, operation: invocation.operation, ...parsedInput.data });
    const parsedOutput = invocation.outputSchema.safeParse(data);
    if (!parsedOutput.success) {
      return safeError('internal_error', 'The local API returned an invalid response', requestId);
    }
    return {
      content: [{ type: 'text' as const, text: JSON.stringify(parsedOutput.data) }],
      structuredContent: parsedOutput.data,
    };
  } catch (error: unknown) {
    return errorResult(error, requestId);
  }
}

function errorResult(error: unknown, requestId: string) {
  const body = error instanceof HttpClientError ? error.body : undefined;
  const parsedError = apiErrorSchema.safeParse(body);
  if (parsedError.success) {
    return safeError(parsedError.data.code, parsedError.data.message, parsedError.data.request_id);
  }

  if (error instanceof HttpClientError && error.status === 503) {
    return safeError('service_unavailable', 'The local API is unavailable', requestId);
  }

  return safeError('internal_error', 'The local API request failed', requestId);
}

function safeError(code: string, message: string, requestId: string) {
  const error = { code, message: redactSensitiveText(message), request_id: requestId };
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(error) }],
    structuredContent: error,
    isError: true,
  };
}

function objectSchema(properties: Record<string, unknown>, required: readonly string[] = []): Record<string, unknown> {
  return { type: 'object', properties, required, additionalProperties: false };
}

function stringSchema(maxLength: number): Record<string, unknown> {
  return { type: 'string', maxLength };
}

function numberSchema(minimum: number): Record<string, unknown> {
  return { type: 'number', minimum };
}

function integerSchema(minimum: number, maximum: number): Record<string, unknown> {
  return { type: 'integer', minimum, maximum };
}

function sampleIdSchema(): Record<string, unknown> {
  return { type: 'integer', minimum: 1, maximum: Number.MAX_SAFE_INTEGER };
}

function booleanSchema(): Record<string, unknown> {
  return { type: 'boolean' };
}

function arraySchema(items: Record<string, unknown>, maxItems: number): Record<string, unknown> {
  return { type: 'array', items, maxItems };
}

function sampleIdsSchema(): Record<string, unknown> {
  return { type: 'array', items: sampleIdSchema(), minItems: 1, maxItems: 100, uniqueItems: true };
}
