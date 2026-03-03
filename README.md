# Open Sample Manager

A fast, local-first desktop application for managing audio samples and MIDI files. Built with Rust, Tauri, and React.

![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Linux%20%7C%20Windows-blue)
![License](https://img.shields.io/github/license/AniP-gt/open-sample-manager)

## Features

### Audio Sample Management
- **Directory scanning** — recursively scan folders and index WAV, MP3, FLAC, and Ogg files
- **Automatic analysis** — BPM estimation, kick detection, loop/one-shot classification, waveform peaks
- **Full-text search** — fast FTS5-powered search over filenames and metadata
- **Similarity search** — embedding-based "find similar samples" lookup
- **Filter sidebar** — filter by instrument type, sample type, BPM range
- **Waveform display** — inline waveform preview in the detail panel
- **Drag to DAW** — drag samples directly from the app into your DAW

### MIDI File Management
- **MIDI directory scanning** — index MIDI files alongside audio samples
- **MIDI playback** — play MIDI files via TiMidity++ (see [MIDI Playback Setup](#midi-playback-setup))
- **Tag system** — create and assign custom tags to MIDI files
- **Search** — full-text search over MIDI filenames

### Organization
- **Instrument type management** — define and edit custom instrument type labels
- **Classification editing** — override auto-detected playback type and instrument type per sample
- **Persistent SQLite database** — all metadata stored locally, no cloud dependency

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

## Getting Started

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

---

## MIDI Playback Setup

MIDI playback requires **TiMidity++**, a free software MIDI synthesizer. The app detects it automatically if installed; the Settings panel shows installation status and instructions.

### Install TiMidity++

**macOS (Homebrew)**
```bash
brew install timidity
```

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
| macOS | `/opt/homebrew/bin/timidity`, `/usr/local/bin/timidity`, `/opt/local/bin/timidity` |
| Linux | `/usr/bin/timidity`, `/usr/local/bin/timidity`, `/snap/bin/timidity`, `/opt/timidity/bin/timidity` |
| Windows | `C:\Program Files\timidity\timidity.exe`, `C:\Program Files (x86)\timidity\timidity.exe`, `C:\msys64\mingw64\bin\timidity.exe`, `C:\chocolatey\bin\timidity.exe` |

If TiMidity++ is installed elsewhere, add its directory to your system `PATH`.

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
├── plugin/      # JUCE CMake scaffold (stub)
└── scripts/     # Bootstrap tooling
```

- **core** — pure Rust library exposing `SampleManager` as the orchestration entry point. Also provides a C FFI interface for future plugin use.
- **src-tauri** — thin Tauri command layer wrapping core APIs. All long-running work runs in `tokio::task::spawn_blocking`.
- **ui** — React SPA communicating with Tauri via typed `invoke()` calls. No generated types; mapping is explicit in `App.tsx`.

---

## License

MIT
