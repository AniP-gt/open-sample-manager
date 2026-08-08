use rusqlite::{params, Connection, Error, OptionalExtension};

use super::samples::{row_to_sample, SAMPLE_COLUMNS};
use super::types::{
    CollectionAddResult, CollectionInput, CollectionMemberRow, CollectionRow, SampleRow,
};

const COLLECTION_SELECT: &str = "SELECT c.id, c.name, c.description, c.created_at, c.updated_at, COUNT(cm.sample_id) AS sample_count
     FROM collections c
     LEFT JOIN collection_members cm ON cm.collection_id = c.id
     GROUP BY c.id
     ORDER BY c.created_at, c.id";

const COLLECTION_SELECT_BY_ID: &str = "SELECT c.id, c.name, c.description, c.created_at, c.updated_at, COUNT(cm.sample_id) AS sample_count
     FROM collections c
     LEFT JOIN collection_members cm ON cm.collection_id = c.id
     WHERE c.id = ?1
     GROUP BY c.id";

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

pub fn create_collection(
    conn: &mut Connection,
    input: &CollectionInput,
) -> Result<CollectionRow, Error> {
    let name = normalize_collection_name(&input.name)?;
    conn.execute(
        "INSERT INTO collections (name, description) VALUES (?1, ?2)",
        params![name, input.description],
    )?;
    get_collection_by_id(conn, conn.last_insert_rowid())?.ok_or(Error::QueryReturnedNoRows)
}

pub fn list_collections(conn: &Connection) -> Result<Vec<CollectionRow>, Error> {
    let mut stmt = conn.prepare_cached(COLLECTION_SELECT)?;
    let rows = stmt.query_map([], row_to_collection_row)?.collect();
    rows
}

pub fn get_collection_by_id(
    conn: &Connection,
    collection_id: i64,
) -> Result<Option<CollectionRow>, Error> {
    conn.prepare_cached(COLLECTION_SELECT_BY_ID)?
        .query_row(params![collection_id], row_to_collection_row)
        .optional()
}

pub fn update_collection(
    conn: &mut Connection,
    collection_id: i64,
    input: &CollectionInput,
) -> Result<Option<CollectionRow>, Error> {
    let name = normalize_collection_name(&input.name)?;
    if conn.execute(
        "UPDATE collections SET name = ?1, description = ?2, updated_at = CURRENT_TIMESTAMP WHERE id = ?3",
        params![name, input.description, collection_id],
    )? == 0
    {
        return Ok(None);
    }
    get_collection_by_id(conn, collection_id)
}

pub fn delete_collection(conn: &mut Connection, collection_id: i64) -> Result<usize, Error> {
    conn.execute(
        "DELETE FROM collections WHERE id = ?1",
        params![collection_id],
    )
}

/// Adds samples to a collection selected by name for the local HTTP/MCP API.
pub fn add_samples_to_collection(
    conn: &mut Connection,
    name: &str,
    sample_ids: &[i64],
) -> Result<CollectionAddResult, Error> {
    if sample_ids.is_empty() {
        return Err(Error::InvalidParameterCount(1, 0));
    }
    if sample_ids.len() > 100 {
        return Err(Error::InvalidParameterCount(100, sample_ids.len()));
    }

    let name = normalize_collection_name(name)?;
    let tx = conn.transaction()?;
    validate_sample_ids(&tx, sample_ids)?;
    let created = tx.execute(
        "INSERT INTO collections (name) VALUES (?1) ON CONFLICT(name) DO NOTHING",
        params![name],
    )? > 0;
    let collection_id = tx.query_row(
        "SELECT id FROM collections WHERE name = ?1",
        params![name],
        |row| row.get(0),
    )?;
    let added_count = add_member_rows(&tx, collection_id, sample_ids)?;
    tx.commit()?;

    Ok(CollectionAddResult {
        collection_id,
        added_count,
        created,
    })
}

/// Adds samples to an existing collection selected by id for the desktop UI.
pub fn add_samples_to_collection_by_id(
    conn: &mut Connection,
    collection_id: i64,
    sample_ids: &[i64],
) -> Result<usize, Error> {
    let tx = conn.transaction()?;
    if get_collection_by_id(&tx, collection_id)?.is_none() {
        return Ok(0);
    }
    validate_sample_ids(&tx, sample_ids)?;
    let added_count = add_member_rows(&tx, collection_id, sample_ids)?;
    tx.commit()?;
    Ok(added_count)
}

