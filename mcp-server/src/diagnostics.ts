import { redactSensitiveText } from './manifest.js';

export function diagnostic(message: string): void {
  process.stderr.write(`${redactSensitiveText(message)}
`);
}
