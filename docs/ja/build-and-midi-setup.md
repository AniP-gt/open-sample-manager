# ビルドと MIDI 再生の設定

Open Sample Manager は現在、ソースコードとして配布されています。このガイドでは、ローカルのデスクトップアプリをビルドする方法と、MIDI 再生に使う外部依存関係 TiMidity++ を設定する方法を説明します。

## プラットフォーム対応状況

このプロジェクトは macOS、Windows、Linux でビルドできるように作られていますが、現在の主要な開発および検証プラットフォームは macOS です。Windows と Linux は、各 OS でネイティブビルドと実行時スモークテストが定期的に行われるまで、実験的な対応として扱ってください。

macOS 以外で判明している制限です。

- ネイティブのファイルドラッグは、現在 macOS でのみ Tauri に登録されるプラグインを使います。
- Windows の MIDI 再生では TiMidity++ を開始できますが、子プロセスの停止は Unix 形式のプロセス制御を使っており、Windows 向けの実装が必要です。
- Linux には、ディストリビューション固有の WebKitGTK などの Tauri システムパッケージが必要です。
- これらのプラットフォーム向けには、現時点で CI ビルドマトリクスも公式の署名済みインストーラーパイプラインもありません。

ライブラリ管理、SQLite 永続化、解析、検索、UI の大半は移植性を考慮して書かれていますが、ネイティブ OS での検証に代わるものではありません。

## ビルドの前提条件

すべてのプラットフォームで必要です。

- Rust stable と Cargo
- Node.js 20 LTS 以降と npm
- CMake 3.22 以降

プラットフォーム固有の要件です。

- macOS: Xcode Command Line Tools (`xcode-select --install`)
- Linux: [Tauri の Linux 前提条件](https://tauri.app/start/prerequisites/#linux)にあるパッケージ
- Windows: Visual Studio Installer から入れる Microsoft C++ Build Tools

TiMidity++ はアプリのコンパイルには任意ですが、MIDI 再生には実行時に必要です。

## デスクトップアプリをビルドする

リポジトリのルートで、プラットフォームヘルパーを使って依存関係を入れるか確認します。

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

macOS または Linux では、`./scripts/bootstrap.sh` を使ってツールチェーンを確認し、UI 依存関係を入れることもできます。

開発ビルドを開始します。

```bash
npm run tauri:dev
```

本番パッケージを作成します。

```bash
npm run tauri:build
```

`npm run build:app` は同じ本番ビルド用エイリアスです。Tauri は `target/release/bundle/` の下に結果を出力します。プラットフォームのサブディレクトリは、macOS の `macos/` と `dmg/`、Windows のインストーラー形式、Linux の設定済みパッケージ形式のように、現在の OS によって異なります。

これらは署名されていないローカルビルドです。公式リリース成果物ではなく、プラットフォームのセキュリティ警告が表示される場合があります。

## TiMidity++ を入れる

TiMidity++ はユーザーが入れるもので、Open Sample Manager のアプリケーションパッケージには含まれません。

### macOS

Homebrew:

```bash
brew install timidity
```

Nix または nix-darwin では、適切なシステムパッケージ設定に `timidity` を追加します。生成された `/run/current-system/sw/bin/timidity` はアプリが直接検出します。

### Debian と Ubuntu

```bash
sudo apt-get install timidity timidity-daemon freepats
```

### Fedora と RHEL

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

手動で入れる場合は、`timidity.exe` を下記のいずれかの場所に置くか、そのディレクトリを Windows のユーザーまたはシステム `Path` に追加します。`Path` を変更した後は Open Sample Manager を再起動してください。

## 実行ファイルの検出

アプリは最初に環境 `PATH` を検索し、その後で次の場所を確認します。

| プラットフォーム | 場所 |
|---|---|
| macOS | `/run/current-system/sw/bin/timidity`, `/opt/homebrew/bin/timidity`, `/usr/local/bin/timidity`, `/opt/local/bin/timidity` |
| Linux | `/usr/bin/timidity`, `/usr/local/bin/timidity`, `/snap/bin/timidity`, `/opt/timidity/bin/timidity` |
| Windows | `C:\Program Files\timidity\timidity.exe`, `C:\Program Files (x86)\timidity\timidity.exe`, `C:\msys64\mingw64\bin\timidity.exe`, `C:\chocolatey\bin\timidity.exe` |

Finder、Dock、Linux のデスクトップメニューから起動したアプリケーションは、`.zshrc`、`.bashrc`、その他の対話シェル設定だけで変更した PATH を引き継がない場合があります。上記の標準的な場所を使うか、OS レベルの環境を設定してください。

端末から次のコマンドでインストールを確認します。

```bash
command -v timidity
timidity --version
```

Windows PowerShell では次を使います。

```powershell
Get-Command timidity
timidity --version
```

端末で TiMidity++ が見つかるのにアプリでは見つからない場合は、解決された場所を上の表と比較してください。標準以外の場所は、対話シェルだけでなくデスクトップアプリケーションの環境でも利用できる必要があります。

## Soundfont の設定

実行ファイルの検出と楽器音の設定は別です。TiMidity++ には MIDI 音声を合成するための soundfont またはパッチセットが必要です。推奨の soundfont とプラットフォーム別の `timidity.cfg` の場所は、[英語版 README の MIDI 再生設定](../../README.md#midi-playback-setup)を参照してください。
