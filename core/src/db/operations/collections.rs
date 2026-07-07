use rusqlite::{params, Connection, OptionalExtension};

use super::samples::{row_to_sample, SAMPLE_COLUMNS};
use super::types::{CollectionInput, CollectionRow, SampleRow};

fn row_to_collection(row: &rusqlite::Row<'_>) -> rusqlite::Result<CollectionRow> {
    Ok(CollectionRow {
        id: row.get(0)?,
        name: row.get(1)?,
        description: row.get(2)?,
        sample_count: row.get(3)?,
        created_at: row.get(4)?,
        updated_at: row.get(5)?,
    })
}

pub fn create_collection(
    conn: &Connection,
    input: &CollectionInput,
) -> Result<CollectionRow, rusqlite::Error> {
    conn.execute(
        "INSERT INTO collections (name, description) VALUES (?1, ?2)",
        params![input.name.trim(), input.description],
    )?;
    get_collection(conn, conn.last_insert_rowid())?.ok_or(rusqlite::Error::QueryReturnedNoRows)
}

pub fn list_collections(conn: &Connection) -> Result<Vec<CollectionRow>, rusqlite::Error> {
    let mut stmt = conn.prepare_cached(
        "SELECT c.id, c.name, c.description, COUNT(cs.sample_id), c.created_at, c.updated_at
         FROM collections c
         LEFT JOIN collection_samples cs ON cs.collection_id = c.id
         GROUP BY c.id
         ORDER BY c.updated_at DESC, c.name COLLATE NOCASE",
    )?;
    let rows = stmt.query_map([], row_to_collection)?.collect();
    rows
}

pub fn get_collection(
    conn: &Connection,
    id: i64,
) -> Result<Option<CollectionRow>, rusqlite::Error> {
    conn.prepare_cached(
        "SELECT c.id, c.name, c.description, COUNT(cs.sample_id), c.created_at, c.updated_at
         FROM collections c
         LEFT JOIN collection_samples cs ON cs.collection_id = c.id
         WHERE c.id = ?1
         GROUP BY c.id",
    )?
    .query_row(params![id], row_to_collection)
    .optional()
}

pub fn update_collection(
    conn: &Connection,
    id: i64,
    input: &CollectionInput,
) -> Result<Option<CollectionRow>, rusqlite::Error> {
    let updated = conn.execute(
        "UPDATE collections SET name = ?1, description = ?2, updated_at = CURRENT_TIMESTAMP WHERE id = ?3",
        params![input.name.trim(), input.description, id],
    )?;
    if updated == 0 {
        return Ok(None);
    }
    get_collection(conn, id)
}

pub fn delete_collection(conn: &Connection, id: i64) -> Result<usize, rusqlite::Error> {
    conn.execute("DELETE FROM collections WHERE id = ?1", params![id])
}

pub fn add_samples_to_collection(
    conn: &Connection,
    collection_id: i64,
    sample_ids: &[i64],
) -> Result<usize, rusqlite::Error> {
    let mut added = 0;
    let mut stmt = conn.prepare_cached(
        "INSERT OR IGNORE INTO collection_samples (collection_id, sample_id) VALUES (?1, ?2)",
    )?;
    for sample_id in sample_ids {
        added += stmt.execute(params![collection_id, sample_id])?;
    }
    if added > 0 {
        conn.execute(
            "UPDATE collections SET updated_at = CURRENT_TIMESTAMP WHERE id = ?1",
            params![collection_id],
        )?;
    }
    Ok(added)
}

pub fn remove_samples_from_collection(
    conn: &Connection,
    collection_id: i64,
    sample_ids: &[i64],
) -> Result<usize, rusqlite::Error> {
    let mut removed = 0;
    let mut stmt = conn.prepare_cached(
        "DELETE FROM collection_samples WHERE collection_id = ?1 AND sample_id = ?2",
    )?;
    for sample_id in sample_ids {
        removed += stmt.execute(params![collection_id, sample_id])?;
    }
    if removed > 0 {
        conn.execute(
            "UPDATE collections SET updated_at = CURRENT_TIMESTAMP WHERE id = ?1",
            params![collection_id],
        )?;
    }
    Ok(removed)
}

pub fn list_collection_samples(
    conn: &Connection,
    collection_id: i64,
) -> Result<Vec<SampleRow>, rusqlite::Error> {
    let mut stmt = conn.prepare_cached(&format!(
        "SELECT {SAMPLE_COLUMNS}
         FROM samples
         JOIN collection_samples cs ON cs.sample_id = samples.id
         WHERE cs.collection_id = ?1
         ORDER BY cs.added_at DESC, samples.id DESC"
    ))?;
    let rows = stmt
        .query_map(params![collection_id], row_to_sample)?
        .collect();
    rows
}

#[cfg(test)]
mod tests {
    use rusqlite::Connection;

    use crate::db::operations::{insert_sample, SampleInput};
    use crate::db::schema::init_database;

    use super::*;

    fn sample(path: &str) -> SampleInput {
        SampleInput {
            path: path.to_string(),
            file_name: path.rsplit('/').next().unwrap_or(path).to_string(),
            duration: Some(1.0),
            bpm: Some(120.0),
            periodicity: None,
            sample_rate: Some(44_100),
            file_size: Some(42),
            artist: None,
            low_ratio: None,
            sample_type: Some("oneshot".to_string()),
            waveform_peaks: None,
            attack_slope: None,
            decay_time: None,
            embedding: None,
            playback_type: Some("oneshot".to_string()),
            instrument_type: Some("kick".to_string()),
            musical_key: Some("C".to_string()),
        }
    }

    #[test]
    fn collection_roundtrip_lists_samples() {
        let conn = Connection::open_in_memory().unwrap();
        init_database(&conn).unwrap();
        let sample_id = insert_sample(&conn, &sample("/tmp/kick.wav")).unwrap();
        let collection = create_collection(
            &conn,
            &CollectionInput {
                name: "crate digs".to_string(),
                description: None,
            },
        )
        .unwrap();

        assert_eq!(
            add_samples_to_collection(&conn, collection.id, &[sample_id]).unwrap(),
            1
        );
        assert_eq!(
            add_samples_to_collection(&conn, collection.id, &[sample_id]).unwrap(),
            0
        );
        assert_eq!(list_collections(&conn).unwrap()[0].sample_count, 1);

        let samples = list_collection_samples(&conn, collection.id).unwrap();
        assert_eq!(samples.len(), 1);
        assert_eq!(samples[0].file_name, "kick.wav");

        assert_eq!(
            remove_samples_from_collection(&conn, collection.id, &[sample_id]).unwrap(),
            1
        );
        assert!(list_collection_samples(&conn, collection.id)
            .unwrap()
            .is_empty());
    }
}
