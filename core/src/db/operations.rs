use rusqlite::{params, Connection};
use serde::Serialize;

/// A row from the `samples` table.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct SampleRow {
    /// Primary key (auto-generated on insert).
    pub id: i64,
    /// Absolute file path (unique).
    pub path: String,
    /// File name component (e.g. "`kick_808.wav`").
    pub file_name: String,
    /// Duration in seconds.
    pub duration: Option<f64>,
    /// Estimated BPM.
    pub bpm: Option<f64>,
    /// Periodicity strength (0.0–1.0).
    pub periodicity: Option<f64>,
    /// Sample rate in Hz.
    pub sample_rate: Option<i64>,
    /// File size in bytes
    pub file_size: Option<i64>,
    /// Embedded artist metadata (if available)
    pub artist: Option<String>,
    /// Low-band energy ratio.
    pub low_ratio: Option<f64>,
    /// Attack slope in dB/ms.
    pub attack_slope: Option<f64>,
    /// Decay time in ms.
    pub decay_time: Option<f64>,
    /// Classification label ("loop" or "oneshot").
    pub sample_type: Option<String>,
    /// Waveform peaks as JSON array of floats.
    pub waveform_peaks: Option<String>,
    /// Feature embedding blob.
    pub embedding: Option<Vec<u8>>,
    /// Whether the file is currently accessible.
    pub is_online: bool,
    /// Playback type: "loop" or "oneshot".
    pub playback_type: String,
    /// Instrument type: "kick", "snare", "hihat", "bass", "synth", "fx", "vocal", "percussion", "other".
    pub instrument_type: String,
}

/// Result of an embedding search: similarity score + sample row.
#[derive(Debug, Clone, Serialize)]
pub struct EmbeddingSearchResult {
    pub similarity: f32,
    pub row: SampleRow,
}

/// Parameters for inserting or updating a sample (no `id` field).
#[derive(Debug, Clone)]
pub struct SampleInput {
    /// Absolute file path (unique key).
    pub path: String,
    /// File name component.
    pub file_name: String,
    /// Duration in seconds.
    pub duration: Option<f64>,
    /// Estimated BPM.
    pub bpm: Option<f64>,
    /// Periodicity strength.
    pub periodicity: Option<f64>,
    /// Sample rate in Hz.
    pub sample_rate: Option<i64>,
    /// File size in bytes
    pub file_size: Option<i64>,
    /// Artist metadata if available
    pub artist: Option<String>,
    /// Low-band energy ratio.
    pub low_ratio: Option<f64>,
    /// Classification label.
    pub sample_type: Option<String>,
    /// Waveform peaks as JSON array of floats.
    pub waveform_peaks: Option<String>,
    /// Feature embedding blob.
    pub attack_slope: Option<f64>,
    /// Decay time in ms.
    pub decay_time: Option<f64>,
    /// Feature embedding blob.
    pub embedding: Option<Vec<u8>>,
    /// Playback type: "loop" or "oneshot".
    pub playback_type: Option<String>,
    /// Instrument type: "kick", "snare", etc.
    pub instrument_type: Option<String>,
}

/// Insert a new sample into the database. Also inserts into the FTS5 index.
///
/// Returns the `rowid` of the newly inserted row.
///
/// # Errors
/// Returns `rusqlite::Error` if the path already exists or any SQL error occurs.
pub fn insert_sample(conn: &Connection, input: &SampleInput) -> Result<i64, rusqlite::Error> {
    // Use COALESCE for playback_type/instrument_type so that when input provides NULL
    // the database default values ('oneshot' / 'other') are used instead of inserting NULL
    let mut stmt = conn.prepare_cached(
        "INSERT INTO samples (path, file_name, duration, bpm, periodicity, sample_rate, file_size, artist, low_ratio, attack_slope, decay_time, sample_type, waveform_peaks, embedding, playback_type, instrument_type)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, COALESCE(?15, 'oneshot'), COALESCE(?16, 'other'))",
    )?;
    stmt.execute(params![
        input.path,
        input.file_name,
        input.duration,
        input.bpm,
        input.periodicity,
        input.sample_rate,
        input.file_size,
        input.artist,
        input.low_ratio,
        input.attack_slope,
        input.decay_time,
        input.sample_type,
        input.waveform_peaks,
        input.embedding,
        input.playback_type,
        input.instrument_type,
    ])?;
    let rowid = conn.last_insert_rowid();

    // Insert into FTS5 index (rowid must match samples.id)
    let mut fts_stmt =
        conn.prepare_cached("INSERT INTO samples_fts (rowid, file_name) VALUES (?1, ?2)")?;
    fts_stmt.execute(params![rowid, input.file_name])?;

    Ok(rowid)
}

