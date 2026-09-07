const MAX_ERROR_TEXT_LENGTH = 160;

function sanitizeErrorText(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, MAX_ERROR_TEXT_LENGTH);
}

function isErrorRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseErrorRecord(value: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(value);
    return isErrorRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function errorRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === "string") return parseErrorRecord(value);
  return isErrorRecord(value) ? value : null;
}

function isStableCode(value: unknown): value is string {
  return typeof value === "string" && /^[a-z0-9_]{1,64}$/.test(value);
}

export function getTauriCommandErrorCode(value: unknown, allowedCodes?: readonly string[]): string | null {
  const record = errorRecord(value);
  const code = record?.code;
  if (!isStableCode(code)) return null;
  return allowedCodes === undefined || allowedCodes.includes(code) ? code : null;
}

export function hasFormattedTauriCommandErrorCode(value: string | null, allowedCodes: readonly string[]): boolean {
  return value !== null && allowedCodes.some((code) => value.includes(`(${code})`));
}

export function formatTauriCommandError(value: unknown, fallback: string): string {
  const error = typeof value === "string" ? parseErrorRecord(value) ?? value : value;
  const base = fallback.endsWith(".") ? fallback.slice(0, -1) : fallback;
  const code = getTauriCommandErrorCode(error);
  const message = typeof error === "string"
    ? sanitizeErrorText(error)
    : error instanceof Error
      ? sanitizeErrorText(error.message)
      : isErrorRecord(error) && typeof error.message === "string"
        ? sanitizeErrorText(error.message)
        : "";

  if (code && message) return `${base} (${code}): ${message}`;
  if (code) return `${base} (${code}).`;
  if (message) return `${fallback}: ${message}`;
  return fallback;
}
