import { startStdioServer } from './server.js';

void startStdioServer().catch(() => {
  process.stderr.write('Open Sample Manager MCP server failed to start\n');
  process.exitCode = 1;
});
