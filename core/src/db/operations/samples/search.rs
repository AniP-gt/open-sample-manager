use rusqlite::Connection;

use crate::db::operations::fuzzy::matches_fuzzy_query;
use crate::db::operations::types::SampleRow;

use super::queries::{
    directory_like_pattern, list_all_samples, list_samples_paginated, normalize_directory_path,
};
use super::row_to_sample;

pub fn search_samples(conn: &Connection, query: &str) -> Result<Vec<SampleRow>, rusqlite::Error> {
    let query = query.trim();
    if query.is_empty() {
        return list_all_samples(conn);
    }
    fuzzy_sample_rows(conn, query, None).map(|rows| rows.into_iter().map(|(row, _)| row).collect())
}

pub fn search_samples_paginated(
    conn: &Connection,
    query: &str,
    limit: usize,
    offset: usize,
    directory_path: Option<&str>,
) -> Result<Vec<SampleRow>, rusqlite::Error> {
    let query = query.trim();
    if query.is_empty() {
        return list_samples_paginated(conn, limit, offset, directory_path);
    }
    fuzzy_sample_rows(conn, query, directory_path).map(|rows| {
        rows.into_iter()
            .skip(offset)
            .take(limit)
            .map(|(row, _)| row)
            .collect()
    })
}

fn fuzzy_sample_rows(
    conn: &Connection,
    query: &str,
    directory_path: Option<&str>,
) -> Result<Vec<(SampleRow, String)>, rusqlite::Error> {
    let directory_path = normalize_directory_path(directory_path);
    let sql = if directory_path.is_some() {
        "SELECT s.id, s.path, s.file_name, s.duration, s.bpm, s.periodicity, s.sample_rate, s.file_size,
                s.artist, s.low_ratio, s.attack_slope, s.decay_time, s.sample_type, s.waveform_peaks,
                s.embedding, s.is_online, s.playback_type, s.instrument_type, s.musical_key,
                COALESCE(GROUP_CONCAT(t.name, ' '), '') AS tag_names
         FROM samples s
         LEFT JOIN sample_tags st ON st.sample_id = s.id
         LEFT JOIN tags t ON t.id = st.tag_id
         WHERE REPLACE(s.path, '\\', '/') = ?1 OR REPLACE(s.path, '\\', '/') LIKE ?2 ESCAPE '\\'
         GROUP BY s.id
         ORDER BY s.id"
    } else {
        "SELECT s.id, s.path, s.file_name, s.duration, s.bpm, s.periodicity, s.sample_rate, s.file_size,
                s.artist, s.low_ratio, s.attack_slope, s.decay_time, s.sample_type, s.waveform_peaks,
                s.embedding, s.is_online, s.playback_type, s.instrument_type, s.musical_key,
                COALESCE(GROUP_CONCAT(t.name, ' '), '') AS tag_names
         FROM samples s
         LEFT JOIN sample_tags st ON st.sample_id = s.id
         LEFT JOIN tags t ON t.id = st.tag_id
         GROUP BY s.id
         ORDER BY s.id"
    };
    let mut stmt = conn.prepare_cached(sql)?;
    let rows = if let Some(directory_path) = directory_path {
        let like_pattern = directory_like_pattern(&directory_path);
        stmt.query_map(rusqlite::params![directory_path, like_pattern], row_with_tags)?
    } else {
        stmt.query_map([], row_with_tags)?
    };

    rows.filter_map(|row| match row {
        Ok((sample, tag_names)) => {
            if matches_fuzzy_query(query, &[sample.file_name.as_str(), tag_names.as_str()]) {
                Some(Ok((sample, tag_names)))
            } else {
                None
            }
        }
        Err(err) => Some(Err(err)),
    })
    .collect()
}

fn row_with_tags(row: &rusqlite::Row<'_>) -> rusqlite::Result<(SampleRow, String)> {
    Ok((row_to_sample(row)?, row.get::<_, String>("tag_names")?))
}
