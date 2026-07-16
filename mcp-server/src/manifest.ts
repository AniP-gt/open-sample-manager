import { readFile } from 'node:fs/promises';
import { z } from 'zod';
import { resolveConnectionFilePath, type ConnectionFilePathOptions } from './config.js';

export const localApiBaseUrl = 'http://127.0.0.1:37421/v1';

export const connectionManifestSchema = z.object({
  version: z.union([z.literal(1), z.literal('1')]),
  base_url: z.literal(localApiBaseUrl),
  token: z.string().min(1),
  pid: z.number().int().positive(),
  instance_id: z.string().min(1),
  issued_at: z.string().datetime({ offset: false }),
}).strict();

export type ConnectionManifest = z.infer<typeof connectionManifestSchema>;

export class ManifestError extends Error {
  override name = 'ManifestError';
}

export interface ManifestSource {
  filePath: string;
  manifest: ConnectionManifest;
}

export interface ManifestLoaderOptions extends ConnectionFilePathOptions {
  readFileFn?: typeof readFile;
}

export async function loadConnectionManifest(options: ManifestLoaderOptions = {}): Promise<ManifestSource> {
  const filePath = resolveConnectionFilePath(options);
  const read = options.readFileFn ?? readFile;

  let raw: string;
  try {
    raw = await read(filePath, 'utf8');
  } catch (error: unknown) {
    throw new ManifestError(`Unable to read connection file at ${filePath}: ${safeReason(error)}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ManifestError(`Connection file at ${filePath} is not valid JSON`);
  }

  return { filePath, manifest: parseConnectionManifest(parsed, filePath) };
}

export function parseConnectionManifest(value: unknown, source = 'connection file'): ConnectionManifest {
  const result = connectionManifestSchema.safeParse(value);
  if (!result.success) {
    throw new ManifestError(`Connection file at ${source} is missing required fields`);
  }

  return result.data;
}

function safeReason(error: unknown): string {
  if (error instanceof Error && error.message) {
    return redactSensitiveText(error.message);
  }

  return 'unknown error';
}

export function redactSensitiveText(input: string): string {
  return input
    .replace(/Bearer\s+[A-Za-z0-9._-]+/g, 'Bearer [redacted]')
    .replace(/token[=:]\s*[^\s,;]+/gi, 'token=[redacted]')
    .replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g, '[redacted-email]');
}
