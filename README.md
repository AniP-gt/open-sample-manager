# Open Sample Manager

<img width="1680" height="986" alt="README" src="https://github.com/user-attachments/assets/19c99f96-f5c4-43ae-94f8-271d9c8413e0" />

A fast, local-first desktop application for managing audio samples and MIDI files. Built with Rust, Tauri, and React.

[日本語ドキュメント](docs/ja/README.md)

> **Status:** Developer preview. This project is currently distributed as source code only. Official signed installers are not available yet.

> **Platform status:** The codebase and Tauri packaging are intended for macOS,
> Windows, and Linux, but development and runtime verification currently focus on
> macOS. Windows and Linux builds are experimental and may have platform-specific
> limitations; see [Platform Support](#platform-support).

![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Linux%20%7C%20Windows-blue)
![License](https://img.shields.io/github/license/AniP-gt/open-sample-manager)

## Features

Feature guides:

- [Feature overview](docs/features/README.md)
- [Audio sample management](docs/features/audio-sample-management.md)
- [MIDI file management](docs/features/midi-file-management.md)
- [Search and organization](docs/features/search-and-organization.md)
- [Preview sync and drag export](docs/features/preview-sync-and-drag-export.md)
- [Settings and local data](docs/features/settings-and-local-data.md)
- [Local API and MCP setup](docs/integrations/mcp.md)

### Audio Sample Management

<img width="1680" height="981" alt="Sample-List" src="https://github.com/user-attachments/assets/06af7071-a93a-4733-b5d0-454d84d90860" />

<img width="747" height="671" alt="Similar-list" src="https://github.com/user-attachments/assets/8dda7943-d2e2-4651-b1b6-075ec5665582" />

- **Directory scanning** — recursively scan folders and index WAV, MP3, FLAC, and Ogg files
- **Automatic analysis** — BPM estimation, kick detection, loop/one-shot classification, waveform peaks
- **Sample quality checks**: peak, RMS, leading silence, clipping, channel count, and bit depth flags are captured during scan
- **Full-text search** — fast FTS5-powered search over filenames and metadata
- **Advanced search DSL** — combine free text with filters such as `bpm:120-180`, `type:oneshot`, `tag:metal`, `key:Am`, `instrument:kick`, and negative terms like `-rimshot`
- **Similarity search** — embedding-based "find similar samples" lookup
- **Duplicate detection** — group exact duplicate audio files by content hash and hide duplicate rows from the sample list
- **Random discovery**: pick a random sample from the current result set, step back through random picks, or jump to a random similar sample. See [Random Inspiration](docs/random-inspiration.md).
- **Filter sidebar** — filter by instrument type, sample type, BPM range, and duplicate status
- **Waveform display** — inline waveform preview in the detail panel
- **Drag to DAW** — drag samples directly from the app into your DAW
- **Processed drag export** — with auto-play off, open `CONTROLS` in the player bar to set trim, fade, and gain before dragging a rendered WAV into your DAW

### MIDI File Management

<img width="1680" height="989" alt="MIDI-list" src="https://github.com/user-attachments/assets/7758e236-b832-48d2-8635-45e1a527de1a" />

- **MIDI directory scanning** — index MIDI files alongside audio samples
- **MIDI playback** — play MIDI files via TiMidity++ (see [MIDI Playback Setup](#midi-playback-setup))
- **Phrase classification**: filter MIDI by musical role, voicing, density, range, bar count, and suggested General MIDI instrument family
- **Tag system** — create and assign custom tags to MIDI files
- **Search** — full-text search over MIDI filenames

### Organization
- **Instrument type management** — define and edit custom instrument type labels
- **Classification editing** — override auto-detected playback type and instrument type per sample
- **License and source metadata**: track source, pack name, license, license URL, memo, and import date for each sample
- **Duplicate visibility controls** — keep every scanned file in the library while hiding repeated content from day-to-day browsing
- **Persistent SQLite database** — all metadata stored locally, no cloud dependency
- **Library migration** — export the local metadata database from Settings and import it on another PC

See [Sample Metadata and Quality Checks](docs/sample_metadata_quality.md) for the stored fields, UI behavior, and analysis notes.
For implementation details, see [Duplicate Detection](docs/duplicate-detection.md).
See [Advanced Search DSL](docs/advanced_search_dsl.md) for the supported sample search syntax and examples.

### MCP integration

Use the local Node.js stdio MCP server to search the indexed library, find similar samples, send results to the desktop app, preview a sample, and add samples to a collection. See the [MCP integration guide](docs/integrations/mcp.md) for setup and behavior, or the [MCP server README](mcp-server/README.md) for exact host configuration.

---

## Prerequisites

### macOS

- **Xcode Command Line Tools**: `xcode-select --install`
- **Rust** (stable): `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
- **Node.js 20 LTS** or later
- **CMake 3.22** or later

### Linux

- Rust (stable): `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
- Node.js 20 LTS or later
- CMake 3.22 or later
- Tauri system dependencies: see [Tauri Linux prerequisites](https://tauri.app/start/prerequisites/#linux)

### Windows

- Rust (stable): install via [rustup.rs](https://rustup.rs)
- Node.js 20 LTS or later
- CMake 3.22 or later
- Microsoft C++ Build Tools (via Visual Studio Installer)

---

## One-Step Install

These scripts install/check the build tools, install project dependencies, run basic checks, and build a local desktop package.

### macOS

```bash
./install.sh --yes
```

Without `--yes`, the script tells you what is missing and asks you to install system tools yourself. It can install Homebrew packages for Rust, Node.js, CMake, and TiMidity++ when Homebrew is available.

If Homebrew is missing, `--yes` also runs the official Homebrew installer from `https://brew.sh/`.

### Windows

Open PowerShell from the repository folder and run:

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1 -Yes
```

The Windows script uses `winget` for Rust, Node.js, CMake, and Visual Studio Build Tools when possible. TiMidity++ installation depends on Chocolatey or a manual Windows install.

With `-Yes`, the script can install Chocolatey through `winget` and then use Chocolatey to install TiMidity++.

### Linux

```bash
./install.sh --check-only
```

Linux package names differ by distribution, so the script checks tools and prints missing system packages. Install the Tauri Linux prerequisites manually, then run `./install.sh --skip-build` or `./install.sh`.

### Check Only

To see what would be needed without installing dependencies or building:

```bash
./install.sh --check-only
```

```powershell
powershell -ExecutionPolicy Bypass -File .\install.ps1 -CheckOnly
```

Use `--skip-build` on macOS/Linux or `-SkipBuild` on Windows if you only want to install dependencies and run checks first.

These scripts run package managers plus `npm install`, `cargo check`, and the Tauri build command. Review the source before running them if you are installing from an untrusted checkout.

---

## Getting Started For Developers

Run the bootstrap script from the repository root:

```bash
./scripts/bootstrap.sh
```

This checks required toolchain commands and installs UI dependencies.

### Start the desktop app (development)

```bash
npm run tauri:dev
```

### Build for production

```bash
npm run tauri:build
```

`npm run build:app` is an equivalent alias. Tauri writes the application and platform
packages under `target/release/bundle/` (for example, `macos/` and `dmg/` on macOS).
This creates a local build for your machine. It is not an official signed release build.

For the complete OS-specific prerequisites, build commands, output locations, and MIDI
playback setup, see [Build and MIDI Playback Setup](docs/build-and-midi-setup.md).

---

## Distribution Status

Open Sample Manager is source-only for now. If you want to try it, clone the repository and build it locally with the commands above.

Signed macOS, Linux, and Windows installers may come later, after the release pipeline is ready. Before publishing official binaries, the project needs release signing, macOS notarization, CI-backed builds, and a review of Tauri permissions and CSP settings.

Please don't redistribute local builds as official releases.

### Platform Support

Open Sample Manager is designed as a cross-platform Tauri application, but it has not
yet completed release-level verification on every supported operating system.

| Platform | Current status |
|---|---|
| macOS | Primary development and verification platform |
| Linux | Experimental; requires distribution-specific Tauri dependencies and runtime testing |
| Windows | Experimental; requires runtime testing and has known MIDI process-control limitations |

Most library management, database, analysis, search, and playback UI code is portable.
Native file drag-out is currently implemented through macOS-only Tauri plugins, so
dragging samples or MIDI files from the app into another application may not work on
Windows or Linux. On Windows, starting MIDI playback is implemented, but stopping the
TiMidity++ child process still uses Unix-style process control and requires a
platform-specific implementation.

Before claiming full Windows or Linux support, the project needs native builds and
smoke tests on those platforms, including file scanning, audio/MIDI playback, drag-out,
trash/open-folder operations, and installer packaging.

---

## Security Notes

Open Sample Manager is local-first. It stores metadata in a local SQLite database and doesn't require a cloud account.

Settings can export that metadata database as `samples.db` for PC migration. The export does not copy audio or MIDI files, so the files must exist at the same paths on the target computer before imported metadata can resolve them.

During the developer preview, review the source and build locally if you want to test the app. The Tauri permission model, asset access, and installer signing are still being hardened before public binary releases.

---

## MIDI Playback Setup

MIDI playback requires **TiMidity++**, a free software MIDI synthesizer. TiMidity++ is
not bundled with the application: each user must install it separately. The app detects
the executable through the process `PATH` and common platform-specific locations; the
Settings panel shows installation status and instructions.

### Install TiMidity++

**macOS (Homebrew)**
```bash
brew install timidity
```

**macOS (Nix/nix-darwin)**: install the `timidity` package in your system environment.
The app directly checks `/run/current-system/sw/bin/timidity`, so a Finder- or
Dock-launched app does not need to inherit the Nix shell `PATH`.

**Linux (Debian/Ubuntu)**
```bash
sudo apt-get install timidity timidity-daemon freepats
```

**Linux (Fedora/RHEL)**
```bash
sudo dnf install timidity++
```

**Linux (Arch)**
```bash
sudo pacman -S timidity++
```

**Windows — Chocolatey**
```powershell
choco install timidity
```

**Windows — MSYS2**
```bash
pacman -S mingw-w64-x86_64-timidity++
```

**Windows — manual**: download a Windows build from [TiMidity++ SourceForge](https://sourceforge.net/projects/timidity/) and add the install directory to your `PATH`.

---

### Soundfont Configuration

TiMidity++ requires a **soundfont** (instrument sample bank) to synthesize audio. Most Linux packages install `freepats` automatically. On macOS and Windows you may need to configure one manually.

#### Get a free soundfont

| Soundfont | Size | Download |
|---|---|---|
| **GeneralUser GS** (recommended) | 31 MB | https://schristiancollins.com/generaluser.php |
| **FluidR3_GM** | 142 MB | https://member.keymusician.com/Member/FluidR3_GM/index.html |
| **freepats** | varies | included in most Linux `timidity` packages |

#### Configure TiMidity++ to use a soundfont

Edit the TiMidity++ config file for your platform and add a line pointing to your `.sf2` file:

```
soundfont /path/to/your/soundfont.sf2
```

**Config file locations by platform:**

| Platform | Config path |
|---|---|
| macOS — Homebrew (Apple Silicon) | `/opt/homebrew/etc/timidity/timidity.cfg` |
| macOS — Homebrew (Intel) | `/usr/local/etc/timidity/timidity.cfg` |
| macOS — MacPorts | `/opt/local/etc/timidity.cfg` |
| Linux | `/etc/timidity/timidity.cfg` or `/etc/timidity.cfg` |
| Windows — Chocolatey | `C:\ProgramData\timidity\timidity.cfg` |
| Windows — MSYS2 | `C:\msys64\mingw64\etc\timidity\timidity.cfg` |

**Minimal `timidity.cfg` example:**

```
# timidity.cfg
soundfont /Users/you/soundfonts/GeneralUser_GS.sf2
```

#### Where the app searches for the TiMidity++ binary

The app searches these paths in addition to `PATH`:

| Platform | Paths searched |
|---|---|
| macOS | `/run/current-system/sw/bin/timidity`, `/opt/homebrew/bin/timidity`, `/usr/local/bin/timidity`, `/opt/local/bin/timidity` |
| Linux | `/usr/bin/timidity`, `/usr/local/bin/timidity`, `/snap/bin/timidity`, `/opt/timidity/bin/timidity` |
| Windows | `C:\Program Files\timidity\timidity.exe`, `C:\Program Files (x86)\timidity\timidity.exe`, `C:\msys64\mingw64\bin\timidity.exe`, `C:\chocolatey\bin\timidity.exe` |

If TiMidity++ is installed elsewhere, add its directory to the OS-level environment
`PATH`. Shell-only configuration such as `.zshrc` or `.bashrc` may not be inherited by
applications launched from Finder, Dock, or a Linux desktop menu. On Windows, restart
Open Sample Manager after changing the user or system `Path` environment variable.

See [Build and MIDI Playback Setup](docs/build-and-midi-setup.md) for verification and
troubleshooting commands.

---

## Development

### Rust core

```bash
cargo check --workspace
cargo test --workspace
```

### UI (standalone, no Tauri)

```bash
npm run dev --prefix ui        # dev server on port 5174
npm run typecheck --prefix ui
npm run test --prefix ui
npm run build --prefix ui
```

### MCP server

```bash
npm ci --prefix mcp-server
npm run mcp:typecheck
npm run mcp:test
npm run mcp:build
npm run mcp:ci
```

### Before opening a PR

Run the checks that match your change. For a general change, use:

```bash
cargo test --workspace
npm run typecheck --prefix ui
npm run test --prefix ui
npm run build --prefix ui
```

The JUCE plugin scaffold doesn't need to be built unless your change touches `plugin/`.

### JUCE plugin scaffold

The `plugin/` directory contains a CMake scaffold. To build against a JUCE checkout:

```bash
cmake -S plugin -B plugin/build -DJUCE_SOURCE_DIR=/path/to/JUCE
cmake --build plugin/build
```

If `JUCE_SOURCE_DIR` is not provided, CMake creates a stub target. Full plugin functionality is not yet implemented.

---

## Architecture

```
open-sample-manager/
├── core/        # Rust library — analysis, scanning, SQLite, FFI
├── src-tauri/   # Tauri shell — IPC command layer, app state
├── ui/          # React + TypeScript frontend
├── mcp-server/  # Node.js stdio MCP server for the running desktop app
├── plugin/      # JUCE CMake scaffold (stub)
└── scripts/     # Bootstrap tooling
```

- **core** — pure Rust library exposing `SampleManager` as the orchestration entry point. Also provides a C FFI interface for future plugin use.
- **src-tauri** — thin Tauri command layer wrapping core APIs. All long-running work runs in `tokio::task::spawn_blocking`.
- **ui** — React SPA communicating with Tauri via typed `invoke()` calls. No generated types; mapping is explicit in `App.tsx`.
- **mcp-server**: Node.js stdio MCP server that reads the app connection manifest and calls its authenticated local API.

---

## License

MIT
