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
    /// Low-band energy ratio.
    pub low_ratio: Option<f64>,
    /// Attack slope in dB/ms.
    pub attack_slope: Option<f64>,
    /// Decay time in ms.
    pub decay_time: Option<f64>,
    /// Classification label (e.g. "kick", "loop", "oneshot").
    pub sample_type: Option<String>,
    /// Feature embedding blob.
    pub embedding: Option<Vec<u8>>,
    /// Whether the file is currently accessible.
    pub is_online: bool,
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
    /// Low-band energy ratio.
    pub low_ratio: Option<f64>,
    /// Attack slope in dB/ms.
    pub attack_slope: Option<f64>,
    /// Decay time in ms.
    pub decay_time: Option<f64>,
    /// Classification label.
    pub sample_type: Option<String>,
    /// Feature embedding blob.
    pub embedding: Option<Vec<u8>>,
}

/// Insert a new sample into the database. Also inserts into the FTS5 index.
///
/// Returns the `rowid` of the newly inserted row.
///
/// # Errors
/// Returns `rusqlite::Error` if the path already exists or any SQL error occurs.
pub fn insert_sample(conn: &Connection, input: &SampleInput) -> Result<i64, rusqlite::Error> {
    let mut stmt = conn.prepare_cached(
        "INSERT INTO samples (path, file_name, duration, bpm, periodicity, low_ratio, attack_slope, decay_time, sample_type, embedding)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
    )?;
    stmt.execute(params![
        input.path,
        input.file_name,
        input.duration,
        input.bpm,
        input.periodicity,
        input.low_ratio,
        input.attack_slope,
        input.decay_time,
        input.sample_type,
        input.embedding,
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

    let mut stmt = conn.prepare_cached(
        "UPDATE samples SET file_name = ?1, duration = ?2, bpm = ?3, periodicity = ?4,
         low_ratio = ?5, attack_slope = ?6, decay_time = ?7, sample_type = ?8, embedding = ?9
         WHERE path = ?10",
    )?;
    let updated = stmt.execute(params![
        input.file_name,
        input.duration,
        input.bpm,
        input.periodicity,
        input.low_ratio,
        input.attack_slope,
        input.decay_time,
        input.sample_type,
        input.embedding,
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
        "SELECT id, path, file_name, duration, bpm, periodicity, low_ratio, attack_slope,
                decay_time, sample_type, embedding, is_online
         FROM samples WHERE path = ?1",
    )?;

    stmt.query_row(params![path], row_to_sample).optional()
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

/// List all samples in the database, ordered by file name.
fn list_all_samples(conn: &Connection) -> Result<Vec<SampleRow>, rusqlite::Error> {
    let mut stmt = conn.prepare_cached(
        "SELECT id, path, file_name, duration, bpm, periodicity, low_ratio, attack_slope,
                decay_time, sample_type, embedding, is_online
         FROM samples
         ORDER BY file_name",
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
                s.low_ratio, s.attack_slope, s.decay_time, s.sample_type,
                s.embedding, s.is_online
         FROM samples_fts f
         JOIN samples s ON s.id = f.rowid
         WHERE f.file_name MATCH ?1
         ORDER BY rank",
    )?;

    let rows = stmt.query_map(params![query], row_to_sample)?;
    rows.collect()
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
        id: row.get(0)?,
        path: row.get(1)?,
        file_name: row.get(2)?,
        duration: row.get(3)?,
        bpm: row.get(4)?,
        periodicity: row.get(5)?,
        low_ratio: row.get(6)?,
        attack_slope: row.get(7)?,
        decay_time: row.get(8)?,
        sample_type: row.get(9)?,
        embedding: row.get(10)?,
        is_online: row.get::<_, i32>(11)? != 0,
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
            low_ratio: Some(0.65),
            attack_slope: Some(30.0),
            decay_time: Some(150.0),
            sample_type: Some("kick".to_string()),
            embedding: None,
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
            low_ratio: None,
            attack_slope: None,
            decay_time: None,
            sample_type: None,
            embedding: None,
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
        assert_eq!(sample.sample_type, Some("kick".to_string()));
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
            low_ratio: Some(0.7),
            attack_slope: Some(35.0),
            decay_time: Some(200.0),
            sample_type: Some("loop".to_string()),
            embedding: Some(vec![1, 2, 3, 4]),
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
        insert_sample(&conn, &make_input("/samples/snare.wav", "snare.wav")).expect("insert failed");

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