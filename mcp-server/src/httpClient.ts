import { setTimeout as delay } from 'node:timers/promises';
import { diagnostic } from './diagnostics.js';
import { ManifestError, loadConnectionManifest, parseConnectionManifest, redactSensitiveText, type ConnectionManifest, type ManifestSource } from './manifest.js';

export class HttpClientError extends Error {
  readonly status: number | undefined;
  readonly body: unknown;

  constructor(message: string, status?: number, body: unknown = undefined) {
    super(message);
    this.name = 'HttpClientError';
    this.status = status;
    this.body = body;
  }
}

export interface RequestOptions {
  timeoutMs?: number;
  signal?: AbortSignal;
  loadManifest?: () => Promise<ManifestSource>;
  fetchImpl?: typeof fetch;
  isProcessAlive?: ProcessLivenessCheck;
}

export type ProcessLivenessCheck = (pid: number) => boolean;

export interface JsonResponse<T> {
  data: T;
  manifest: ConnectionManifest;
}

export async function postJson<T>(route: string, body: unknown, options: RequestOptions = {}): Promise<JsonResponse<T>> {
  const manifestLoader = options.loadManifest ?? (() => loadConnectionManifest({}));
  const manifest = await manifestLoader();
  const data = await requestJson<T>(manifest.manifest, route, body, options);
  return { data, manifest: manifest.manifest };
}

export async function postJsonWithRetry<T>(route: string, body: unknown, options: RequestOptions = {}): Promise<JsonResponse<T>> {
  const manifestLoader = options.loadManifest ?? (() => loadConnectionManifest({}));
  const initial = await manifestLoader();

  try {
    const data = await requestJson<T>(initial.manifest, route, body, options);
    return { data, manifest: initial.manifest };
  } catch (error: unknown) {
    const httpError = redactAndWrap(error);
    if (httpError.status !== 401) {
      throw httpError;
    }

    const refreshed = await manifestLoader();
    if (refreshed.manifest.instance_id === initial.manifest.instance_id) {
      throw new HttpClientError('Authentication failed after refresh', 401);
    }

    diagnostic(`401 received; retrying with refreshed instance_id ${refreshed.manifest.instance_id}`);
    const data = await requestJson<T>(refreshed.manifest, route, body, options);
    return { data, manifest: refreshed.manifest };
  }
}

async function requestJson<T>(manifest: ConnectionManifest, route: string, body: unknown, options: RequestOptions): Promise<T> {
  const safeManifest = parseConnectionManifest(manifest, 'request manifest');
  const processIsAlive = options.isProcessAlive ?? isProcessAlive;
  if (!processIsAlive(safeManifest.pid)) {
    throw new HttpClientError('The Open Sample Manager app is not running');
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? 10_000;
  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(new Error(`Request timed out after ${timeoutMs}ms`)), timeoutMs);
  const combinedSignal = mergeSignals(controller.signal, options.signal);
  const url = new URL(route, safeManifest.base_url);

  try {
    const response = await fetchImpl(url, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${safeManifest.token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: combinedSignal,
    });

    const text = await response.text();
    const responseBody = parseJsonResponse(text, response.status);
    if (response.status === 401) {
      throw new HttpClientError('HTTP 401 Unauthorized', 401, responseBody);
    }

    if (!response.ok) {
      throw new HttpClientError(`Request failed with status ${response.status}`, response.status, responseBody);
    }

    return responseBody as T;
  } catch (error: unknown) {
    throw redactAndWrap(error);
  } finally {
    clearTimeout(timeoutHandle);
  }
}

function parseJsonResponse(text: string, status: number): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpClientError('Response was not valid JSON', status);
  }
}

export function isProcessAlive(pid: number, signalProcess: (pid: number, signal: 0) => boolean = process.kill): boolean {
  try {
    signalProcess(pid, 0);
    return true;
  } catch (error: unknown) {
    return hasErrorCode(error, 'EPERM');
  }
}

function hasErrorCode(error: unknown, expectedCode: string): boolean {
  return error instanceof Error && Reflect.get(error, 'code') === expectedCode;
}

function mergeSignals(primary: AbortSignal, secondary?: AbortSignal): AbortSignal {
  if (!secondary) {
    return primary;
  }

  if (secondary.aborted) {
    return secondary;
  }

  const controller = new AbortController();
  const propagate = (signal: AbortSignal): void => {
    if (!controller.signal.aborted) {
      controller.abort(signal.reason ?? new Error('Aborted'));
    }
  };

  const forwardPrimary = (): void => propagate(primary);
  const forwardSecondary = (): void => propagate(secondary);

  primary.addEventListener('abort', forwardPrimary, { once: true });
  secondary.addEventListener('abort', forwardSecondary, { once: true });

  return controller.signal;
}

export function redactAndWrap(error: unknown): HttpClientError {
  if (error instanceof HttpClientError) {
    diagnostic(error.message);
    return error;
  }

  if (error instanceof ManifestError) {
    const redacted = redactSensitiveText(error.message);
    diagnostic(redacted);
    return new HttpClientError(redacted);
  }

  if (error instanceof Error) {
    const redacted = redactSensitiveText(error.message);
    diagnostic(redacted);
    return new HttpClientError(redacted);
  }

  return new HttpClientError('Unexpected error');
}

export async function sleepMs(ms: number): Promise<void> {
  await delay(ms);
}
