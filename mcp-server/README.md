# Open Sample Manager MCP server

This package connects an MCP client to the running desktop app. It is a Node.js stdio server, not a network service.

## Architecture and security

The desktop app owns the SQLite database, local API, playback, and UI command queue. The MCP server reads a connection manifest, validates it, then sends authenticated requests to the app. It never opens the database or audio files directly.

The API is fixed to `http://127.0.0.1:37421/v1`. It accepts bearer authentication only and is not a LAN, browser, or CORS API. On Unix, the app writes the manifest with owner-only permissions. Treat the manifest as a secret because it contains the current bearer token.

The app creates a new token and `instance_id` each time it starts. The MCP server checks the manifest PID before every request. A dead PID stops the request before authentication is sent. After a `401`, it reloads the manifest and retries once only when the `instance_id` changed. This handles a desktop-app restart without retrying bad credentials forever.

Set `OPEN_SAMPLE_MANAGER_CONNECTION_FILE` when your MCP host needs an explicit manifest location. Otherwise, the server uses these paths:

| Platform | Default manifest path |
| --- | --- |
| macOS | `~/Library/Application Support/Open Sample Manager/localhost-api-connection.json` |
| Linux | `~/.config/open-sample-manager/localhost-api-connection.json` |
| Windows | `%APPDATA%\Open Sample Manager\localhost-api-connection.json` |

Do not copy the manifest into a repository, prompt, log, shell history, or MCP configuration. Pass its path through `OPEN_SAMPLE_MANAGER_CONNECTION_FILE`. The manifest is strict JSON with `version`, `base_url`, `token`, `pid`, `instance_id`, and `issued_at`; the client rejects a changed host, scheme, port, path, credentials, query, or fragment.

## Set up an MCP host

Build the stdio entry point from the repository root:

```bash
npm run mcp:build
```

Set these values in the environment that starts your MCP host. Use an absolute path for the checkout and a manifest path appropriate for your platform.

```bash
export OPEN_SAMPLE_MANAGER_MCP_DIR="/absolute/path/to/open-sample-manager/mcp-server"
export OPEN_SAMPLE_MANAGER_CONNECTION_FILE="$HOME/.config/open-sample-manager/localhost-api-connection.json"
```

Start the desktop app before the MCP host. The app creates and owns the manifest.

### Claude Code

Add this server to the Claude Code MCP configuration. Keep the environment references as shown. Do not replace them with the manifest token.

```json
{
  "mcpServers": {
    "open-sample-manager": {
      "command": "node",
      "args": ["${OPEN_SAMPLE_MANAGER_MCP_DIR}/dist/stdio.js"],
      "env": {
        "OPEN_SAMPLE_MANAGER_CONNECTION_FILE": "${OPEN_SAMPLE_MANAGER_CONNECTION_FILE}"
      }
    }
  }
}
```

### OpenCode

Add this local server to `opencode.json` or `~/.config/opencode/opencode.json`.

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "open-sample-manager": {
      "type": "local",
      "command": ["node", "${OPEN_SAMPLE_MANAGER_MCP_DIR}/dist/stdio.js"],
      "environment": {
        "OPEN_SAMPLE_MANAGER_CONNECTION_FILE": "${OPEN_SAMPLE_MANAGER_CONNECTION_FILE}"
      },
      "enabled": true
    }
  }
}
```

The process writes protocol messages only to stdout. Diagnostics go to stderr.

## Tools

All inputs are JSON objects. Extra fields are rejected. IDs are positive integers, `sample_ids` contains 1 to 100 unique IDs, and all limits are capped at 100.

| Tool | Required input | Optional input | Behavior |
| --- | --- | --- | --- |
| `search_samples` | none | `query` string up to 512 characters, `sample_type`, `instrument`, `key`, `directory_path` strings up to 128 characters, `bpm_min` and `bpm_max` nonnegative numbers, `tags` up to 100 strings, `limit` 1 to 100, `offset` 0 to 10000 | Searches the local library with structured filters. |
| `get_sample` | `sample_id` | none | Returns one redacted sample DTO. |
| `find_similar_samples` | `sample_id`, `limit` 1 to 100 | `exclude_duplicates` boolean, default `false` | Finds embedding-based neighbors for a library sample. |
| `show_samples_in_app` | `sample_ids` | `selected_id` | Queues the ordered IDs for the desktop UI and can select one listed ID. |
| `preview_sample` | `sample_id` | none | Queues a desktop preview for one library sample. |
| `add_to_collection` | `collection_name` up to 128 characters, `sample_ids` | none | Atomically creates or reuses a named collection and adds IDs in the supplied order. Existing memberships are not duplicated. |

`show_samples_in_app` changes the running app's displayed result set. It does not play a sample or open files. `preview_sample` stops current playback, selects the target, waits for the selected player to be ready, then starts exactly one preview from the beginning. It works whether the app's normal auto-play preference is on or off.

## Limits

- The desktop app must be running on the same machine and user session.
- Results come from the local indexed library. A file that has not been scanned, or a missing/offline file, can't be previewed.
- Similarity needs an embedding for the source sample. It is not a semantic text search fallback.
- Show and preview are queued for the desktop renderer. If the renderer is closed or unavailable, they cannot complete until it is available.
- Collections support adding ordered sample IDs only. They do not expose rename, delete, or direct database access.
- The package is not published and does not install a background service or network listener.

## Troubleshooting

### The app is not running

Start Open Sample Manager, wait for it to finish launching, then retry. Check that `OPEN_SAMPLE_MANAGER_CONNECTION_FILE` points to the manifest for that app instance. A dead manifest PID fails before any bearer value is sent.

### Port conflict at startup

The app needs `127.0.0.1:37421`. Stop the process already using that loopback port, then start the app again. Do not change the MCP endpoint or edit the manifest to another URL. The client rejects alternate endpoints by design.

### Stale manifest or authentication error

Close any stale app process and start the app again. It writes a fresh manifest with a new token and `instance_id`. The MCP server automatically retries one `401` only after it observes that new identity. If the error persists, verify the manifest path and its owner-only permissions, then restart the MCP host.

### MCP host cannot start the entry point

Run `npm run mcp:build` from the repository root. Confirm that `${OPEN_SAMPLE_MANAGER_MCP_DIR}/dist/stdio.js` exists and that the host process inherits `OPEN_SAMPLE_MANAGER_MCP_DIR` and `OPEN_SAMPLE_MANAGER_CONNECTION_FILE`.

## Development checks

```bash
npm run mcp:typecheck
npm run mcp:test
npm run mcp:build
npm run mcp:ci
```