/// Update an existing sample identified by its path.
///
/// Updates all mutable fields (everything except `id` and `path`).
/// Also updates the FTS5 index entry.
///
/// Returns the number of rows modified (0 or 1).
///
/// # Errors
/// Returns `rusqlite::Error` on any SQL error.
pub fn update_sample(conn: &Connection, input: &SampleInput) -> Result<usize, rusqlite::Error> {
    // First, get the current rowid and old file_name for FTS update
    let (rowid, old_file_name) = {
        let mut stmt = conn.prepare_cached("SELECT id, file_name FROM samples WHERE path = ?1")?;
        let row_info: Option<(i64, String)> = stmt
            .query_row(params![input.path], |row| Ok((row.get(0)?, row.get(1)?)))
            .optional()?;
        match row_info {
            Some(info) => info,
            None => return Ok(0),
        }
    };

    // When updating, only override playback_type/instrument_type when provided; otherwise
    // keep existing values by using COALESCE(?param, column)
    let mut stmt = conn.prepare_cached(
        "UPDATE samples SET file_name = ?1, duration = ?2, bpm = ?3, periodicity = ?4,
         sample_rate = ?5, file_size = ?6, artist = ?7, low_ratio = ?8, attack_slope = ?9, decay_time = ?10, sample_type = ?11, embedding = ?12,
         playback_type = COALESCE(?13, playback_type), instrument_type = COALESCE(?14, instrument_type)
         WHERE path = ?15",
    )?;
    let updated = stmt.execute(params![
        input.file_name,
        input.duration,
        input.bpm,
        input.periodicity,
        input.sample_rate,
        input.file_size,
        input.artist,
        input.low_ratio,
        input.attack_slope,
        input.decay_time,
        input.sample_type,
        input.embedding,
        input.playback_type,
        input.instrument_type,
        input.path,
    ])?;

    // Update FTS5 index: delete old entry, insert new
    if updated > 0 {
        let mut del_stmt =
            conn.prepare_cached("DELETE FROM samples_fts WHERE rowid = ?1 AND file_name = ?2")?;
        // FTS5 delete requires matching the content
        // Use the special 'delete' command for FTS5 external content tables,
        // but since this is a standalone FTS5 table, regular DELETE works.
        let _ = del_stmt.execute(params![rowid, old_file_name]);

        let mut ins_stmt =
            conn.prepare_cached("INSERT INTO samples_fts (rowid, file_name) VALUES (?1, ?2)")?;
        ins_stmt.execute(params![rowid, input.file_name])?;
    }

    Ok(updated)
}

/// Retrieve a sample by its file path.
///
/// Returns `None` if no sample with the given path exists.
///
/// # Errors
/// Returns `rusqlite::Error` on any SQL error.
pub fn get_sample_by_path(
    conn: &Connection,
    path: &str,
) -> Result<Option<SampleRow>, rusqlite::Error> {
    let mut stmt = conn.prepare_cached(
        "SELECT id, path, file_name, duration, bpm, periodicity, sample_rate, file_size, artist, low_ratio, attack_slope,
                decay_time, sample_type, waveform_peaks, embedding, is_online, playback_type, instrument_type
         FROM samples WHERE path = ?1",
    )?;

    stmt.query_row(params![path], row_to_sample).optional()
}

/// Retrieve a sample by its ID.
///
/// Returns `None` if no sample with the given ID exists.
///
/// # Errors
/// Returns `rusqlite::Error` on any SQL error.
pub fn get_sample_by_id(conn: &Connection, id: i64) -> Result<Option<SampleRow>, rusqlite::Error> {
    let mut stmt = conn.prepare_cached(
        "SELECT id, path, file_name, duration, bpm, periodicity, sample_rate, file_size, artist, low_ratio, attack_slope,
                decay_time, sample_type, waveform_peaks, embedding, is_online, playback_type, instrument_type
         FROM samples WHERE id = ?1",
    )?;

    stmt.query_row(params![id], row_to_sample).optional()
}

/// Full-text search on sample file names using the FTS5 index.
///
/// The `query` string uses FTS5 query syntax (e.g. `"kick"`, `"kick OR snare"`,
/// `"808*"` for prefix matching).
///
/// Returns matching samples ordered by FTS5 relevance (best match first).
///
/// # Errors
/// Returns `rusqlite::Error` on any SQL error (including malformed FTS5 queries).
pub fn search_samples(conn: &Connection, query: &str) -> Result<Vec<SampleRow>, rusqlite::Error> {
    let query = query.trim();
    if query.is_empty() {
        // Return all samples when query is empty (e.g., after a fresh scan)
        return list_all_samples(conn);
    }
    match run_search_samples_query(conn, query) {
        Ok(rows) => Ok(rows),
        Err(err) if is_fts5_syntax_error(&err) => {
            let escaped = escape_fts5_query(query);
            if escaped.is_empty() {
                return Ok(Vec::new());
            }
            match run_search_samples_query(conn, &escaped) {
                Ok(rows) => Ok(rows),
                Err(escaped_err) if is_fts5_syntax_error(&escaped_err) => Ok(Vec::new()),
                Err(escaped_err) => Err(escaped_err),
            }
        }
        Err(err) => Err(err),
    }
}

