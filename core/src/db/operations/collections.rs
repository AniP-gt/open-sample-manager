use rusqlite::{params, Connection, Error, OptionalExtension};

use super::types::{CollectionAddResult, CollectionMemberRow, CollectionRow, SampleRow};

const COLLECTION_SELECT: &str = "SELECT c.id, c.name, c.created_at, COUNT(cm.sample_id) AS sample_count\n     FROM collections c\n     LEFT JOIN collection_members cm ON cm.collection_id = c.id\n     GROUP BY c.id\n     ORDER BY c.created_at, c.id";

const COLLECTION_SELECT_BY_ID: &str = "SELECT c.id, c.name, c.created_at, COUNT(cm.sample_id) AS sample_count\n     FROM collections c\n     LEFT JOIN collection_members cm ON cm.collection_id = c.id\n     WHERE c.id = ?1\n     GROUP BY c.id";

const COLLECTION_MEMBER_ONLY_SELECT: &str =
    "SELECT sample_id, position FROM collection_members WHERE collection_id = ?1 ORDER BY position";

const COLLECTION_MEMBER_SAMPLE_SELECT: &str = "SELECT\n        s.id, s.path, s.file_name, s.duration, s.bpm, s.periodicity, s.sample_rate,\n        s.file_size, s.artist, s.low_ratio, s.attack_slope, s.decay_time, s.sample_type,\n        s.waveform_peaks, s.embedding, s.source, s.pack_name, s.license, s.license_url,\n        s.license_memo, s.imported_at, s.peak_db, s.rms_db, s.leading_silence_ms,\n        s.clipping_count, s.channel_count, s.bit_depth, s.quality_flags,\n        s.is_online, s.playback_type, s.instrument_type, s.musical_key, s.content_hash,\n        COALESCE(tag_names.tag_names, '') AS tag_names,\n        cm.position, cm.sample_id, cm.collection_id\n     FROM collection_members cm\n     JOIN samples s ON s.id = cm.sample_id\n     LEFT JOIN (\n         SELECT st.sample_id AS sample_id, GROUP_CONCAT(t.name, '\u{001f}') AS tag_names\n         FROM sample_tags st\n         JOIN tags t ON t.id = st.tag_id\n         GROUP BY st.sample_id\n     ) tag_names ON tag_names.sample_id = s.id\n     WHERE cm.collection_id = ?1\n     ORDER BY cm.position";

/// Trims Unicode whitespace, collapses whitespace runs, and lowercases Unicode scalar values.
pub fn normalize_collection_name(name: &str) -> Result<String, Error> {
    let mut normalized = String::with_capacity(name.len());
    let mut previous_was_space = false;

    for ch in name.trim().chars() {
        if ch.is_whitespace() {
            if !previous_was_space {
                normalized.push(' ');
                previous_was_space = true;
            }
            continue;
        }

        for lowered in ch.to_lowercase() {
            normalized.push(lowered);
        }
        previous_was_space = false;
    }

    let normalized = normalized.trim();
    if normalized.is_empty() {
        return Err(Error::InvalidParameterName(
            "collection name cannot be empty".to_string(),
        ));
    }

    Ok(normalized.to_string())
}

pub fn list_collections(conn: &Connection) -> Result<Vec<CollectionRow>, Error> {
    let mut stmt = conn.prepare_cached(COLLECTION_SELECT)?;
    let rows = stmt.query_map([], row_to_collection_row)?;
    rows.into_iter().collect()
}

pub fn get_collection_by_id(
    conn: &Connection,
    collection_id: i64,
) -> Result<Option<CollectionRow>, Error> {
    let mut stmt = conn.prepare_cached(COLLECTION_SELECT_BY_ID)?;
    stmt.query_row(params![collection_id], row_to_collection_row)
        .optional()
}

pub fn add_samples_to_collection(
    conn: &mut Connection,
    name: &str,
    sample_ids: &[i64],
) -> Result<CollectionAddResult, Error> {
    if sample_ids.is_empty() {
        return Err(Error::InvalidParameterCount(1, sample_ids.len()));
    }

    if sample_ids.len() > 100 {
        return Err(Error::InvalidParameterCount(100, sample_ids.len()));
    }

    let normalized_name = normalize_collection_name(name)?;
    let tx = conn.transaction()?;

    {
        let mut exists_stmt = tx.prepare_cached("SELECT 1 FROM samples WHERE id = ?1")?;
        for &sample_id in sample_ids {
            exists_stmt.query_row(params![sample_id], |_row| Ok::<(), Error>(()))?;
        }
    }

    let created = tx.execute(
        "INSERT INTO collections (name) VALUES (?1) ON CONFLICT(name) DO NOTHING",
        params![normalized_name],
    )? > 0;
    let collection_id: i64 = tx.query_row(
        "SELECT id FROM collections WHERE name = ?1",
        params![normalized_name],
        |row| row.get(0),
    )?;

    let mut next_position: i64 = tx.query_row(
        "SELECT COALESCE(MAX(position), 0) + 1 FROM collection_members WHERE collection_id = ?1",
        params![collection_id],
        |row| row.get(0),
    )?;

    let mut inserted = 0usize;
    {
        let mut stmt = tx.prepare_cached(
            "INSERT INTO collection_members (collection_id, sample_id, position)             VALUES (?1, ?2, ?3)             ON CONFLICT(collection_id, sample_id) DO NOTHING",
        )?;
        for &sample_id in sample_ids {
            let count = stmt.execute(params![collection_id, sample_id, next_position])?;
            if count > 0 {
                inserted += 1;
                next_position += 1;
            }
        }
    }

    tx.commit()?;
    Ok(CollectionAddResult {
        collection_id,
        added_count: inserted,
        created,
    })
}

