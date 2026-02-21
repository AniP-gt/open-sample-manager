# Open Sample Manager (仮称)

**Logic Pro対応 / AUプラグイン型 / OSS / ローカル特化サンプルマネージャー**

---

# 0. 設計思想

### A. ミニマル軽量主義

* クラウド無し
* 外部依存最小
* ローカル高速動作

### C. クリエイター特化

* DTM用途に最適化
* Kick/Loop自動解析
* BPMレンジ分類

### D. 将来商用拡張可能設計

* Core完全分離
* FFI境界明確化
* Embedding拡張可能

---

# 1. 技術スタック

## Core

* Rust 1.75+
* SQLite (rusqlite)
* rayon（並列処理）
* symphonia（音声デコード）
* hound（wav）
* rustfft
* aubio-rs（補助）
* serde
* thiserror

## Plugin

* JUCE 7+
* AU (AudioUnit v3)
* C++17
* Rust FFI

## UI

* React
* TypeScript
* WebView (JUCE内)

---

# 2. ディレクトリ構成

```
sample-manager/
│
├── core/
│   ├── src/
│   │   ├── scanner/
│   │   ├── analysis/
│   │   │   ├── onset.rs
│   │   │   ├── bpm.rs
│   │   │   ├── kick.rs
│   │   │   ├── loop_classifier.rs
│   │   │   └── fft_utils.rs
│   │   ├── db/
│   │   ├── search/
│   │   ├── embedding/
│   │   ├── threading/
│   │   └── ffi/
│   └── Cargo.toml
│
├── plugin/
│   ├── Source/
│   └── CMakeLists.txt
│
├── ui/
│   ├── src/
│   └── package.json
│
└── standalone/
```

---

# 3. オーディオ解析設計

---

# 3.1 前処理

## 3.1.1 モノラル化

[
x_m[n] = \frac{1}{C} \sum_{c=1}^{C} x_c[n]
]

---

## 3.1.2 ダウンサンプリング

目標: 11025Hz

[
x_d[n] = x_m[nR]
]

R = round(original_sr / 11025)

---

## 3.1.3 正規化

[
x_n[n] = \frac{x_d[n]}{\max(|x_d|)}
]

---

# 3.2 Onset検出

フレーム長 ( N = 1024 )
ホップ ( H = 512 )

---

## 3.2.1 STFT

[
X(k, m) = \sum_{n=0}^{N-1} x[n+mH] w[n] e^{-j 2\pi kn/N}
]

窓関数：Hann

[
w[n] = 0.5 (1 - \cos(2\pi n/(N-1)))
]

---

## 3.2.2 スペクトルフラックス

[
SF(m) = \sum_k \max(0, |X(k,m)| - |X(k,m-1)|)
]

---

## 3.2.3 正規化

[
SF'(m) = \frac{SF(m) - \mu}{\sigma}
]

---

# 3.3 BPM推定（FFT自己相関）

---

## 3.3.1 フレームレート

[
frame_rate = \frac{sample_rate}{H}
]

---

## 3.3.2 FFT自己相関