/// Semantic search by embedding using cosine similarity (brute-force).
///
/// This function reads all samples with non-null embedding blobs from the DB,
/// deserializes each 64-f32 vector, computes cosine similarity against `query`,
/// and returns the top-`k` SampleRow results ordered by descending similarity.
///
/// Note: This is a simple, CPU-bound, O(N) implementation intended as a
/// fallback/initial implementation. The design document mentions HNSW for
/// acceleration; integrate an ANN index later for performance at scale.
pub fn search_by_embedding(
    conn: &Connection,
    query: &[f32],
    k: usize,
) -> Result<Vec<EmbeddingSearchResult>, rusqlite::Error> {
    // Validate query dimension
    if query.len() == 0 {
        return Ok(Vec::new());
    }

    // helper: compute cosine similarity between two equal-length slices
    fn cos_sim(a: &[f32], b: &[f32]) -> f32 {
        let mut dot = 0.0f32;
        let mut na = 0.0f32;
        let mut nb = 0.0f32;
        for i in 0..a.len() {
            dot += a[i] * b[i];
            na += a[i] * a[i];
            nb += b[i] * b[i];
        }
        let denom = (na.sqrt() * nb.sqrt()).max(1e-8);
        dot / denom
    }

    let mut stmt = conn.prepare_cached(
        "SELECT id, path, file_name, duration, bpm, periodicity, sample_rate, file_size, artist, low_ratio, attack_slope, decay_time, sample_type, waveform_peaks, embedding, is_online, playback_type, instrument_type FROM samples WHERE embedding IS NOT NULL",
    )?;

    let rows = stmt.query_map([], |row| row_to_sample(row))?;

    // accumulate (similarity, SampleRow)
    let mut scored: Vec<(f32, SampleRow)> = Vec::new();
    for r in rows {
        if let Ok(sample) = r {
            if let Some(ref emb_blob) = sample.embedding {
                // expect emb_blob length multiple of 4
                if emb_blob.len() % 4 != 0 {
                    continue;
                }
                let dim = emb_blob.len() / 4;
                // quick check: dim == query.len()
                if dim != query.len() {
                    continue;
                }
                // deserialize little-endian f32s
                let mut other: Vec<f32> = Vec::with_capacity(dim);
                for i in 0..dim {
                    let off = i * 4;
                    let bytes: [u8; 4] = [
                        emb_blob[off],
                        emb_blob[off + 1],
                        emb_blob[off + 2],
                        emb_blob[off + 3],
                    ];
                    other.push(f32::from_le_bytes(bytes));
                }
                let sim = cos_sim(query, &other);
                scored.push((sim, sample));
            }
        }
    }

    // sort descending by similarity
    scored.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));

    Ok(scored
        .into_iter()
        .take(k)
        .map(|(sim, s)| EmbeddingSearchResult {
            similarity: sim,
            row: s,
        })
        .collect())
}

/// List samples with pagination. Ordered by id.
pub fn list_samples_paginated(
    conn: &Connection,
    limit: usize,
    offset: usize,
) -> Result<Vec<SampleRow>, rusqlite::Error> {
    let mut stmt = conn.prepare_cached(
        "SELECT id, path, file_name, duration, bpm, periodicity, sample_rate, file_size, artist, low_ratio, attack_slope, decay_time, sample_type, waveform_peaks, embedding, is_online, playback_type, instrument_type FROM samples ORDER BY id LIMIT ?1 OFFSET ?2",
    )?;

    let rows = stmt.query_map(params![limit as i64, offset as i64], row_to_sample)?;
    rows.collect()
}

/// List all samples in the database, ordered by file name.
fn list_all_samples(conn: &Connection) -> Result<Vec<SampleRow>, rusqlite::Error> {
    let mut stmt = conn.prepare_cached(
        "SELECT id, path, file_name, duration, bpm, periodicity, sample_rate, file_size, artist, low_ratio, attack_slope,
                decay_time, sample_type, waveform_peaks, embedding, is_online, playback_type, instrument_type
         FROM samples
         ORDER BY id",
    )?;

    let rows = stmt.query_map([], row_to_sample)?;
    rows.collect()
}

