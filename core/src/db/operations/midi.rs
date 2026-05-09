use rusqlite::{params, Connection};

use super::fuzzy::matches_fuzzy_query;
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

pub fn list_midis_around_id(
    conn: &Connection,
    target_id: i64,
    limit: usize,
) -> Result<Vec<MidiRow>, rusqlite::Error> {
    let half = (limit as i64) / 2;
    let start_id = (target_id - half).max(1);
    let sql = format!("{} WHERE m.id >= ?1 ORDER BY m.id LIMIT ?2", MIDI_SELECT);
    let mut stmt = conn.prepare_cached(&sql)?;
    let rows = stmt
        .query_map(params![start_id, limit as i64], row_to_midi)?
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
    fuzzy_midi_rows(conn, query)
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
    fuzzy_midi_rows(conn, query).map(|rows| rows.into_iter().skip(offset).take(limit).collect())
}

fn fuzzy_midi_rows(conn: &Connection, query: &str) -> Result<Vec<MidiRow>, rusqlite::Error> {
    let mut stmt = conn.prepare_cached(
        "SELECT m.id, m.path, m.file_name, m.duration, m.tempo,
                m.time_signature_numerator, m.time_signature_denominator,
                m.track_count, m.note_count, m.channel_count, m.key_estimate,
                m.file_size, m.created_at, m.modified_at,
                COALESCE(GROUP_CONCAT(t.name, ' '), '') as tag_name
         FROM midis m
         LEFT JOIN midi_file_tags mft ON mft.midi_id = m.id
         LEFT JOIN midi_tags t ON t.id = mft.tag_id
         GROUP BY m.id
         ORDER BY m.id",
    )?;
    let rows = stmt.query_map([], row_to_midi)?;

    rows.filter_map(|row| match row {
        Ok(midi) => {
            if matches_fuzzy_query(query, &[midi.file_name.as_str(), midi.tag_name.as_str()]) {
                Some(Ok(midi))
            } else {
                None
            }
        }
        Err(err) => Some(Err(err)),
    })
    .collect()
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

#[cfg(test)]
mod tests {
    use rusqlite::Connection;

    use crate::db::operations::MidiInput;
    use crate::db::schema::init_database;

    use super::{
        assign_midi_tag, clear_all_midis, get_tags_for_midi, insert_midi, insert_midi_tag,
        search_midis, search_midis_paginated, set_midi_tag,
    };

    fn setup_db() -> Connection {
        let conn = Connection::open_in_memory().expect("failed to create in-memory DB");
        init_database(&conn).expect("failed to initialize schema");
        conn
    }

    fn midi_input(path: &str, file_name: &str) -> MidiInput {
        MidiInput {
            path: path.to_string(),
            file_name: file_name.to_string(),
            duration: None,
            tempo: None,
            time_signature_numerator: None,
            time_signature_denominator: None,
            track_count: None,
            note_count: None,
            channel_count: None,
            key_estimate: None,
            file_size: None,
        }
    }

    fn count_rows(conn: &Connection, table: &str) -> i64 {
        conn.query_row(&format!("SELECT COUNT(*) FROM {table}"), [], |row| row.get(0))
            .expect("count query failed")
    }

    #[test]
    fn clear_all_midis_removes_rows_fts_and_file_tags() {
        let conn = setup_db();
        let first_id = insert_midi(&conn, &midi_input("/midis/clear-one.mid", "clear-one.mid"))
            .expect("first midi insert failed");
        let second_id = insert_midi(&conn, &midi_input("/midis/clear-two.mid", "clear-two.mid"))
            .expect("second midi insert failed");
        let tag_id = insert_midi_tag(&conn, "phase3-clear").expect("tag insert failed");
        assign_midi_tag(&conn, first_id, tag_id).expect("first tag assign failed");
        assign_midi_tag(&conn, second_id, tag_id).expect("second tag assign failed");

        assert_eq!(clear_all_midis(&conn).expect("clear midis failed"), 2);

        assert_eq!(count_rows(&conn, "midis"), 0);
        assert_eq!(count_rows(&conn, "midis_fts"), 0);
        assert_eq!(count_rows(&conn, "midi_file_tags"), 0);
        assert!(search_midis(&conn, "clear")
            .expect("search after clear failed")
            .is_empty());
        assert_eq!(clear_all_midis(&conn).expect("empty clear failed"), 0);
    }

    #[test]
    fn set_midi_tag_attaches_removes_and_replaces_single_tag() {
        let conn = setup_db();
        let midi_id = insert_midi(&conn, &midi_input("/midis/tagged.mid", "tagged.mid"))
            .expect("midi insert failed");
        let melody_id = insert_midi_tag(&conn, "phase3-melody").expect("melody tag insert failed");
        let bass_id = insert_midi_tag(&conn, "phase3-bass").expect("bass tag insert failed");

        set_midi_tag(&conn, midi_id, Some(melody_id)).expect("set melody tag failed");
        let tags = get_tags_for_midi(&conn, midi_id).expect("get melody tags failed");
        assert_eq!(tags.len(), 1);
        assert_eq!(tags[0].name, "phase3-melody");
        assert_eq!(
            search_midis(&conn, "melody")
                .expect("search melody failed")
                .len(),
            1
        );

        set_midi_tag(&conn, midi_id, Some(bass_id)).expect("replace tag failed");
        let replaced = get_tags_for_midi(&conn, midi_id).expect("get replaced tags failed");
        assert_eq!(replaced.len(), 1);
        assert_eq!(replaced[0].name, "phase3-bass");
        assert!(search_midis(&conn, "melody")
            .expect("search old tag failed")
            .is_empty());
        assert_eq!(
            search_midis(&conn, "bass")
                .expect("search replacement tag failed")
                .len(),
            1
        );

        set_midi_tag(&conn, midi_id, None).expect("remove tag failed");
        assert!(get_tags_for_midi(&conn, midi_id)
            .expect("get removed tags failed")
            .is_empty());
        assert!(search_midis(&conn, "bass")
            .expect("search removed tag failed")
            .is_empty());
    }

    #[test]
    fn set_midi_tag_rejects_missing_ids_by_current_sqlite_contract() {
        let conn = setup_db();
        let midi_id = insert_midi(&conn, &midi_input("/midis/missing-contract.mid", "missing.mid"))
            .expect("midi insert failed");
        let tag_id = insert_midi_tag(&conn, "phase3-contract").expect("tag insert failed");

        assert!(
            set_midi_tag(&conn, -1, Some(tag_id)).is_err(),
            "missing midi id should fail the foreign key constraint"
        );
        assert!(
            set_midi_tag(&conn, midi_id, Some(-1)).is_err(),
            "missing tag id should fail the foreign key constraint"
        );

        assert!(get_tags_for_midi(&conn, midi_id)
            .expect("get tags failed")
            .is_empty());
        assert_eq!(count_rows(&conn, "midi_file_tags"), 0);
    }

    #[test]
    fn midi_search_matches_and_ignores_tags_after_removal_with_pagination() {
        let conn = setup_db();
        let alpha_id = insert_midi(&conn, &midi_input("/midis/alpha.mid", "alpha.mid"))
            .expect("alpha insert failed");
        let beta_id = insert_midi(&conn, &midi_input("/midis/beta.mid", "beta.mid"))
            .expect("beta insert failed");
        let gamma_id = insert_midi(&conn, &midi_input("/midis/gamma.mid", "gamma.mid"))
            .expect("gamma insert failed");
        let tag_id = insert_midi_tag(&conn, "phase3-loop").expect("tag insert failed");

        set_midi_tag(&conn, alpha_id, Some(tag_id)).expect("alpha tag failed");
        set_midi_tag(&conn, beta_id, Some(tag_id)).expect("beta tag failed");
        set_midi_tag(&conn, gamma_id, Some(tag_id)).expect("gamma tag failed");
        set_midi_tag(&conn, alpha_id, None).expect("alpha tag removal failed");

        let page = search_midis_paginated(&conn, "loop", 1, 1, None).expect("tag page search failed");
        assert_eq!(page.len(), 1);
        assert_eq!(page[0].file_name, "gamma.mid");

        let all_matches = search_midis(&conn, "loop").expect("tag search failed");
        let file_names: Vec<&str> = all_matches.iter().map(|row| row.file_name.as_str()).collect();
        assert_eq!(file_names, vec!["beta.mid", "gamma.mid"]);
    }
}
