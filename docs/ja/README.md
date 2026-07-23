# Open Sample Manager 日本語ガイド

Open Sample Manager は、オーディオサンプルと MIDI ファイルを扱うローカルファーストのデスクトップアプリです。Rust、Tauri、React で作られています。

[English README](../../README.md)

> **状態:** 開発者向けプレビューです。現在はソースコードのみで配布しており、公式の署名済みインストーラーはありません。

> **対応プラットフォーム:** macOS、Windows、Linux 向けに作られていますが、開発と実行確認の中心は macOS です。Windows と Linux のビルドは実験的で、プラットフォーム固有の制限があります。

## ガイド

- [機能一覧](features/README.md)
- [オーディオサンプル管理](features/audio-sample-management.md)
- [MIDI ファイル管理](features/midi-file-management.md)
- [検索と整理](features/search-and-organization.md)
- [プレビュー同期とドラッグ書き出し](features/preview-sync-and-drag-export.md)
- [設定とローカルデータ](features/settings-and-local-data.md)
- [ビルドと MIDI 再生の設定](build-and-midi-setup.md)
- [高度な検索 DSL](advanced_search_dsl.md)
- [重複検出](duplicate-detection.md)
- [サンプルメタデータと品質チェック](sample_metadata_quality.md)
- [ランダム発見](random-inspiration.md)
- [MCP 連携](integrations/mcp.md)

## 主な機能

- フォルダーを再帰的にスキャンし、WAV、MP3、FLAC、Ogg、AIFF のファイルをライブラリへ登録
- BPM、キー、キック検出、ループまたはワンショット分類、波形ピークを自動解析
- ファイル名、タグ、メタデータの検索、フィルター、類似サンプル検索、完全一致の重複検出
- オーディオと MIDI のプレビュー、DAW へのドラッグ、サンプルの加工済み WAV ドラッグ書き出し
- MIDI タグ、編集可能な楽器ラベル、ライセンスと出所のメタデータ、ローカル SQLite ライブラリの移行

## はじめに

必要なツールは Rust stable、Node.js 20 LTS 以降、npm、CMake 3.22 以降です。macOS では Xcode Command Line Tools、Linux では [Tauri の Linux 前提条件](https://tauri.app/start/prerequisites/#linux)、Windows では Visual Studio Installer から Microsoft C++ Build Tools も必要です。

リポジトリのルートで依存関係を確認して UI 依存関係を入れるには、次を実行します。

```bash
./scripts/bootstrap.sh
```

開発版を起動します。

```bash
npm run tauri:dev
```

ローカルの配布パッケージを作成します。

```bash
npm run tauri:build
```

`npm run build:app` も同じビルド用エイリアスです。Tauri は `target/release/bundle/` の下に出力します。これはローカルビルドであり、公式の署名済みリリースではありません。OS 別の要件、出力先、TiMidity++ の設定は[ビルドと MIDI 再生の設定](build-and-midi-setup.md)を参照してください。

macOS と Linux では `./install.sh --check-only`、Windows PowerShell では `powershell -ExecutionPolicy Bypass -File .\install.ps1 -CheckOnly` を使って必要なものだけ確認できます。スクリプトはパッケージマネージャー、`npm install`、`cargo check`、Tauri ビルドを実行します。信頼できないチェックアウトから実行する場合は、先にソースを確認してください。

## MIDI 再生

MIDI の再生には、別途 **TiMidity++** を入れる必要があります。アプリには同梱されません。設定パネルではインストール状態と案内を確認できます。詳細なインストール手順、soundfont の設定、実行ファイルの探索場所は[ビルドと MIDI 再生の設定](build-and-midi-setup.md)にあります。

## ローカルデータとプラットフォームの注意点

メタデータはローカルの SQLite データベースに保存され、クラウドアカウントは不要です。設定から `samples.db` を書き出して別の PC へ取り込めますが、オーディオと MIDI のファイル自体はコピーされません。取り込み先には、参照されるファイルが同じパスに存在する必要があります。

ネイティブのファイルドラッグは現在 macOS 専用の Tauri プラグインで実装されています。そのため、Windows と Linux では別のアプリへのサンプルまたは MIDI のドラッグが動作しない場合があります。Windows では MIDI 再生の開始はできますが、TiMidity++ プロセスの停止にはプラットフォーム固有の対応が必要です。

## MCP 連携

ローカルの Node.js stdio MCP サーバーを使うと、登録済みライブラリの検索、類似サンプル検索、デスクトップアプリへの結果送信、プレビュー、コレクションへの追加ができます。設定と動作は [MCP 連携ガイド](integrations/mcp.md)、ホスト設定の正確な内容は[英語版 MCP サーバー README](../../mcp-server/README.md)を参照してください。