fn run_search_samples_query(
    conn: &Connection,
    query: &str,
) -> Result<Vec<SampleRow>, rusqlite::Error> {
    let mut stmt = conn.prepare_cached(
        "SELECT s.id, s.path, s.file_name, s.duration, s.bpm, s.periodicity,
                s.sample_rate, s.file_size, s.artist, s.low_ratio, s.attack_slope, s.decay_time, s.sample_type,
                s.waveform_peaks, s.embedding, s.is_online, s.playback_type, s.instrument_type
         FROM samples_fts f
         JOIN samples s ON s.id = f.rowid
         WHERE f.file_name MATCH ?1
         ORDER BY rank",
    )?;

    let rows = stmt.query_map(params![query], row_to_sample)?;
    rows.collect()
}

fn run_search_samples_query_paginated(
    conn: &Connection,
    query: &str,
    limit: usize,
    offset: usize,
) -> Result<Vec<SampleRow>, rusqlite::Error> {
    let mut stmt = conn.prepare_cached(
        "SELECT s.id, s.path, s.file_name, s.duration, s.bpm, s.periodicity,
                s.sample_rate, s.file_size, s.artist, s.low_ratio, s.attack_slope, s.decay_time, s.sample_type,
                s.waveform_peaks, s.embedding, s.is_online, s.playback_type, s.instrument_type
         FROM samples_fts f
         JOIN samples s ON s.id = f.rowid
         WHERE f.file_name MATCH ?1
         ORDER BY rank
         LIMIT ?2 OFFSET ?3",
    )?;

    let rows = stmt.query_map(params![query, limit as i64, offset as i64], row_to_sample)?;
    rows.collect()
}

/// Search samples using FTS5 with pagination (LIMIT/OFFSET).
pub fn search_samples_paginated(
    conn: &Connection,
    query: &str,
    limit: usize,
    offset: usize,
) -> Result<Vec<SampleRow>, rusqlite::Error> {
    let query = query.trim();
    if query.is_empty() {
        return list_samples_paginated(conn, limit, offset);
    }

    match run_search_samples_query_paginated(conn, query, limit, offset) {
        Ok(rows) => Ok(rows),
        Err(err) if is_fts5_syntax_error(&err) => {
            let escaped = escape_fts5_query(query);
            if escaped.is_empty() {
                return Ok(Vec::new());
            }
            match run_search_samples_query_paginated(conn, &escaped, limit, offset) {
                Ok(rows) => Ok(rows),
                Err(escaped_err) if is_fts5_syntax_error(&escaped_err) => Ok(Vec::new()),
                Err(escaped_err) => Err(escaped_err),
            }
        }
        Err(err) => Err(err),
    }
}

fn is_fts5_syntax_error(err: &rusqlite::Error) -> bool {
    matches!(
        err,
        rusqlite::Error::SqliteFailure(_, Some(message))
            if message.contains("fts5: syntax error")
                || message.contains("unterminated string")
    )
}

fn escape_fts5_query(query: &str) -> String {
    query
        .split_whitespace()
        .filter_map(|token| {
            if matches!(token, "AND" | "OR" | "NOT" | "NEAR") {
                return Some(token.to_string());
            }

            let (core, is_prefix) = if token.len() > 1 && token.ends_with('*') {
                (&token[..token.len() - 1], true)
            } else {
                (token, false)
            };

            if core.is_empty() {
                return None;
            }

            if core.chars().all(|c| c.is_ascii_alphanumeric() || c == '_') {
                let mut escaped = core.to_string();
                if is_prefix {
                    escaped.push('*');
                }
                return Some(escaped);
            }

            let mut escaped = String::with_capacity(core.len() + 2);
            escaped.push('"');
            escaped.push_str(&core.replace('"', "\"\""));
            escaped.push('"');
            Some(escaped)
        })
        .collect::<Vec<_>>()
        .join(" ")
}

/// Delete a sample by its file path. Also removes the corresponding FTS5 entry.
///
/// Returns the number of rows deleted (0 or 1).
///
/// # Errors
/// Returns `rusqlite::Error` on any SQL error.
pub fn delete_sample(conn: &Connection, path: &str) -> Result<usize, rusqlite::Error> {
    // Get the rowid and file_name before deleting so we can clean up FTS
    let row_info: Option<(i64, String)> = {
        let mut stmt = conn.prepare_cached("SELECT id, file_name FROM samples WHERE path = ?1")?;
        stmt.query_row(params![path], |row| Ok((row.get(0)?, row.get(1)?)))
            .optional()?
    };

    if let Some((rowid, file_name)) = row_info {
        // Delete FTS entry first (FK-like ordering)
        let mut fts_stmt =
            conn.prepare_cached("DELETE FROM samples_fts WHERE rowid = ?1 AND file_name = ?2")?;
        let _ = fts_stmt.execute(params![rowid, file_name]);

        // Delete associated tags
        let mut tags_stmt = conn.prepare_cached("DELETE FROM sample_tags WHERE sample_id = ?1")?;
        let _ = tags_stmt.execute(params![rowid]);

        // Delete sample row
        let mut stmt = conn.prepare_cached("DELETE FROM samples WHERE id = ?1")?;
        let deleted = stmt.execute(params![rowid])?;
        Ok(deleted)
    } else {
        Ok(0)
    }
}

