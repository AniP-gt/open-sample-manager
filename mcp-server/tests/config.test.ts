import { describe, expect, it } from 'vitest';
import { getDefaultConnectionFilePath, resolveConnectionFilePath } from '../src/config.js';

describe('connection file path resolution', () => {
  it('prefers the override env var', () => {
    expect(resolveConnectionFilePath({ env: { OPEN_SAMPLE_MANAGER_CONNECTION_FILE: '/tmp/override.json' } })).toBe('/tmp/override.json');
  });

  it('uses a documented platform-specific default', () => {
    expect(getDefaultConnectionFilePath({ platform: 'darwin', homedir: () => '/Users/test' })).toBe('/Users/test/Library/Application Support/Open Sample Manager/localhost-api-connection.json');
    expect(getDefaultConnectionFilePath({ platform: 'win32', homedir: () => 'C:/Users/test', appDataDir: () => 'C:/Users/test/AppData/Roaming' })).toBe('C:/Users/test/AppData/Roaming/Open Sample Manager/localhost-api-connection.json');
    expect(getDefaultConnectionFilePath({ platform: 'linux', homedir: () => '/home/test' })).toBe('/home/test/.config/open-sample-manager/localhost-api-connection.json');
  });
});