pub fn list_collection_member_sample_ids(
    conn: &Connection,
    collection_id: i64,
) -> Result<Vec<i64>, Error> {
    let mut stmt = conn.prepare_cached(COLLECTION_MEMBER_ONLY_SELECT)?;
    let rows = stmt.query_map(params![collection_id], |row| row.get(0))?;
    rows.into_iter().collect()
}

pub fn get_collection_members(
    conn: &Connection,
    collection_id: i64,
) -> Result<Vec<SampleRow>, Error> {
    let mut stmt = conn.prepare_cached(COLLECTION_MEMBER_SAMPLE_SELECT)?;
    let rows = stmt.query_map(params![collection_id], row_to_sample)?;
    rows.into_iter().collect()
}

pub fn list_collection_members_with_positions(
    conn: &Connection,
    collection_id: i64,
) -> Result<Vec<CollectionMemberRow>, Error> {
    let mut stmt = conn.prepare_cached(COLLECTION_MEMBER_SAMPLE_SELECT)?;
    let rows = stmt.query_map(params![collection_id], |row| {
        Ok(CollectionMemberRow {
            collection_id: row.get("collection_id")?,
            sample_id: row.get("sample_id")?,
            position: row.get("position")?,
            sample: row_to_sample(row)?,
        })
    })?;
    rows.into_iter().collect()
}

fn row_to_collection_row(row: &rusqlite::Row<'_>) -> Result<CollectionRow, Error> {
    Ok(CollectionRow {
        id: row.get("id")?,
        name: row.get("name")?,
        created_at: row.get("created_at")?,
        sample_count: row.get("sample_count")?,
    })
}

fn row_to_sample(row: &rusqlite::Row<'_>) -> Result<SampleRow, Error> {
    let tag_names = optional_string(row, "tag_names")?;
    Ok(SampleRow {
        id: row.get("id")?,
        path: row.get("path")?,
        file_name: row.get("file_name")?,
        duration: row.get("duration")?,
        bpm: row.get("bpm")?,
        periodicity: row.get("periodicity")?,
        sample_rate: row.get("sample_rate")?,
        file_size: row.get("file_size")?,
        artist: row.get("artist")?,
        low_ratio: row.get("low_ratio")?,
        attack_slope: row.get("attack_slope")?,
        decay_time: row.get("decay_time")?,
        sample_type: row.get("sample_type")?,
        waveform_peaks: row.get("waveform_peaks")?,
        embedding: row.get("embedding")?,
        source: row.get("source")?,
        pack_name: row.get("pack_name")?,
        license: row.get("license")?,
        license_url: row.get("license_url")?,
        license_memo: row.get("license_memo")?,
        imported_at: row.get("imported_at")?,
        peak_db: row.get("peak_db")?,
        rms_db: row.get("rms_db")?,
        leading_silence_ms: row.get("leading_silence_ms")?,
        clipping_count: row.get("clipping_count")?,
        channel_count: row.get("channel_count")?,
        bit_depth: row.get("bit_depth")?,
        quality_flags: row.get("quality_flags")?,
        is_online: row.get::<_, i32>("is_online")? != 0,
        playback_type: row.get("playback_type")?,
        instrument_type: row.get("instrument_type")?,
        musical_key: row.get("musical_key")?,
        content_hash: row.get("content_hash")?,
        duplicate_count: 1,
        tags: parse_tag_names(tag_names.as_deref()),
    })
}

fn optional_string(row: &rusqlite::Row<'_>, index: &str) -> Result<Option<String>, Error> {
    match row.get::<_, Option<String>>(index) {
        Ok(tag_names) => Ok(tag_names),
        Err(Error::InvalidColumnName(_)) => Ok(None),
        Err(err) => Err(err),
    }
}

fn parse_tag_names(tag_names: Option<&str>) -> Vec<String> {
    tag_names
        .unwrap_or("")
        .split('\u{001f}')
        .filter(|name| !name.is_empty())
        .map(ToString::to_string)
        .collect()
}

#[cfg(test)]
#[path = "collections/tests.rs"]
mod tests;