/// Map a `rusqlite::Row` to a `SampleRow`.
fn row_to_sample(row: &rusqlite::Row<'_>) -> Result<SampleRow, rusqlite::Error> {
    Ok(SampleRow {
        id: row.get::<_, i64>("id")?,
        path: row.get::<_, String>("path")?,
        file_name: row.get::<_, String>("file_name")?,
        duration: row.get::<_, Option<f64>>("duration")?,
        bpm: row.get::<_, Option<f64>>("bpm")?,
        periodicity: row.get::<_, Option<f64>>("periodicity")?,
        sample_rate: row.get::<_, Option<i64>>("sample_rate")?,
        file_size: row.get::<_, Option<i64>>("file_size")?,
        artist: row.get::<_, Option<String>>("artist")?,
        low_ratio: row.get::<_, Option<f64>>("low_ratio")?,
        attack_slope: row.get::<_, Option<f64>>("attack_slope")?,
        decay_time: row.get::<_, Option<f64>>("decay_time")?,
        sample_type: row.get::<_, Option<String>>("sample_type")?,
        waveform_peaks: row.get::<_, Option<String>>("waveform_peaks")?,
        embedding: row.get::<_, Option<Vec<u8>>>("embedding")?,
        is_online: row.get::<_, i32>("is_online")? != 0,
        playback_type: row.get::<_, String>("playback_type")?,
        instrument_type: row.get::<_, String>("instrument_type")?,
    })
}

/// Extension trait on `rusqlite::Result` to provide `optional()` for `query_row`.
trait OptionalExt<T> {
    /// Convert a `QueryReturnedNoRows` error into `Ok(None)`.
    fn optional(self) -> Result<Option<T>, rusqlite::Error>;
}