pub fn remove_samples_from_collection(
    conn: &mut Connection,
    collection_id: i64,
    sample_ids: &[i64],
) -> Result<usize, Error> {
    let tx = conn.transaction()?;
    let mut removed = 0;
    {
        let mut stmt = tx.prepare_cached(
            "DELETE FROM collection_members WHERE collection_id = ?1 AND sample_id = ?2",
        )?;
        for &sample_id in sample_ids {
            removed += stmt.execute(params![collection_id, sample_id])?;
        }
    }
    if removed > 0 {
        tx.execute(
            "UPDATE collections SET updated_at = CURRENT_TIMESTAMP WHERE id = ?1",
            params![collection_id],
        )?;
    }
    tx.commit()?;
    Ok(removed)
}

pub fn list_collection_member_sample_ids(
    conn: &Connection,
    collection_id: i64,
) -> Result<Vec<i64>, Error> {
    let mut stmt = conn.prepare_cached(
        "SELECT sample_id FROM collection_members WHERE collection_id = ?1 ORDER BY position",
    )?;
    let rows = stmt
        .query_map(params![collection_id], |row| row.get(0))?
        .collect();
    rows
}

pub fn get_collection_members(
    conn: &Connection,
    collection_id: i64,
) -> Result<Vec<SampleRow>, Error> {
    let mut stmt = conn.prepare_cached(&format!(
        "SELECT {SAMPLE_COLUMNS} FROM samples JOIN collection_members cm ON cm.sample_id = samples.id WHERE cm.collection_id = ?1 ORDER BY cm.position"
    ))?;
    let rows = stmt
        .query_map(params![collection_id], row_to_sample)?
        .collect();
    rows
}

pub fn list_collection_samples(
    conn: &Connection,
    collection_id: i64,
) -> Result<Vec<SampleRow>, Error> {
    get_collection_members(conn, collection_id)
}

pub fn list_collection_members_with_positions(
    conn: &Connection,
    collection_id: i64,
) -> Result<Vec<CollectionMemberRow>, Error> {
    let mut stmt = conn.prepare_cached(&format!(
        "SELECT cm.collection_id, cm.sample_id, cm.position, {SAMPLE_COLUMNS} FROM collection_members cm JOIN samples ON samples.id = cm.sample_id WHERE cm.collection_id = ?1 ORDER BY cm.position"
    ))?;
    let rows = stmt
        .query_map(params![collection_id], |row| {
            Ok(CollectionMemberRow {
                collection_id: row.get(0)?,
                sample_id: row.get(1)?,
                position: row.get(2)?,
                sample: row_to_sample(row)?,
            })
        })?
        .collect();
    rows
}

fn add_member_rows(
    tx: &rusqlite::Transaction<'_>,
    collection_id: i64,
    sample_ids: &[i64],
) -> Result<usize, Error> {
    let mut next_position = tx.query_row(
        "SELECT COALESCE(MAX(position), 0) + 1 FROM collection_members WHERE collection_id = ?1",
        params![collection_id],
        |row| row.get::<_, i64>(0),
    )?;
    let mut added_count = 0;
    let mut stmt = tx.prepare_cached(
        "INSERT INTO collection_members (collection_id, sample_id, position) VALUES (?1, ?2, ?3) ON CONFLICT(collection_id, sample_id) DO NOTHING",
    )?;
    for &sample_id in sample_ids {
        if stmt.execute(params![collection_id, sample_id, next_position])? > 0 {
            added_count += 1;
            next_position += 1;
        }
    }
    if added_count > 0 {
        tx.execute(
            "UPDATE collections SET updated_at = CURRENT_TIMESTAMP WHERE id = ?1",
            params![collection_id],
        )?;
    }
    Ok(added_count)
}

fn validate_sample_ids(tx: &rusqlite::Transaction<'_>, sample_ids: &[i64]) -> Result<(), Error> {
    let mut stmt = tx.prepare_cached("SELECT 1 FROM samples WHERE id = ?1")?;
    for &sample_id in sample_ids {
        stmt.query_row(params![sample_id], |_| Ok(()))?;
    }
    Ok(())
}

fn row_to_collection_row(row: &rusqlite::Row<'_>) -> Result<CollectionRow, Error> {
    Ok(CollectionRow {
        id: row.get(0)?,
        name: row.get(1)?,
        description: row.get(2)?,
        created_at: row.get(3)?,
        updated_at: row.get(4)?,
        sample_count: row.get(5)?,
    })
}

#[cfg(test)]
#[path = "collections/tests.rs"]
mod tests;