[
R = IFFT(|FFT(SF')|^2)
]

計算量：

[
O(n \log n)
]

---

## 3.3.3 BPM計算

lag範囲：

[
lag_{min} = \frac{frame_rate \cdot 60}{200}
]
[
lag_{max} = \frac{frame_rate \cdot 60}{60}
]

最適lag:

[
lag^* = \arg\max R(lag)
]

[
BPM = \frac{60 \cdot frame_rate}{lag^*}
]

---

# 3.4 周期強度

[
periodicity_strength =
\frac{R(lag^*)}{R(0)}
]

Loop判定に使用。

---

# 3.5 One-shot / Loop分類

---

## 条件

[
duration > 1.0s
]

[
periodicity_strength > 0.3
]

ANDでLoop。

それ以外One-shot。

---

# 3.6 Kick検出

---

## 3.6.1 低域エネルギー比

[
E_{low} = \sum_{20-150Hz} |X(k)|^2
]

[
E_{total} = \sum |X(k)|^2
]

[
low_ratio = \frac{E_{low}}{E_{total}}
]

---

## 3.6.2 アタック勾配

包絡線:

[
E[n] = |x[n]|
]

微分：

[
attack_slope = \max \frac{dE}{dt}
]

---

## 3.6.3 減衰時間

[
decay_time =
t(E < 0.2E_{peak})
]

---

## Kick条件

[
low_ratio > 0.6
]
[
attack_slope > \theta
]
[
decay_time < 400ms
]

---

# 4. ファイル名解析

Regex分類：

```
(?i)kick
(?i)snare
(?i)hat
(?i)(\d{2,3})\s?bpm
(?i)[A-G]#?(m)?
```

優先度：

1. ファイル名
2. 解析結果
3. ユーザー上書き

---

# 5. データベース設計

---

## samples

```
id INTEGER PRIMARY KEY
path TEXT UNIQUE
file_name TEXT
duration REAL
bpm REAL
periodicity REAL
low_ratio REAL
attack_slope REAL
decay_time REAL
sample_type TEXT
embedding BLOB
```

---

## tags

```
id INTEGER PRIMARY KEY
name TEXT UNIQUE
```

---

## sample_tags

```
sample_id
tag_id
```

---

## インデックス

```
CREATE INDEX idx_bpm ON samples(bpm);
CREATE INDEX idx_type ON samples(sample_type);
CREATE INDEX idx_sample_tags_sid ON sample_tags(sample_id);
CREATE INDEX idx_sample_tags_tid ON sample_tags(tag_id);
```

---

## FTS5

```
CREATE VIRTUAL TABLE samples_fts
USING fts5(file_name);
```

---

# 6. Embedding設計

---

## ベクトル

例：64次元

[
v = [f_1, f_2, ..., f_{64}]
]

---

## 類似度

[
cos(\theta) =
\frac{v_1 \cdot v_2}{||v_1|| ||v_2||}
]

---

## 将来拡張

EmbeddingIndex trait:

```
trait EmbeddingIndex {
    fn insert(id, vector);
    fn search(query, k);
}
```

将来：

* HNSW
* IVF
* Faiss

---

# 7. FFI設計（安全版）

---

## Opaque Handle

```
pub struct SMHandle {
    inner: Arc<SampleManager>,
}
```

---

## extern

```
extern "C" fn sm_init() -> *mut SMHandle;
```

---

## NULL安全

```
if ptr.is_null() { return; }
```

---

## 文字列解放API必須

```
sm_string_free(char*);
```

---

# 8. スレッド設計

---

## Audio Thread

禁止：

* メモリアロケーション
* DBアクセス
* Rust重処理

---

## Worker Thread

rayon pool

---

## UI Thread

安全にRust呼び出し可能

---

# 9. 差分スキャン設計

保存：

* path
* last_modified
* file_hash

更新時：

[
if last_modified_changed → 再解析
]

---

# 10. 外部メディア対応設計

---

## 10.1 スキャン対象パス

スキャン対象はユーザーが指定したディレクトリパスで管理する。
内蔵ディスク・外部メディアを問わず、パスが有効であればスキャン対象とする。

```
# 内蔵SSD
~/Samples/

# 外部HDD / USB（macOS）
/Volumes/MySampleDrive/Samples/
```

複数パスの登録を許容する：

```
watched_paths: Vec<PathBuf>
```

---

## 10.2 マウント状態管理

### DBスキーマ追加

```
CREATE TABLE watched_paths (
    id       INTEGER PRIMARY KEY,
    path     TEXT UNIQUE,
    label    TEXT,
    is_external INTEGER DEFAULT 0   -- 1 = 外部メディア
);
```

```samples``` テーブルへの追加カラム：

```
is_online INTEGER DEFAULT 1   -- 0 = ドライブ未接続
```

---

## 10.3 オンライン判定ロジック

起動時・スキャン前に各 watched_path の存在を確認：

```rust
fn check_mount_status(paths: &[PathBuf]) -> HashMap<PathBuf, bool> {
    paths.iter().map(|p| (p.clone(), p.exists())).collect()
}
```

判定結果に基づき ```is_online``` を一括更新：

```sql
UPDATE samples SET is_online = 0
WHERE path LIKE '/Volumes/MySampleDrive/%';
```

---

## 10.4 オフライン時の挙動

| 操作         | 挙動                                       |
| ---------- | ---------------------------------------- |
| 検索・フィルタ    | メタデータはDBにあるため **通常通り動作**                |
| プレビュー再生    | 不可。UIに「オフライン」バッジ表示                      |
| 差分スキャン     | スキップ（is\_online = 0 のパスは対象外）            |
| ドライブ再接続時   | 自動で差分スキャンをトリガー                           |

---

## 10.5 マウント検知（macOS）

macOS では FSEvents を利用してボリュームマウントを監視：

```rust
// JUCE側でボリュームマウントイベントを受け取り
// Rustコアへ通知 → 差分スキャンをトリガー
fn on_volume_mounted(path: &Path) {
    if watched_paths.contains(path) {
        trigger_incremental_scan(path);
    }
}
```

---

## 10.6 UIへの反映

* サイドバーのパス一覧にマウント状態アイコンを表示
* オフラインサンプルには ```⚠ OFFLINE``` バッジ
* オフラインサンプルはプレビューボタンを非活性化
* ドライブ接続時にトースト通知 → スキャン開始

---

## 10.7 将来拡張

* ネットワークドライブ（SMB / NFS）対応
* ドライブ別のスキャン優先度設定
* オフラインサンプルのサロゲートプレビュー（embedding類似検索で代替候補提示）

---

# 11. パフォーマンス目標

| 項目                   | 目標     |
| -------------------- | ------ |
| 1万ファイル初回スキャン（内蔵SSD）  | < 30秒  |
| 1万ファイル初回スキャン（外部HDD）  | < 90秒  |
| 検索応答（オンライン/オフライン共通） | < 50ms |
| プレビュー開始              | < 10ms |
| マウント検知 → スキャン開始      | < 2秒  |

---

# 12. 将来拡張

* CLAP対応
* Standalone
* AIタグ生成
* スマートコレクション
* MIDI生成

---

# 13. セキュリティ

* unsafe最小化
* FFI境界厳密管理
* NULLチェック
* CStr安全変換

---

# 結論

この設計は：

✔ 数学的厳密性あり
✔ FFT高速化済み
✔ スレッド安全設計明確
✔ スケーラビリティ考慮
✔ OSS拡張性確保

