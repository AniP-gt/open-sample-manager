mod embedding;
mod queries;
mod row_mapping;
mod search;

#[cfg(test)]
mod tests;

use rusqlite::{params, Connection};

use super::types::SampleInput;

pub use embedding::search_by_embedding;
pub use queries::{
    get_all_sample_paths, get_sample_by_id, get_sample_by_path, list_duplicate_groups,
    list_samples_around_id, list_samples_paginated,
};
pub(in crate::db::operations::samples) use row_mapping::row_to_sample;
pub use search::{search_samples, search_samples_paginated};

pub fn insert_sample(conn: &Connection, input: &SampleInput) -> Result<i64, rusqlite::Error> {
    let mut stmt = conn.prepare_cached(
        "INSERT INTO samples (path, file_name, duration, bpm, periodicity, sample_rate, file_size, artist, low_ratio, attack_slope, decay_time, sample_type, waveform_peaks, embedding, source, pack_name, license, license_url, license_memo, imported_at, peak_db, rms_db, leading_silence_ms, clipping_count, channel_count, bit_depth, quality_flags, playback_type, instrument_type, musical_key, content_hash)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, COALESCE(?20, CURRENT_TIMESTAMP), ?21, ?22, ?23, ?24, ?25, ?26, ?27, COALESCE(?28, 'oneshot'), COALESCE(?29, 'other'), ?30, ?31)",
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
        input.source,
        input.pack_name,
        input.license,
        input.license_url,
        input.license_memo,
        input.imported_at,
        input.peak_db,
        input.rms_db,
        input.leading_silence_ms,
        input.clipping_count,
        input.channel_count,
        input.bit_depth,
        input.quality_flags,
        input.playback_type,
        input.instrument_type,
        input.musical_key,
        input.content_hash,
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
         source = COALESCE(?13, source), pack_name = COALESCE(?14, pack_name), license = COALESCE(?15, license),
         license_url = COALESCE(?16, license_url), license_memo = COALESCE(?17, license_memo), imported_at = COALESCE(imported_at, ?18, CURRENT_TIMESTAMP),
         peak_db = ?19, rms_db = ?20, leading_silence_ms = ?21, clipping_count = ?22, channel_count = ?23, bit_depth = ?24, quality_flags = ?25,
         playback_type = COALESCE(?26, playback_type), instrument_type = COALESCE(?27, instrument_type),
         musical_key = COALESCE(?28, musical_key), content_hash = ?29
         WHERE path = ?30",
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
        input.source,
        input.pack_name,
        input.license,
        input.license_url,
        input.license_memo,
        input.imported_at,
        input.peak_db,
        input.rms_db,
        input.leading_silence_ms,
        input.clipping_count,
        input.channel_count,
        input.bit_depth,
        input.quality_flags,
        input.playback_type,
        input.instrument_type,
        input.musical_key,
        input.content_hash,
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

pub fn update_sample_license_metadata(
    conn: &Connection,
    path: &str,
    source: Option<&str>,
    pack_name: Option<&str>,
    license: Option<&str>,
    license_url: Option<&str>,
    license_memo: Option<&str>,
) -> Result<usize, rusqlite::Error> {
    let mut stmt = conn.prepare_cached(
        "UPDATE samples SET source = ?1, pack_name = ?2, license = ?3, license_url = ?4, license_memo = ?5 WHERE path = ?6",
    )?;
    stmt.execute(params![
        source,
        pack_name,
        license,
        license_url,
        license_memo,
        path,
    ])
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

pub(in crate::db::operations::samples) trait OptionalExt<T> {
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
