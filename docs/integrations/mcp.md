# MCP integration

Open Sample Manager can connect an MCP host to the sample library running in the desktop app. The integration is a local Node.js stdio MCP server, not a network service.

The package is private and unpublished. Build it from this checkout.

## Purpose and features

The server lets an MCP host search indexed samples, inspect a sample, find similar samples, send results to the app, preview a sample, and add samples to a collection. It keeps database ownership, playback, and UI control in the desktop app.

## Architecture

The desktop app owns the database, local API, playback, and UI command queue. The MCP server reads the connection manifest, validates it, then calls `http://127.0.0.1:37421/v1` with bearer authentication. It does not read the SQLite database, audio files, or other sample files directly.

The app creates a new bearer token and instance ID at each start. Before every request, the MCP server checks that the manifest PID is still alive. After a `401`, it reloads the manifest and retries once only if the instance ID changed.

## Quick start

1. Install Node.js 20 or newer and run the project bootstrap if needed.
2. Install the MCP package dependencies, then build the entry point from the repository root:

   ```bash
   npm ci --prefix mcp-server
   npm run mcp:build
   ```

3. Start the desktop app before starting the MCP host. The app creates and owns the connection manifest.
4. Set the manifest path in the environment that starts the MCP host:

   ```bash
   export OPEN_SAMPLE_MANAGER_CONNECTION_FILE="/absolute/path/to/localhost-api-connection.json"
   ```

   `OPEN_SAMPLE_MANAGER_CONNECTION_FILE` points to the app-created secret manifest. `OPEN_SAMPLE_MANAGER_MCP_DIR` is a convenience variable used by the sample host configurations for the checkout path:

   ```bash
   export OPEN_SAMPLE_MANAGER_MCP_DIR="/absolute/path/to/open-sample-manager/mcp-server"
   ```

5. Configure your host to run `node` with `dist/stdio.js`. See the exact [Claude Code configuration](../../mcp-server/README.md#claude-code) and [OpenCode configuration](../../mcp-server/README.md#opencode) in the package README. It also lists the current app manifest paths and low-level stdio details.

## MCP host configuration

The MCP entry point is `mcp-server/dist/stdio.js`, and the package bin name is `open-sample-manager-mcp`. Configure the manifest path through `OPEN_SAMPLE_MANAGER_CONNECTION_FILE`, not by copying manifest contents into a configuration file. `OPEN_SAMPLE_MANAGER_MCP_DIR` is optional and only supplies the checkout path in the sample host configurations.

The server writes MCP protocol messages only to stdout. Diagnostics go to stderr. Keep the desktop app running on the same machine and in the same user session as the MCP host.

## Tools

All tool inputs are JSON objects. Extra fields are rejected.

| Tool | Inputs | Behavior |
| --- | --- | --- |
| `search_samples` | Optional structured filters, including `query`, sample type, instrument, BPM range, key, tags, directory path, limit, and offset | Searches the local indexed library. |
| `get_sample` | `sample_id` | Returns one redacted sample record. |
| `find_similar_samples` | `sample_id`, `limit`, optional `exclude_duplicates` | Finds embedding-based neighbors for a library sample. |
| `show_samples_in_app` | Ordered `sample_ids`, optional `selected_id` | Queues the IDs as the desktop app's displayed result set. Omitting `selected_id` selects the first supplied ID. |
| `preview_sample` | `sample_id` | Queues one desktop preview. |
| `add_to_collection` | `collection_name`, ordered `sample_ids` | Atomically creates or reuses a named collection and adds the IDs in the supplied order. Existing memberships are not duplicated. |
| `list_midis` | Optional `directory_path`, `tag_id`, `limit`, and `offset` | Lists MIDI files with metadata and their current tag. |
| `list_midi_tags` | None | Lists tags available for MIDI classification. |
| `create_midi_tag` | `name` | Creates a MIDI classification tag. |
| `update_midi_tags` | 1 to 100 `{ midi_id, tag_id }` assignments | Assigns one tag to each specified MIDI file. |

### Queued desktop actions

`show_samples_in_app` changes the result set but does not play a sample or open files. `preview_sample` selects and plays exactly one sample from the beginning. It stops current playback first and works whether normal auto-play is on or off.

The local API returns HTTP `202 Accepted` after queue admission, and the MCP tool call returns the accepted response body. The desktop renderer executes the action asynchronously. If the renderer is unavailable, accepted show and preview commands remain pending.

The UI command queue holds 64 commands. A full queue rejects `show_samples_in_app`, `preview_sample`, and `add_to_collection`. A rejected collection request does not write any collection change.

## Limits and requirements

- Queries are limited to 512 characters.
- Text fields, including collection names and structured text filters, are limited to 128 characters.
- `sample_ids` must contain 1 to 100 unique positive sample IDs. If supplied, `selected_id` must be one of those IDs.
- Result `limit` values range from 1 to 100. Search `offset` ranges from 0 to 10000.
- Search accepts at most 100 tags, and each tag has the 128 character text limit.
- JSON request bodies are limited to 64 KiB where the local API accepts a body.
- Results come from the local indexed library. Samples must be scanned, and missing or offline files cannot be previewed.
- Similarity requires an embedding for the source sample. It does not fall back to semantic text search.
- Collections only add ordered sample IDs. The integration does not support collection rename, deletion, or direct database access.

## Security model

The local API is fixed to `http://127.0.0.1:37421/v1` and accepts bearer authentication only. It is not available as a LAN, browser, CORS, or remote service. On Unix, the app writes the manifest with owner-only permissions.

Treat the connection manifest as a secret because it contains the current bearer token. Don't copy it into prompts, logs, repositories, shell history, or MCP configuration. Configure only its path through `OPEN_SAMPLE_MANAGER_CONNECTION_FILE`.

The manifest validation rejects changed hosts, schemes, ports, paths, credentials, queries, and fragments. The MCP server never opens a network listener or installs a background service.

## Troubleshooting

### The app is not running

Start Open Sample Manager, wait for launch to finish, then retry. Confirm that `OPEN_SAMPLE_MANAGER_CONNECTION_FILE` points to the manifest for that app instance. A dead manifest PID stops the request before any bearer value is sent.

### Authentication or stale manifest error

Restart the desktop app so it writes a new manifest with a new token and instance ID. Check the manifest path and its permissions, then restart the MCP host if the problem remains.

### The MCP host cannot start the server

Run `npm ci --prefix mcp-server` and `npm run mcp:build` from the repository root. Check that the configured `dist/stdio.js` path exists and that `OPEN_SAMPLE_MANAGER_CONNECTION_FILE` points to the app-created manifest. If your host configuration uses `OPEN_SAMPLE_MANAGER_MCP_DIR`, confirm that it expands to this checkout's `mcp-server` directory.

### Port conflict when the app starts

The desktop app needs `127.0.0.1:37421`. Stop the process using that loopback port, then start the app again. Don't change the endpoint or edit the manifest to another URL because the MCP client rejects alternate endpoints.

### A show or preview action is not visible

An accepted request only confirms queue admission. Open the desktop app's renderer to process pending commands. If the queue is full, wait for it to drain, then retry the action.

## Development checks

Run these commands from the repository root after changing the MCP package:

```bash
npm run mcp:typecheck
npm run mcp:test
npm run mcp:build
npm run mcp:ci
```

For the package's exact host JSON, current app manifest locations, and transport details, see the [MCP server README](../../mcp-server/README.md).
