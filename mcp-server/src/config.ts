import os from 'node:os';
import path from 'node:path';

export const CONNECTION_FILE_ENV = 'OPEN_SAMPLE_MANAGER_CONNECTION_FILE';

export interface ConnectionFilePathOptions {
  env?: NodeJS.ProcessEnv;
  platform?: NodeJS.Platform;
  homedir?: () => string;
  appDataDir?: () => string | undefined;
}

export function getDefaultConnectionFilePath(options: ConnectionFilePathOptions = {}): string {
  const platform = options.platform ?? process.platform;
  const homeDir = options.homedir ?? os.homedir;
  const appDataDir = options.appDataDir ?? (() => process.env.APPDATA);

  if (platform === 'win32') {
    const appData = appDataDir();
    if (appData) {
      return path.join(appData, 'Open Sample Manager', 'localhost-api-connection.json');
    }
    return path.join(homeDir(), 'AppData', 'Roaming', 'Open Sample Manager', 'localhost-api-connection.json');
  }

  if (platform === 'darwin') {
    return path.join(homeDir(), 'Library', 'Application Support', 'Open Sample Manager', 'localhost-api-connection.json');
  }

  return path.join(homeDir(), '.config', 'open-sample-manager', 'localhost-api-connection.json');
}

export function resolveConnectionFilePath(options: ConnectionFilePathOptions = {}): string {
  const env = options.env ?? process.env;
  const override = env[CONNECTION_FILE_ENV]?.trim();
  if (override) {
    return override;
  }

  return getDefaultConnectionFilePath(options);
}
