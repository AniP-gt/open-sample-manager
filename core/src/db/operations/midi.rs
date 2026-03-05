use rusqlite::{params, Connection};

use super::types::{MidiInput, MidiRow, MidiTagRow};

const MIDI_SELECT: &str = "SELECT m.id, m.path, m.file_name, m.duration, m.tempo,
            m.time_signature_numerator, m.time_signature_denominator,
            m.track_count, m.note_count, m.channel_count, m.key_estimate,
            m.file_size, m.created_at, m.modified_at,
            COALESCE(t.name, '') as tag_name
     FROM midis m
     LEFT JOIN midi_file_tags mft ON mft.midi_id = m.id
     LEFT JOIN midi_tags t ON t.id = mft.tag_id";

fn row_to_midi(row: &rusqlite::Row) -> rusqlite::Result<MidiRow> {
    Ok(MidiRow {
        id: row.get(0)?,
        path: row.get(1)?,
        file_name: row.get(2)?,
        duration: row.get(3)?,
        tempo: row.get(4)?,
        time_signature_numerator: row.get(5)?,
        time_signature_denominator: row.get(6)?,
        track_count: row.get(7)?,
        note_count: row.get(8)?,
        channel_count: row.get(9)?,
        key_estimate: row.get(10)?,
        file_size: row.get(11)?,
        created_at: row.get(12)?,
        modified_at: row.get(13)?,
        tag_name: row.get::<_, Option<String>>(14)?.unwrap_or_default(),
    })
}

pub fn insert_midi(conn: &Connection, input: &MidiInput) -> Result<i64, rusqlite::Error> {
    let mut stmt = conn.prepare_cached(
        "INSERT INTO midis (path, file_name, duration, tempo, time_signature_numerator, time_signature_denominator, track_count, note_count, channel_count, key_estimate, file_size) \
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11) \
         ON CONFLICT(path) DO UPDATE SET \
           file_name = excluded.file_name, duration = excluded.duration, tempo = excluded.tempo, \
           time_signature_numerator = excluded.time_signature_numerator, \
           time_signature_denominator = excluded.time_signature_denominator, \
           track_count = excluded.track_count, note_count = excluded.note_count, \
           channel_count = excluded.channel_count, key_estimate = excluded.key_estimate, \
           file_size = excluded.file_size, modified_at = CURRENT_TIMESTAMP",
    )?;
    stmt.execute(params![
        input.path,
        input.file_name,
        input.duration,
        input.tempo,
        input.time_signature_numerator.unwrap_or(4),
        input.time_signature_denominator.unwrap_or(4),
        input.track_count,
        input.note_count,
        input.channel_count,
        input.key_estimate,
        input.file_size,
    ])?;
    let rowid = conn.last_insert_rowid();
    if rowid > 0 {
        let mut fts = conn
            .prepare_cached("INSERT OR IGNORE INTO midis_fts (rowid, file_name) VALUES (?1, ?2)")?;
        fts.execute(params![rowid, input.file_name])?;
    } else {
        let real_id: i64 = conn.query_row(
            "SELECT id FROM midis WHERE path = ?1",
            params![input.path],
            |row| row.get(0),
        )?;
        conn.execute(
            "INSERT OR REPLACE INTO midis_fts (rowid, file_name) VALUES (?1, ?2)",
            params![real_id, input.file_name],
        )?;
        return Ok(real_id);
    }
    Ok(rowid)
}

pub fn list_midis_paginated(
    conn: &Connection,
    limit: usize,
    offset: usize,
) -> Result<Vec<MidiRow>, rusqlite::Error> {
    let sql = format!("{} ORDER BY m.id LIMIT ?1 OFFSET ?2", MIDI_SELECT);
    let mut stmt = conn.prepare_cached(&sql)?;
    let rows = stmt
        .query_map(params![limit as i64, offset as i64], row_to_midi)?
        .collect();
    rows
}

pub fn get_all_midi_paths(conn: &Connection) -> Result<Vec<String>, rusqlite::Error> {
    let mut stmt = conn.prepare_cached("SELECT path FROM midis ORDER BY id")?;
    let rows = stmt.query_map([], |row| row.get(0))?.collect();
    rows
}

pub fn get_midi_by_path(conn: &Connection, path: &str) -> Result<Option<MidiRow>, rusqlite::Error> {
    let sql = format!("{} WHERE m.path = ?1", MIDI_SELECT);
    let mut stmt = conn.prepare_cached(&sql)?;
    match stmt.query_row(params![path], row_to_midi) {
        Ok(row) => Ok(Some(row)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e),
    }
}

