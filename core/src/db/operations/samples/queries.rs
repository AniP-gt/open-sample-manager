use rusqlite::{params, Connection};

use crate::db::operations::types::{DuplicateGroup, SampleRow};

use super::{row_to_sample, OptionalExt};

pub(in crate::db::operations::samples) const SAMPLE_COLUMNS: &str = "id, path, file_name, duration, bpm, periodicity, sample_rate, file_size, artist, low_ratio, attack_slope, decay_time, sample_type, waveform_peaks, embedding, is_online, playback_type, instrument_type, musical_key, content_hash, COALESCE((SELECT COUNT(*) FROM samples dup WHERE dup.content_hash = samples.content_hash AND dup.content_hash IS NOT NULL), 1) AS duplicate_count, COALESCE((SELECT GROUP_CONCAT(name, char(31)) FROM (SELECT t.name AS name FROM sample_tags st JOIN tags t ON t.id = st.tag_id WHERE st.sample_id = samples.id ORDER BY t.name)), '') AS tag_names";

pub fn get_sample_by_path(
    conn: &Connection,
    path: &str,
) -> Result<Option<SampleRow>, rusqlite::Error> {
    let mut stmt = conn.prepare_cached(&format!(
        "SELECT {SAMPLE_COLUMNS} FROM samples WHERE path = ?1"
    ))?;
    stmt.query_row(params![path], row_to_sample).optional()
}

pub fn get_sample_by_id(conn: &Connection, id: i64) -> Result<Option<SampleRow>, rusqlite::Error> {
    let mut stmt = conn.prepare_cached(&format!(
        "SELECT {SAMPLE_COLUMNS} FROM samples WHERE id = ?1"
    ))?;
    stmt.query_row(params![id], row_to_sample).optional()
}

pub fn list_samples_paginated(
    conn: &Connection,
    limit: usize,
    offset: usize,
    directory_path: Option<&str>,
) -> Result<Vec<SampleRow>, rusqlite::Error> {
    if let Some(directory_path) = normalize_directory_path(directory_path) {
        let like_pattern = directory_like_pattern(&directory_path);
        let mut stmt = conn.prepare_cached(&format!(
            "SELECT {SAMPLE_COLUMNS} FROM samples
             WHERE REPLACE(path, '\\', '/') = ?1 OR REPLACE(path, '\\', '/') LIKE ?2 ESCAPE '\\'
             ORDER BY id LIMIT ?3 OFFSET ?4"
        ))?;
        let rows = stmt.query_map(
            params![directory_path, like_pattern, limit as i64, offset as i64],
            row_to_sample,
        )?;
        return rows.collect();
    }

    let mut stmt = conn.prepare_cached(&format!(
        "SELECT {SAMPLE_COLUMNS} FROM samples ORDER BY id LIMIT ?1 OFFSET ?2"
    ))?;
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
    let mut before_rows: Vec<SampleRow> = {
        let start_id = (target_id - before).max(1);
        let mut stmt = conn.prepare_cached(&format!(
            "SELECT {SAMPLE_COLUMNS} FROM samples WHERE id >= ?1 AND id < ?2 ORDER BY id DESC"
        ))?;
        let rows = stmt
            .query_map(params![start_id, target_id], row_to_sample)?
            .collect::<Result<Vec<_>, _>>()?;
        rows
    };
    before_rows.reverse();

    let after_limit = limit - before_rows.len();
    let after_end = (target_id + after_limit as i64).min(max_id + 1);
    let after_rows: Vec<SampleRow> = if after_limit > 0 {
        let mut stmt = conn.prepare_cached(&format!(
            "SELECT {SAMPLE_COLUMNS} FROM samples WHERE id >= ?1 AND id < ?2 ORDER BY id"
        ))?;
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

pub(in crate::db::operations::samples) fn normalize_directory_path(
    directory_path: Option<&str>,
) -> Option<String> {
    let normalized = directory_path?.trim().replace('\\', "/");
    if normalized.is_empty() {
        return None;
    }
    if normalized == "/" {
        return Some(normalized);
    }
    Some(normalized.trim_end_matches('/').to_string())
}

pub(in crate::db::operations::samples) fn directory_like_pattern(directory_path: &str) -> String {
    let escaped = escape_like_pattern(directory_path);
    if directory_path == "/" {
        format!("{escaped}%")
    } else {
        format!("{escaped}/%")
    }
}

fn escape_like_pattern(value: &str) -> String {
    let mut escaped = String::with_capacity(value.len());
    for ch in value.chars() {
        if matches!(ch, '%' | '_' | '\\') {
            escaped.push('\\');
        }
        escaped.push(ch);
    }
    escaped
}

pub(in crate::db::operations::samples) fn list_all_samples(
    conn: &Connection,
) -> Result<Vec<SampleRow>, rusqlite::Error> {
    let mut stmt =
        conn.prepare_cached(&format!("SELECT {SAMPLE_COLUMNS} FROM samples ORDER BY id"))?;
    let rows = stmt.query_map([], row_to_sample)?.collect();
    rows
}

pub fn list_duplicate_groups(conn: &Connection) -> Result<Vec<DuplicateGroup>, rusqlite::Error> {
    let mut group_stmt = conn.prepare_cached(
        "SELECT content_hash, COUNT(*) AS sample_count, COALESCE(SUM(file_size), 0) AS total_file_size
         FROM samples
         WHERE content_hash IS NOT NULL
         GROUP BY content_hash
         HAVING COUNT(*) > 1
         ORDER BY sample_count DESC, content_hash",
    )?;
    let group_rows = group_stmt.query_map([], |row| {
        Ok((
            row.get::<_, String>("content_hash")?,
            row.get::<_, i64>("sample_count")?,
            row.get::<_, i64>("total_file_size")?,
        ))
    })?;

    let mut groups = Vec::new();
    for group in group_rows {
        let (content_hash, sample_count, total_file_size) = group?;
        let mut sample_stmt = conn.prepare_cached(&format!(
            "SELECT {SAMPLE_COLUMNS} FROM samples WHERE content_hash = ?1 ORDER BY id"
        ))?;
        let samples = sample_stmt
            .query_map(params![content_hash.as_str()], row_to_sample)?
            .collect::<Result<Vec<_>, _>>()?;
        groups.push(DuplicateGroup {
            content_hash,
            sample_count,
            total_file_size,
            samples,
        });
    }

    Ok(groups)
}