impl<T> OptionalExt<T> for Result<T, rusqlite::Error> {
    fn optional(self) -> Result<Option<T>, rusqlite::Error> {
        match self {
            Ok(v) => Ok(Some(v)),
            Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
            Err(e) => Err(e),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::schema::init_database;

    /// Helper: create in-memory DB with schema initialized.
    fn setup_db() -> Connection {
        let conn = Connection::open_in_memory().expect("Failed to create in-memory DB");
        init_database(&conn).expect("Failed to initialize schema");
        conn
    }

    /// Helper: build a minimal `SampleInput`.
    fn make_input(path: &str, file_name: &str) -> SampleInput {
        SampleInput {
            path: path.to_string(),
            file_name: file_name.to_string(),
            duration: Some(2.5),
            bpm: Some(120.0),
            periodicity: Some(0.85),
            sample_rate: Some(44100),
            file_size: None,
            artist: None,
            low_ratio: Some(0.65),
            attack_slope: Some(30.0),
            decay_time: Some(150.0),
            sample_type: Some("oneshot".to_string()),
            waveform_peaks: None,
            embedding: None,
            playback_type: None,
            instrument_type: None,
        }
    }

    // ---- insert_sample tests ----

    #[test]
    fn test_insert_sample_returns_rowid() {
        let conn = setup_db();
        let input = make_input("/samples/kick_808.wav", "kick_808.wav");
        let id = insert_sample(&conn, &input).expect("insert failed");
        assert!(id > 0);
    }

    #[test]
    fn test_insert_sample_duplicate_path_fails() {
        let conn = setup_db();
        let input = make_input("/samples/kick.wav", "kick.wav");
        insert_sample(&conn, &input).expect("first insert failed");
        let result = insert_sample(&conn, &input);
        assert!(result.is_err(), "duplicate path should fail");
    }

    #[test]
    fn test_insert_sample_with_nulls() {
        let conn = setup_db();
        let input = SampleInput {
            path: "/samples/mystery.wav".to_string(),
            file_name: "mystery.wav".to_string(),
            duration: None,
            bpm: None,
            periodicity: None,
            sample_rate: None,
            file_size: None,
            artist: None,
            low_ratio: None,
            attack_slope: None,
            decay_time: None,
            sample_type: None,
            waveform_peaks: None,
            embedding: None,
            playback_type: None,
            instrument_type: None,
        };
        let id = insert_sample(&conn, &input).expect("insert with nulls failed");
        assert!(id > 0);
    }

    // ---- get_sample_by_path tests ----

    #[test]
    fn test_get_sample_by_path_found() {
        let conn = setup_db();
        let input = make_input("/samples/kick_808.wav", "kick_808.wav");
        insert_sample(&conn, &input).expect("insert failed");

        let sample = get_sample_by_path(&conn, "/samples/kick_808.wav")
            .expect("query failed")
            .expect("sample not found");

        assert_eq!(sample.path, "/samples/kick_808.wav");
        assert_eq!(sample.file_name, "kick_808.wav");
        assert_eq!(sample.bpm, Some(120.0));
        assert_eq!(sample.sample_type, Some("oneshot".to_string()));
        assert!(sample.is_online);
    }

    #[test]
    fn test_get_sample_by_path_not_found() {
        let conn = setup_db();
        let result = get_sample_by_path(&conn, "/nonexistent.wav").expect("query failed");
        assert!(result.is_none());
    }

    // ---- update_sample tests ----

    #[test]
    fn test_update_sample_modifies_fields() {
        let conn = setup_db();
        let input = make_input("/samples/kick.wav", "kick.wav");
        insert_sample(&conn, &input).expect("insert failed");

        let updated_input = SampleInput {
            path: "/samples/kick.wav".to_string(),
            file_name: "kick_renamed.wav".to_string(),
            duration: Some(3.0),
            bpm: Some(140.0),
            periodicity: Some(0.9),
            sample_rate: Some(44100),
            file_size: None,
            artist: None,
            low_ratio: Some(0.7),
            attack_slope: Some(35.0),
            decay_time: Some(200.0),
            sample_type: Some("loop".to_string()),
            waveform_peaks: None,
            embedding: Some(vec![1, 2, 3, 4]),
            playback_type: None,
            instrument_type: None,
        };
        let count = update_sample(&conn, &updated_input).expect("update failed");
        assert_eq!(count, 1);

        let sample = get_sample_by_path(&conn, "/samples/kick.wav")
            .expect("query failed")
            .expect("sample not found after update");
        assert_eq!(sample.file_name, "kick_renamed.wav");
        assert_eq!(sample.bpm, Some(140.0));
        assert_eq!(sample.sample_type, Some("loop".to_string()));
        assert_eq!(sample.embedding, Some(vec![1, 2, 3, 4]));
    }

    #[test]
    fn test_update_sample_updates_playback_and_instrument() {
        let conn = setup_db();
        let input = make_input("/samples/test.wav", "test.wav");
        // Insert initial sample with defaults
        insert_sample(&conn, &input).expect("insert failed");

        // Prepare updated input that changes playback_type and instrument_type
        let updated = SampleInput {
            playback_type: Some("loop".to_string()),
            instrument_type: Some("snare".to_string()),
            file_size: input.file_size,
            artist: input.artist.clone(),
            ..input.clone()
        };

        let count = update_sample(&conn, &updated).expect("update failed");
        assert_eq!(count, 1);

        let sample = get_sample_by_path(&conn, "/samples/test.wav")
            .expect("query failed")
            .expect("sample not found after update");
        assert_eq!(sample.playback_type, "loop");
        assert_eq!(sample.instrument_type, "snare");
    }

    #[test]
    fn test_update_nonexistent_sample_returns_zero() {
        let conn = setup_db();
        let input = make_input("/nonexistent.wav", "nope.wav");
        let count = update_sample(&conn, &input).expect("update failed");
        assert_eq!(count, 0);
    }

    #[test]
    fn test_update_sample_updates_fts() {
        let conn = setup_db();
        let input = make_input("/samples/old_name.wav", "old_name.wav");
        insert_sample(&conn, &input).expect("insert failed");

        let updated = SampleInput {
            file_name: "new_name.wav".to_string(),
            ..input
        };
        update_sample(&conn, &updated).expect("update failed");

        // Old name should not match FTS
        let old_results = search_samples(&conn, "old_name").expect("fts search failed");
        assert!(old_results.is_empty(), "old file_name should not be in FTS");

        // New name should match FTS
        let new_results = search_samples(&conn, "new_name").expect("fts search failed");
        assert_eq!(new_results.len(), 1);
        assert_eq!(new_results[0].file_name, "new_name.wav");
    }

    // ---- search_samples tests ----

    #[test]
    fn test_search_samples_basic_match() {
        let conn = setup_db();
        insert_sample(&conn, &make_input("/samples/kick_808.wav", "kick_808.wav"))
            .expect("insert failed");
        insert_sample(
            &conn,
            &make_input("/samples/snare_tight.wav", "snare_tight.wav"),
        )
        .expect("insert failed");

        let results = search_samples(&conn, "kick").expect("search failed");
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].file_name, "kick_808.wav");
    }

    #[test]
    fn test_search_samples_no_match() {
        let conn = setup_db();
        insert_sample(&conn, &make_input("/samples/kick.wav", "kick.wav")).expect("insert failed");

        let results = search_samples(&conn, "cymbal").expect("search failed");
        assert!(results.is_empty());
    }

