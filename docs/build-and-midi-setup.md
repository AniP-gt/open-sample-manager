# Build and MIDI Playback Setup

Open Sample Manager is currently distributed as source code. This guide explains how
to build a local desktop application and configure the external TiMidity++ dependency
used for MIDI playback.

## Platform Support Status

The project is intended to build on macOS, Windows, and Linux, but macOS is currently
the primary development and verification platform. Windows and Linux support should be
treated as experimental until native builds and runtime smoke tests are regularly run
on those systems.

Known limitations outside macOS:

- Native file drag-out uses Tauri plugins that are currently registered only on macOS.
- Windows MIDI playback can start TiMidity++, but stopping the child process still uses
  Unix-style process control and needs a Windows-specific implementation.
- Linux requires distribution-specific WebKitGTK and other Tauri system packages.
- There is currently no CI build matrix or official signed installer pipeline for these
  platforms.

Core library management, SQLite persistence, analysis, search, and most UI behavior are
written portably, but this does not replace native operating-system verification.

## Build Prerequisites

All platforms require:

- Rust stable and Cargo
- Node.js `^20.19.0 || >=22.12.0` and npm
- CMake 3.22 or later

Platform-specific requirements:

- macOS: Xcode Command Line Tools (`xcode-select --install`)
- Linux: the packages listed in the
  [Tauri Linux prerequisites](https://tauri.app/start/prerequisites/#linux)
- Windows: Microsoft C++ Build Tools installed through Visual Studio Installer

TiMidity++ is optional for compiling the application, but required at runtime for MIDI
playback.

## Build the Desktop Application

From the repository root, install/check dependencies with the platform helper:

```bash
# macOS or Linux
./install.sh --check-only
./install.sh --skip-build
```

```powershell
# Windows PowerShell
powershell -ExecutionPolicy Bypass -File .\install.ps1 -CheckOnly
powershell -ExecutionPolicy Bypass -File .\install.ps1 -SkipBuild
```

Alternatively, use `./scripts/bootstrap.sh` on macOS or Linux to check the toolchain and
install the UI dependencies.

Start a development build with:

```bash
npm run tauri:dev
```

Create a production package with:

```bash
npm run tauri:build
```

`npm run build:app` is an equivalent production-build alias. Tauri places build results
under `target/release/bundle/`. The platform subdirectories depend on the current OS,
such as `macos/` and `dmg/` on macOS, installer formats on Windows, and configured Linux
package formats on Linux.

These are unsigned local builds. They are not official release artifacts and may trigger
platform security warnings.

## Install TiMidity++

TiMidity++ is installed by the user and is not embedded in the Open Sample Manager
application package.

### macOS

Homebrew:

```bash
brew install timidity
```

For Nix or nix-darwin, add `timidity` to the appropriate system package configuration.
The resulting `/run/current-system/sw/bin/timidity` is detected directly by the app.

### Debian and Ubuntu

```bash
sudo apt-get install timidity timidity-daemon freepats
```

### Fedora and RHEL

```bash
sudo dnf install timidity++
```

### Arch Linux

```bash
sudo pacman -S timidity++
```

### Windows

Chocolatey:

```powershell
choco install timidity
```

MSYS2:

```bash
pacman -S mingw-w64-x86_64-timidity++
```

For a manual installation, place `timidity.exe` in one of the locations listed below or
add its containing directory to the Windows user or system `Path`. Restart Open Sample
Manager after changing `Path`.

## Executable Detection

The app first searches the environment `PATH`, then checks these locations:

| Platform | Locations |
|---|---|
| macOS | `/run/current-system/sw/bin/timidity`, `/opt/homebrew/bin/timidity`, `/usr/local/bin/timidity`, `/opt/local/bin/timidity` |
| Linux | `/usr/bin/timidity`, `/usr/local/bin/timidity`, `/snap/bin/timidity`, `/opt/timidity/bin/timidity` |
| Windows | `C:\Program Files\timidity\timidity.exe`, `C:\Program Files (x86)\timidity\timidity.exe`, `C:\msys64\mingw64\bin\timidity.exe`, `C:\chocolatey\bin\timidity.exe` |

Applications launched from Finder, Dock, or a Linux desktop menu may not inherit PATH
changes made only in `.zshrc`, `.bashrc`, or another interactive-shell configuration.
Use a standard location above or configure the OS-level environment instead.

Verify an installation from a terminal with:

```bash
command -v timidity
timidity --version
```

On Windows PowerShell:

```powershell
Get-Command timidity
timidity --version
```

If the terminal finds TiMidity++ but the app does not, compare the resolved location
with the table above. A nonstandard location must be available in the environment of the
desktop application, not only in an interactive shell.

## Soundfont Configuration

Finding the executable is separate from configuring instrument sounds. TiMidity++ needs
a soundfont or patch set to synthesize MIDI audio. See the
[MIDI Playback Setup section in the README](../README.md#midi-playback-setup) for suggested
soundfonts and platform-specific `timidity.cfg` locations.
