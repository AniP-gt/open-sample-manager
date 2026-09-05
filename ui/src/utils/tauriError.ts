const MAX_ERROR_TEXT_LENGTH = 160;

function sanitizeErrorText(value: string): string {
  return value.replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, MAX_ERROR_TEXT_LENGTH);
}

function isErrorRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function formatTauriCommandError(value: unknown, fallback: string): string {
  const base = fallback.endsWith(".") ? fallback.slice(0, -1) : fallback;
  const code = isErrorRecord(value) && typeof value.code === "string" && /^[a-z0-9_]{1,64}$/.test(value.code)
    ? value.code
    : null;
  const message = typeof value === "string"
    ? sanitizeErrorText(value)
    : value instanceof Error
      ? sanitizeErrorText(value.message)
      : isErrorRecord(value) && typeof value.message === "string"
        ? sanitizeErrorText(value.message)
        : "";

  if (code && message) return `${base} (${code}): ${message}`;
  if (code) return `${base} (${code}).`;
  if (message) return `${fallback}: ${message}`;
  return fallback;
}