    #[test]
    fn test_search_samples_prefix_match() {
        let conn = setup_db();
        insert_sample(&conn, &make_input("/samples/kick_808.wav", "kick_808.wav"))
            .expect("insert failed");
        insert_sample(&conn, &make_input("/samples/kick_909.wav", "kick_909.wav"))
            .expect("insert failed");
        insert_sample(&conn, &make_input("/samples/snare.wav", "snare.wav"))
            .expect("insert failed");

        // FTS5 prefix query
        let results = search_samples(&conn, "kick*").expect("search failed");
        assert_eq!(results.len(), 2);
    }

    #[test]
    fn test_search_samples_multiple_terms() {
        let conn = setup_db();
        insert_sample(&conn, &make_input("/samples/kick_808.wav", "kick_808.wav"))
            .expect("insert failed");
        insert_sample(
            &conn,
            &make_input("/samples/snare_808.wav", "snare_808.wav"),
        )
        .expect("insert failed");

        // FTS5 AND query: both tokens must be in file_name
        let results = search_samples(&conn, "kick 808").expect("search failed");
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].file_name, "kick_808.wav");
    }

    #[test]
    fn test_search_samples_empty_query_returns_all_samples() {
        let conn = setup_db();
        insert_sample(&conn, &make_input("/samples/kick.wav", "kick.wav")).expect("insert failed");
        insert_sample(&conn, &make_input("/samples/snare.wav", "snare.wav"))
            .expect("insert failed");

        // Empty query should return all samples
        let empty_results = search_samples(&conn, "").expect("search failed");
        assert_eq!(empty_results.len(), 2);

        // Whitespace-only query should also return all samples
        let whitespace_results = search_samples(&conn, "   \t\n").expect("search failed");
        assert_eq!(whitespace_results.len(), 2);
    }

    #[test]
    fn test_search_samples_special_chars_do_not_error() {
        let conn = setup_db();
        insert_sample(&conn, &make_input("/samples/kick.wav", "kick.wav")).expect("insert failed");

        let paren_results = search_samples(&conn, "(").expect("search failed");
        assert!(paren_results.is_empty());

        let unterminated_quote_results = search_samples(&conn, "\"").expect("search failed");
        assert!(unterminated_quote_results.is_empty());
    }

    // ---- delete_sample tests ----

    #[test]
    fn test_delete_sample_removes_row() {
        let conn = setup_db();
        let input = make_input("/samples/kick.wav", "kick.wav");
        insert_sample(&conn, &input).expect("insert failed");

        let count = delete_sample(&conn, "/samples/kick.wav").expect("delete failed");
        assert_eq!(count, 1);

        let result = get_sample_by_path(&conn, "/samples/kick.wav").expect("query failed");
        assert!(result.is_none());
    }

    #[test]
    fn test_delete_sample_removes_fts_entry() {
        let conn = setup_db();
        insert_sample(&conn, &make_input("/samples/kick.wav", "kick.wav")).expect("insert failed");
        delete_sample(&conn, "/samples/kick.wav").expect("delete failed");

        let results = search_samples(&conn, "kick").expect("search failed");
        assert!(results.is_empty(), "FTS entry should be removed on delete");
    }

    #[test]
    fn test_delete_nonexistent_returns_zero() {
        let conn = setup_db();
        let count = delete_sample(&conn, "/nonexistent.wav").expect("delete failed");
        assert_eq!(count, 0);
    }

    #[test]
    fn test_delete_sample_removes_tags() {
        let conn = setup_db();
        let input = make_input("/samples/kick.wav", "kick.wav");
        let id = insert_sample(&conn, &input).expect("insert failed");

        // Manually add a tag association
        conn.execute("INSERT INTO tags (name) VALUES ('drums')", [])
            .expect("tag insert failed");
        conn.execute(
            "INSERT INTO sample_tags (sample_id, tag_id) VALUES (?1, 1)",
            params![id],
        )
        .expect("sample_tag insert failed");

        delete_sample(&conn, "/samples/kick.wav").expect("delete failed");

        // Verify sample_tags cleaned up
        let tag_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sample_tags WHERE sample_id = ?1",
                params![id],
                |row| row.get(0),
            )
            .expect("count failed");
        assert_eq!(tag_count, 0, "sample_tags should be cleaned up on delete");
    }

    // ---- round-trip integration test ----

    #[test]
    fn test_insert_search_update_delete_roundtrip() {
        let conn = setup_db();

        // Insert
        let input = make_input("/samples/kick_808.wav", "kick_808.wav");
        let id = insert_sample(&conn, &input).expect("insert failed");
        assert!(id > 0);

        // Search finds it
        let results = search_samples(&conn, "kick").expect("search failed");
        assert_eq!(results.len(), 1);

        // Update
        let updated = SampleInput {
            bpm: Some(140.0),
            ..input.clone()
        };
        update_sample(&conn, &updated).expect("update failed");
        let sample = get_sample_by_path(&conn, "/samples/kick_808.wav")
            .expect("get failed")
            .expect("not found");
        assert_eq!(sample.bpm, Some(140.0));

        // Delete
        delete_sample(&conn, "/samples/kick_808.wav").expect("delete failed");
        let gone = get_sample_by_path(&conn, "/samples/kick_808.wav").expect("get failed");
        assert!(gone.is_none());

        // FTS also cleaned up
        let results = search_samples(&conn, "kick").expect("search failed");
        assert!(results.is_empty());
    }
}

