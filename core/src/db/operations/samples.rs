use rusqlite::{params, Connection};

use super::types::{EmbeddingSearchResult, SampleInput, SampleRow};

pub fn insert_sample(conn: &Connection, input: &SampleInput) -> Result<i64, rusqlite::Error> {
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
    let mut fts_stmt =
        conn.prepare_cached("INSERT INTO samples_fts (rowid, file_name) VALUES (?1, ?2)")?;
    fts_stmt.execute(params![rowid, input.file_name])?;
    Ok(rowid)
}

pub fn update_sample(conn: &Connection, input: &SampleInput) -> Result<usize, rusqlite::Error> {
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

    if updated > 0 {
        let mut del_stmt =
            conn.prepare_cached("DELETE FROM samples_fts WHERE rowid = ?1 AND file_name = ?2")?;
        let _ = del_stmt.execute(params![rowid, old_file_name]);
        let mut ins_stmt =
            conn.prepare_cached("INSERT INTO samples_fts (rowid, file_name) VALUES (?1, ?2)")?;
        ins_stmt.execute(params![rowid, input.file_name])?;
    }
    Ok(updated)
}

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

pub fn get_sample_by_id(conn: &Connection, id: i64) -> Result<Option<SampleRow>, rusqlite::Error> {
    let mut stmt = conn.prepare_cached(
        "SELECT id, path, file_name, duration, bpm, periodicity, sample_rate, file_size, artist, low_ratio, attack_slope,
                decay_time, sample_type, waveform_peaks, embedding, is_online, playback_type, instrument_type
         FROM samples WHERE id = ?1",
    )?;
    stmt.query_row(params![id], row_to_sample).optional()
}

pub fn search_samples(conn: &Connection, query: &str) -> Result<Vec<SampleRow>, rusqlite::Error> {
    let query = query.trim();
    if query.is_empty() {
        return list_all_samples(conn);
    }
    match run_fts_query(conn, query, None, None) {
        Ok(rows) => Ok(rows),
        Err(err) if is_fts5_syntax_error(&err) => {
            let escaped = escape_fts5_query(query);
            if escaped.is_empty() {
                return Ok(Vec::new());
            }
            match run_fts_query(conn, &escaped, None, None) {
                Ok(rows) => Ok(rows),
                Err(e) if is_fts5_syntax_error(&e) => Ok(Vec::new()),
                Err(e) => Err(e),
            }
        }
        Err(err) => Err(err),
    }
}

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
    match run_fts_query(conn, query, Some(limit), Some(offset)) {
        Ok(rows) => Ok(rows),
        Err(err) if is_fts5_syntax_error(&err) => {
            let escaped = escape_fts5_query(query);
            if escaped.is_empty() {
                return Ok(Vec::new());
            }
            match run_fts_query(conn, &escaped, Some(limit), Some(offset)) {
                Ok(rows) => Ok(rows),
                Err(e) if is_fts5_syntax_error(&e) => Ok(Vec::new()),
                Err(e) => Err(e),
            }
        }
        Err(err) => Err(err),
    }
}

