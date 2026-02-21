# open-sample-manager

Open Sample Manager development workspace for:

- Rust core (`core/`)
- React + TypeScript UI (`ui/`)
- JUCE plugin scaffold (`plugin/`)

## Prerequisites (macOS)

- Xcode Command Line Tools
  - `xcode-select --install`
- Rust via rustup
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

- Rust core check:

```bash
cargo check --workspace
```

- Rust tests:

```bash
cargo test --workspace
```

- UI dev server:

```bash
npm run dev --prefix ui
```

- UI type check:

```bash
npm run typecheck --prefix ui
```

## JUCE plugin scaffold

Plugin CMake project is initialized in `plugin/CMakeLists.txt`.

Configure with your JUCE checkout path:

```bash
cmake -S plugin -B plugin/build -DJUCE_SOURCE_DIR=/path/to/JUCE
cmake --build plugin/build
```

If `JUCE_SOURCE_DIR` is not provided, CMake creates a stub target and prints guidance.