pub fn delete_midi(conn: &Connection, path: &str) -> Result<usize, rusqlite::Error> {
    let row: Option<(i64, String)> = conn
        .query_row(
            "SELECT id, file_name FROM midis WHERE path = ?1",
            params![path],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .ok();
    let deleted = conn.execute("DELETE FROM midis WHERE path = ?1", params![path])?;
    if let Some((rid, fname)) = row {
        let _ = conn.execute(
            "DELETE FROM midis_fts WHERE rowid = ?1 AND file_name = ?2",
            params![rid, fname],
        );
    }
    Ok(deleted)
}

pub fn clear_all_midis(conn: &Connection) -> Result<usize, rusqlite::Error> {
    conn.execute("DELETE FROM midis_fts", [])?;
    Ok(conn.execute("DELETE FROM midis", [])?)
}

pub fn search_midis(conn: &Connection, query: &str) -> Result<Vec<MidiRow>, rusqlite::Error> {
    if query.trim().is_empty() {
        return list_midis_paginated(conn, 1000, 0);
    }
    let sql = format!(
        "SELECT m.id, m.path, m.file_name, m.duration, m.tempo,
                m.time_signature_numerator, m.time_signature_denominator,
                m.track_count, m.note_count, m.channel_count, m.key_estimate,
                m.file_size, m.created_at, m.modified_at, COALESCE(t.name, '') as tag_name
         FROM midis_fts f JOIN midis m ON m.id = f.rowid
         LEFT JOIN midi_file_tags mft ON mft.midi_id = m.id
         LEFT JOIN midi_tags t ON t.id = mft.tag_id
         WHERE f.file_name MATCH ?1 ORDER BY rank"
    );
    let mut stmt = conn.prepare_cached(&sql)?;
    let rows = stmt.query_map(params![query], row_to_midi)?.collect();
    rows
}

pub fn search_midis_paginated(
    conn: &Connection,
    query: &str,
    limit: usize,
    offset: usize,
) -> Result<Vec<MidiRow>, rusqlite::Error> {
    if query.trim().is_empty() {
        return list_midis_paginated(conn, limit, offset);
    }
    let sql = format!(
        "SELECT m.id, m.path, m.file_name, m.duration, m.tempo,
                m.time_signature_numerator, m.time_signature_denominator,
                m.track_count, m.note_count, m.channel_count, m.key_estimate,
                m.file_size, m.created_at, m.modified_at, COALESCE(t.name, '') as tag_name
         FROM midis_fts f JOIN midis m ON m.id = f.rowid
         LEFT JOIN midi_file_tags mft ON mft.midi_id = m.id
         LEFT JOIN midi_tags t ON t.id = mft.tag_id
         WHERE f.file_name MATCH ?1 ORDER BY rank LIMIT ?2 OFFSET ?3"
    );
    let mut stmt = conn.prepare_cached(&sql)?;
    let rows = stmt
        .query_map(params![query, limit as i64, offset as i64], row_to_midi)?
        .collect();
    rows
}

pub fn insert_midi_tag(conn: &Connection, name: &str) -> Result<i64, rusqlite::Error> {
    let mut stmt = conn.prepare_cached("INSERT INTO midi_tags (name) VALUES (?1)")?;
    stmt.execute(params![name])?;
    Ok(conn.last_insert_rowid())
}

pub fn get_all_midi_tags(conn: &Connection) -> Result<Vec<MidiTagRow>, rusqlite::Error> {
    let mut stmt =
        conn.prepare_cached("SELECT id, name, created_at FROM midi_tags ORDER BY name")?;
    let rows = stmt
        .query_map([], |row| {
            Ok(MidiTagRow {
                id: row.get(0)?,
                name: row.get(1)?,
                created_at: row.get(2)?,
            })
        })?
        .collect();
    rows
}

pub fn delete_midi_tag(conn: &Connection, id: i64) -> Result<usize, rusqlite::Error> {
    conn.prepare_cached("DELETE FROM midi_tags WHERE id = ?1")?
        .execute(params![id])
}

pub fn update_midi_tag(conn: &Connection, id: i64, name: &str) -> Result<usize, rusqlite::Error> {
    conn.prepare_cached("UPDATE midi_tags SET name = ?1 WHERE id = ?2")?
        .execute(params![name, id])
}

pub fn assign_midi_tag(
    conn: &Connection,
    midi_id: i64,
    tag_id: i64,
) -> Result<(), rusqlite::Error> {
    conn.prepare_cached("INSERT OR IGNORE INTO midi_file_tags (midi_id, tag_id) VALUES (?1, ?2)")?
        .execute(params![midi_id, tag_id])?;
    Ok(())
}

pub fn remove_midi_tag(
    conn: &Connection,
    midi_id: i64,
    tag_id: i64,
) -> Result<usize, rusqlite::Error> {
    conn.prepare_cached("DELETE FROM midi_file_tags WHERE midi_id = ?1 AND tag_id = ?2")?
        .execute(params![midi_id, tag_id])
}

pub fn get_tags_for_midi(
    conn: &Connection,
    midi_id: i64,
) -> Result<Vec<MidiTagRow>, rusqlite::Error> {
    let mut stmt = conn.prepare_cached(
        "SELECT t.id, t.name, t.created_at FROM midi_tags t
         JOIN midi_file_tags mft ON mft.tag_id = t.id
         WHERE mft.midi_id = ?1 ORDER BY t.name",
    )?;
    let rows = stmt
        .query_map(params![midi_id], |row| {
            Ok(MidiTagRow {
                id: row.get(0)?,
                name: row.get(1)?,
                created_at: row.get(2)?,
            })
        })?
        .collect();
    rows
}

pub fn set_midi_tag(
    conn: &Connection,
    midi_id: i64,
    tag_id: Option<i64>,
) -> Result<(), rusqlite::Error> {
    conn.prepare_cached("DELETE FROM midi_file_tags WHERE midi_id = ?1")?
        .execute(params![midi_id])?;
    if let Some(tid) = tag_id {
        conn.prepare_cached(
            "INSERT OR IGNORE INTO midi_file_tags (midi_id, tag_id) VALUES (?1, ?2)",
        )?
        .execute(params![midi_id, tid])?;
    }
    Ok(())
}