pub fn search_by_embedding(
    conn: &Connection,
    query: &[f32],
    k: usize,
) -> Result<Vec<EmbeddingSearchResult>, rusqlite::Error> {
    if query.is_empty() {
        return Ok(Vec::new());
    }

    let mut stmt = conn.prepare_cached(
        "SELECT id, path, file_name, duration, bpm, periodicity, sample_rate, file_size, artist, low_ratio, attack_slope, decay_time, sample_type, waveform_peaks, embedding, is_online, playback_type, instrument_type FROM samples WHERE embedding IS NOT NULL",
    )?;
    let rows = stmt.query_map([], |row| row_to_sample(row))?;

    let mut scored: Vec<(f32, SampleRow)> = Vec::new();
    for r in rows {
        if let Ok(sample) = r {
            if let Some(ref blob) = sample.embedding {
                if blob.len() % 4 != 0 {
                    continue;
                }
                let dim = blob.len() / 4;
                if dim != query.len() {
                    continue;
                }
                let other: Vec<f32> = (0..dim)
                    .map(|i| {
                        f32::from_le_bytes([
                            blob[i * 4],
                            blob[i * 4 + 1],
                            blob[i * 4 + 2],
                            blob[i * 4 + 3],
                        ])
                    })
                    .collect();
                scored.push((cos_sim(query, &other), sample));
            }
        }
    }
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

pub fn list_samples_around_id(
    conn: &Connection,
    target_id: i64,
    limit: usize,
) -> Result<Vec<SampleRow>, rusqlite::Error> {
    let half = (limit as i64) / 2;

    let max_id: i64 = conn.query_row("SELECT MAX(id) FROM samples", [], |row| row.get(0))?;

    let before = if target_id - half < 1 {
        target_id - 1
    } else {
        half
    };
    let after = half;

    let mut before_rows: Vec<SampleRow> = {
        let start_id = (target_id - before).max(1);
        let mut stmt = conn.prepare_cached(
            "SELECT id, path, file_name, duration, bpm, periodicity, sample_rate, file_size, artist, low_ratio, attack_slope, decay_time, sample_type, waveform_peaks, embedding, is_online, playback_type, instrument_type FROM samples WHERE id >= ?1 AND id < ?2 ORDER BY id DESC",
        )?;
        let rows = stmt
            .query_map(params![start_id, target_id], row_to_sample)?
            .collect::<Result<Vec<_>, _>>()?;
        rows
    };
    before_rows.reverse();

    let after_limit = limit - before_rows.len();
    let after_end = (target_id + after).min(max_id + 1);
    let after_rows: Vec<SampleRow> = if after_limit > 0 {
        let mut stmt = conn.prepare_cached(
            "SELECT id, path, file_name, duration, bpm, periodicity, sample_rate, file_size, artist, low_ratio, attack_slope, decay_time, sample_type, waveform_peaks, embedding, is_online, playback_type, instrument_type FROM samples WHERE id >= ?1 AND id < ?2 ORDER BY id",
        )?;
        let rows = stmt
            .query_map(params![target_id, after_end], row_to_sample)?
            .collect::<Result<Vec<_>, _>>()?;
        rows
    } else {
        vec![]
    };

    let mut result = before_rows;
    result.extend(after_rows);
    result.truncate(limit);
    Ok(result)
}

pub fn get_all_sample_paths(conn: &Connection) -> Result<Vec<String>, rusqlite::Error> {
    let mut stmt = conn.prepare_cached("SELECT path FROM samples ORDER BY id")?;
    let rows = stmt.query_map([], |row| row.get(0))?.collect();
    rows
}

pub fn delete_sample(conn: &Connection, path: &str) -> Result<usize, rusqlite::Error> {
    let row_info: Option<(i64, String)> = {
        let mut stmt = conn.prepare_cached("SELECT id, file_name FROM samples WHERE path = ?1")?;
        stmt.query_row(params![path], |row| Ok((row.get(0)?, row.get(1)?)))
            .optional()?
    };
    if let Some((rowid, file_name)) = row_info {
        let mut fts_stmt =
            conn.prepare_cached("DELETE FROM samples_fts WHERE rowid = ?1 AND file_name = ?2")?;
        let _ = fts_stmt.execute(params![rowid, file_name]);
        let mut tags_stmt = conn.prepare_cached("DELETE FROM sample_tags WHERE sample_id = ?1")?;
        let _ = tags_stmt.execute(params![rowid]);
        let mut stmt = conn.prepare_cached("DELETE FROM samples WHERE id = ?1")?;
        Ok(stmt.execute(params![rowid])?)
    } else {
        Ok(0)
    }
}

pub fn clear_all_samples(conn: &Connection) -> Result<usize, rusqlite::Error> {
    conn.execute("DELETE FROM samples_fts", [])?;
    conn.execute("DELETE FROM sample_tags", [])?;
    Ok(conn.execute("DELETE FROM samples", [])?)
}

pub fn move_sample_path(
    conn: &Connection,
    old_path: &str,
    new_path: &str,
) -> Result<usize, rusqlite::Error> {
    let new_file_name = std::path::Path::new(new_path)
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("unknown")
        .to_string();
    let old_file_name: String = conn.query_row(
        "SELECT file_name FROM samples WHERE path = ?1",
        params![old_path],
        |row| row.get(0),
    )?;
    let updated = conn.execute(
        "UPDATE samples SET path = ?1, file_name = ?2 WHERE path = ?3",
        params![new_path, new_file_name, old_path],
    )?;
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

pub(super) fn row_to_sample(row: &rusqlite::Row<'_>) -> Result<SampleRow, rusqlite::Error> {
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

fn list_all_samples(conn: &Connection) -> Result<Vec<SampleRow>, rusqlite::Error> {
    let mut stmt = conn.prepare_cached(
        "SELECT id, path, file_name, duration, bpm, periodicity, sample_rate, file_size, artist, low_ratio, attack_slope,
                decay_time, sample_type, waveform_peaks, embedding, is_online, playback_type, instrument_type
         FROM samples ORDER BY id",
    )?;
    let rows = stmt.query_map([], row_to_sample)?.collect();
    rows
}

fn run_fts_query(
    conn: &Connection,
    query: &str,
    limit: Option<usize>,
    offset: Option<usize>,
) -> Result<Vec<SampleRow>, rusqlite::Error> {
    match (limit, offset) {
        (Some(lim), Some(off)) => {
            let mut stmt = conn.prepare_cached(
                "SELECT s.id, s.path, s.file_name, s.duration, s.bpm, s.periodicity,
                        s.sample_rate, s.file_size, s.artist, s.low_ratio, s.attack_slope, s.decay_time, s.sample_type,
                        s.waveform_peaks, s.embedding, s.is_online, s.playback_type, s.instrument_type
                 FROM samples_fts f JOIN samples s ON s.id = f.rowid
                 WHERE f.file_name MATCH ?1 ORDER BY rank LIMIT ?2 OFFSET ?3",
            )?;
            let rows = stmt
                .query_map(params![query, lim as i64, off as i64], row_to_sample)?
                .collect();
            rows
        }
        _ => {
            let mut stmt = conn.prepare_cached(
                "SELECT s.id, s.path, s.file_name, s.duration, s.bpm, s.periodicity,
                        s.sample_rate, s.file_size, s.artist, s.low_ratio, s.attack_slope, s.decay_time, s.sample_type,
                        s.waveform_peaks, s.embedding, s.is_online, s.playback_type, s.instrument_type
                 FROM samples_fts f JOIN samples s ON s.id = f.rowid
                 WHERE f.file_name MATCH ?1 ORDER BY rank",
            )?;
            let rows = stmt.query_map(params![query], row_to_sample)?.collect();
            rows
        }
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
                let mut s = core.to_string();
                if is_prefix {
                    s.push('*');
                }
                return Some(s);
            }
            let mut s = String::with_capacity(core.len() + 2);
            s.push('"');
            s.push_str(&core.replace('"', "\"\""));
            s.push('"');
            Some(s)
        })
        .collect::<Vec<_>>()
        .join(" ")
}

fn cos_sim(a: &[f32], b: &[f32]) -> f32 {
    let (mut dot, mut na, mut nb) = (0.0f32, 0.0f32, 0.0f32);
    for i in 0..a.len() {
        dot += a[i] * b[i];
        na += a[i] * a[i];
        nb += b[i] * b[i];
    }
    dot / (na.sqrt() * nb.sqrt()).max(1e-8)
}

pub(super) trait OptionalExt<T> {
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

    fn setup_db() -> Connection {
        let conn = Connection::open_in_memory().expect("failed to create in-memory DB");
        init_database(&conn).expect("failed to initialize schema");
        conn
    }

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

    #[test]
    fn test_insert_sample_returns_rowid() {
        let conn = setup_db();
        let id = insert_sample(&conn, &make_input("/samples/kick_808.wav", "kick_808.wav"))
            .expect("insert failed");
        assert!(id > 0);
    }

    #[test]
    fn test_insert_sample_duplicate_path_fails() {
        let conn = setup_db();
        let input = make_input("/samples/kick.wav", "kick.wav");
        insert_sample(&conn, &input).expect("first insert failed");
        assert!(
            insert_sample(&conn, &input).is_err(),
            "duplicate path should fail"
        );
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
        assert!(insert_sample(&conn, &input).expect("insert with nulls failed") > 0);
    }

    #[test]
    fn test_get_sample_by_path_found() {
        let conn = setup_db();
        insert_sample(&conn, &make_input("/samples/kick_808.wav", "kick_808.wav"))
            .expect("insert failed");
        let sample = get_sample_by_path(&conn, "/samples/kick_808.wav")
            .expect("query failed")
            .expect("sample not found");
        assert_eq!(sample.path, "/samples/kick_808.wav");
        assert_eq!(sample.bpm, Some(120.0));
        assert!(sample.is_online);
    }

    #[test]
    fn test_get_sample_by_path_not_found() {
        let conn = setup_db();
        assert!(get_sample_by_path(&conn, "/nonexistent.wav")
            .expect("query failed")
            .is_none());
    }

    #[test]
    fn test_update_sample_modifies_fields() {
        let conn = setup_db();
        let input = make_input("/samples/kick.wav", "kick.wav");
        insert_sample(&conn, &input).expect("insert failed");
        let updated_input = SampleInput {
            path: "/samples/kick.wav".to_string(),
            file_name: "kick_renamed.wav".to_string(),
            bpm: Some(140.0),
            sample_type: Some("loop".to_string()),
            embedding: Some(vec![1, 2, 3, 4]),
            ..input
        };
        assert_eq!(
            update_sample(&conn, &updated_input).expect("update failed"),
            1
        );
        let sample = get_sample_by_path(&conn, "/samples/kick.wav")
            .expect("query failed")
            .expect("not found");
        assert_eq!(sample.file_name, "kick_renamed.wav");
        assert_eq!(sample.bpm, Some(140.0));
        assert_eq!(sample.embedding, Some(vec![1, 2, 3, 4]));
    }

    #[test]
    fn test_update_sample_updates_playback_and_instrument() {
        let conn = setup_db();
        let input = make_input("/samples/test.wav", "test.wav");
        insert_sample(&conn, &input).expect("insert failed");
        let updated = SampleInput {
            playback_type: Some("loop".to_string()),
            instrument_type: Some("snare".to_string()),
            ..input.clone()
        };
        assert_eq!(update_sample(&conn, &updated).expect("update failed"), 1);
        let sample = get_sample_by_path(&conn, "/samples/test.wav")
            .expect("query failed")
            .expect("not found");
        assert_eq!(sample.playback_type, "loop");
        assert_eq!(sample.instrument_type, "snare");
    }

    #[test]
    fn test_update_nonexistent_sample_returns_zero() {
        let conn = setup_db();
        assert_eq!(
            update_sample(&conn, &make_input("/nonexistent.wav", "nope.wav"))
                .expect("update failed"),
            0
        );
    }

    #[test]
    fn test_update_sample_updates_fts() {
        let conn = setup_db();
        let input = make_input("/samples/old_name.wav", "old_name.wav");
        insert_sample(&conn, &input).expect("insert failed");
        update_sample(
            &conn,
            &SampleInput {
                file_name: "new_name.wav".to_string(),
                ..input
            },
        )
        .expect("update failed");
        assert!(search_samples(&conn, "old_name")
            .expect("fts search failed")
            .is_empty());
        let new_results = search_samples(&conn, "new_name").expect("fts search failed");
        assert_eq!(new_results.len(), 1);
        assert_eq!(new_results[0].file_name, "new_name.wav");
    }

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
        assert!(search_samples(&conn, "cymbal")
            .expect("search failed")
            .is_empty());
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
        assert_eq!(
            search_samples(&conn, "kick*").expect("search failed").len(),
            2
        );
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
        assert_eq!(search_samples(&conn, "").expect("search failed").len(), 2);
        assert_eq!(
            search_samples(&conn, "   \t\n")
                .expect("search failed")
                .len(),
            2
        );
    }

    #[test]
    fn test_search_samples_special_chars_do_not_error() {
        let conn = setup_db();
        insert_sample(&conn, &make_input("/samples/kick.wav", "kick.wav")).expect("insert failed");
        assert!(search_samples(&conn, "(")
            .expect("search failed")
            .is_empty());
        assert!(search_samples(&conn, "\"")
            .expect("search failed")
            .is_empty());
    }

    #[test]
    fn test_delete_sample_removes_row() {
        let conn = setup_db();
        insert_sample(&conn, &make_input("/samples/kick.wav", "kick.wav")).expect("insert failed");
        assert_eq!(
            delete_sample(&conn, "/samples/kick.wav").expect("delete failed"),
            1
        );
        assert!(get_sample_by_path(&conn, "/samples/kick.wav")
            .expect("query failed")
            .is_none());
    }

    #[test]
    fn test_delete_sample_removes_fts_entry() {
        let conn = setup_db();
        insert_sample(&conn, &make_input("/samples/kick.wav", "kick.wav")).expect("insert failed");
        delete_sample(&conn, "/samples/kick.wav").expect("delete failed");
        assert!(search_samples(&conn, "kick")
            .expect("search failed")
            .is_empty());
    }

    #[test]
    fn test_delete_nonexistent_returns_zero() {
        let conn = setup_db();
        assert_eq!(
            delete_sample(&conn, "/nonexistent.wav").expect("delete failed"),
            0
        );
    }

    #[test]
    fn test_delete_sample_removes_tags() {
        let conn = setup_db();
        let id = insert_sample(&conn, &make_input("/samples/kick.wav", "kick.wav"))
            .expect("insert failed");
        conn.execute("INSERT INTO tags (name) VALUES ('drums')", [])
            .expect("tag insert failed");
        conn.execute(
            "INSERT INTO sample_tags (sample_id, tag_id) VALUES (?1, 1)",
            params![id],
        )
        .expect("sample_tag insert failed");
        delete_sample(&conn, "/samples/kick.wav").expect("delete failed");
        let tag_count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sample_tags WHERE sample_id = ?1",
                params![id],
                |row| row.get(0),
            )
            .expect("count failed");
        assert_eq!(tag_count, 0);
    }

    #[test]
    fn test_insert_search_update_delete_roundtrip() {
        let conn = setup_db();
        let input = make_input("/samples/kick_808.wav", "kick_808.wav");
        let id = insert_sample(&conn, &input).expect("insert failed");
        assert!(id > 0);
        assert_eq!(
            search_samples(&conn, "kick").expect("search failed").len(),
            1
        );
        update_sample(
            &conn,
            &SampleInput {
                bpm: Some(140.0),
                ..input.clone()
            },
        )
        .expect("update failed");
        assert_eq!(
            get_sample_by_path(&conn, "/samples/kick_808.wav")
                .expect("get failed")
                .expect("not found")
                .bpm,
            Some(140.0)
        );
        delete_sample(&conn, "/samples/kick_808.wav").expect("delete failed");
        assert!(get_sample_by_path(&conn, "/samples/kick_808.wav")
            .expect("get failed")
            .is_none());
        assert!(search_samples(&conn, "kick")
            .expect("search failed")
            .is_empty());
    }
}
