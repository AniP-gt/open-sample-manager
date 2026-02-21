# open-sample-manager

Open Sample Manager development workspace for:

- Rust core (`core/`)
- React + TypeScript UI (`ui/`)
- Tauri desktop app (`src-tauri/`)
- JUCE plugin scaffold (`plugin/`)

## Prerequisites (macOS)

- Xcode Command Line Tools
  - `xcode-select --install`
- Rust via rustup (stable channel)
  - `curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh`
- Node.js 20 LTS or later (includes npm)
- CMake 3.22 or later

## Bootstrap

Run the bootstrap script from the repository root:

```bash
./scripts/bootstrap.sh
```

This script checks required commands and installs UI dependencies.

## Daily development

### Tauri Desktop App

- Start development server:

```bash
npm run tauri:dev
```

- Build production app:

```bash
npm run tauri:build
```

### Rust Core

- Check:

```bash
cargo check --workspace
```

- Tests:

```bash
cargo test --workspace
```

### UI (standalone web)

- Dev server:

```bash
npm run dev --prefix ui
```

- Type check:

```bash
npm run typecheck --prefix ui
```

- Build:

```bash
npm run build --prefix ui
```

## JUCE plugin scaffold

Plugin CMake project is initialized in `plugin/CMakeLists.txt`.

Configure with your JUCE checkout path:

```bash
cmake -S plugin -B plugin/build -DJUCE_SOURCE_DIR=/path/to/JUCE
cmake --build plugin/build
```

If `JUCE_SOURCE_DIR` is not provided, CMake creates a stub target and prints guidance.
