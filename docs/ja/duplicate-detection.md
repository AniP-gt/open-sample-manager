# 重複検出

Open Sample Manager は、サンプル解析中に完全に同一のオーディオファイルを検出できます。この機能はローカルファーストで、重複メタデータをサンプルライブラリと同じ SQLite データベースに保存し、ファイル内容やハッシュをアップロードしません。

## ユーザー向けの動作

- スキャンされたオーディオファイルには、ファイルのバイト列から求めた `content_hash` が付与されます。
- 空でない `content_hash` が同じサンプルは、完全な重複として扱われます。
- サンプルリストでは、各重複グループの先頭の表示サンプルを残し、繰り返された行を隠せます。
- 非表示の重複は削除されません。登録済みで検索可能なままで、重複フィルターをオフにすれば表示されます。
- サンプル行には重複数が含まれるため、UI は追加スキャンなしで行を表示またはフィルターできます。

これは完全なファイル内容一致です。似た音、ピッチを変更したサンプル、トリミングしたクリップ、コンテナメタデータだけが異なる同一音声のファイルは検出しません。

## 仕組み

Rust の解析パイプラインは、解析する各サンプルファイルについてストリーミング FNV-1a 64 ビットハッシュを計算します。ハッシュは `samples.content_hash` 列に保存され、重複検索用にインデックスされます。

データベース層は、複数行に存在する NULL 以外のハッシュを選択して重複グループを公開します。各グループには次が含まれます。

- `content_hash`
- `sample_count`
- `total_file_size`
- そのグループ内のサンプル行

Tauri コマンド層は `list_duplicate_groups` を通じて公開し、他のサンプル API と同じ薄いコマンドラッパーのパターンを保ちます。

React UI はバックエンド行の `content_hash` と `duplicate_count` を `Sample` オブジェクトにマッピングします。`hideDuplicates` フィルターは、各重複ハッシュについて最初に読み込んだ行を残し、後続の行を表示サンプルリストから外します。

## 重要な制限

- ハッシュはローカルの重複グループ化用であり、セキュリティ検証用ではありません。
- 既存のライブラリでは、古い行に `content_hash` 値が付くまでサンプルを再解析する必要があります。
- 重複の非表示は、現在の UI 状態で読み込まれたサンプル行に適用されます。
- 近い重複の検出は、埋め込みベースの類似性ワークフローの対象です。

## 開発者向けの注記

主な実装箇所は次のとおりです。

- `core/src/db/schema.rs` は `content_hash` とコンテンツハッシュのインデックスを追加します。
- `core/src/db/operations/samples/queries.rs` は `duplicate_count` を計算し、重複グループを列挙します。
- `core/src/manager/analyze.rs` はサンプル解析中にファイル内容のハッシュを計算します。
- `core/src/manager/samples.rs` と `src-tauri/src/main.rs` は、マネージャーと IPC 境界を通じて重複グループを公開します。
- `ui/src/hooks/useDisplayedSamples.ts` は重複非表示フィルターを適用します。
- `ui/src/components/FilterSidebar/FilterSidebar.tsx` は重複表示切り替えを描画します。

関連するチェックです。

```bash
cargo test --workspace
npm run typecheck --prefix ui
npm run test --prefix ui
npm run build --prefix ui
```