/// Delete all samples from the database.
///
/// Removes all rows from `samples`, `samples_fts`, and `sample_tags` tables.
///
/// # Errors
/// Returns `rusqlite::Error` on any SQL error.
pub fn clear_all_samples(conn: &Connection) -> Result<usize, rusqlite::Error> {
    // Clear FTS index
    conn.execute("DELETE FROM samples_fts", [])?;

    // Clear tag associations
    conn.execute("DELETE FROM sample_tags", [])?;

    // Clear samples and get count
    let count = conn.execute("DELETE FROM samples", [])?;

    Ok(count)
}

/// Move a sample's path in the database.
///
/// Updates the path and file_name fields when a file is moved on disk.
///
/// # Errors
/// Returns `rusqlite::Error` on any SQL error.
pub fn move_sample_path(
    conn: &Connection,
    old_path: &str,
    new_path: &str,
) -> Result<usize, rusqlite::Error> {
    // Extract new file name from new path
    let new_file_name = std::path::Path::new(new_path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown")
        .to_string();

    // Get old file name for FTS update
    let old_file_name: String = conn.query_row(
        "SELECT file_name FROM samples WHERE path = ?1",
        params![old_path],
        |row| row.get(0),
    )?;

    // Update the sample record
    let updated = conn.execute(
        "UPDATE samples SET path = ?1, file_name = ?2 WHERE path = ?3",
        params![new_path, new_file_name, old_path],
    )?;

    // Update FTS index
    if updated > 0 {
        conn.execute(
            "DELETE FROM samples_fts WHERE rowid = (SELECT id FROM samples WHERE path = ?1) AND file_name = ?2",
            params![new_path, old_file_name],
        )?;
        conn.execute(
            "INSERT INTO samples_fts (rowid, file_name) VALUES ((SELECT id FROM samples WHERE path = ?1), ?2)",
            params![new_path, new_file_name],
        )?;
    }

    Ok(updated)
}

// ============ Instrument Types CRUD ============

/// A row from the `instrument_types` table.
#[derive(Debug, Clone, Serialize)]
pub struct InstrumentTypeRow {
    pub id: i64,
    pub name: String,
    pub created_at: String,
}

/// Insert a new instrument type into the database.
///
/// Returns the `rowid` of the newly inserted row.
///
/// # Errors
/// Returns `rusqlite::Error` if the name already exists or any SQL error occurs.
pub fn insert_instrument_type(conn: &Connection, name: &str) -> Result<i64, rusqlite::Error> {
    let mut stmt = conn.prepare_cached("INSERT INTO instrument_types (name) VALUES (?1)")?;
    stmt.execute(params![name])?;
    Ok(conn.last_insert_rowid())
}

/// Get all instrument types from the database, ordered by name.
///
/// # Errors
/// Returns `rusqlite::Error` on any SQL error.
pub fn get_all_instrument_types(
    conn: &Connection,
) -> Result<Vec<InstrumentTypeRow>, rusqlite::Error> {
    let mut stmt =
        conn.prepare_cached("SELECT id, name, created_at FROM instrument_types ORDER BY name")?;
    let rows = stmt.query_map([], |row| {
        Ok(InstrumentTypeRow {
            id: row.get(0)?,
            name: row.get(1)?,
            created_at: row.get(2)?,
        })
    })?;
    rows.collect()
}

/// Delete an instrument type by its ID.
///
/// Returns the number of rows deleted (0 or 1).
///
/// # Errors
/// Returns `rusqlite::Error` on any SQL error.
pub fn delete_instrument_type(conn: &Connection, id: i64) -> Result<usize, rusqlite::Error> {
    let mut stmt = conn.prepare_cached("DELETE FROM instrument_types WHERE id = ?1")?;
    stmt.execute(params![id])
}

/// Update an instrument type's name by its ID.
///
/// Returns the number of rows modified (0 or 1).
///
/// # Errors
/// Returns `rusqlite::Error` on any SQL error.
pub fn update_instrument_type(
    conn: &Connection,
    id: i64,
    name: &str,
) -> Result<usize, rusqlite::Error> {
    let mut stmt = conn.prepare_cached("UPDATE instrument_types SET name = ?1 WHERE id = ?2")?;
    stmt.execute(params![name, id])
}
