use rusqlite::{params, Connection};

use super::types::InstrumentTypeRow;

pub fn insert_instrument_type(conn: &Connection, name: &str) -> Result<i64, rusqlite::Error> {
    conn.prepare_cached("INSERT INTO instrument_types (name) VALUES (?1)")?
        .execute(params![name])?;
    Ok(conn.last_insert_rowid())
}

pub fn get_all_instrument_types(
    conn: &Connection,
) -> Result<Vec<InstrumentTypeRow>, rusqlite::Error> {
    let mut stmt =
        conn.prepare_cached("SELECT id, name, created_at FROM instrument_types ORDER BY name")?;
    let rows = stmt
        .query_map([], |row| {
            Ok(InstrumentTypeRow {
                id: row.get(0)?,
                name: row.get(1)?,
                created_at: row.get(2)?,
            })
        })?
        .collect();
    rows
}

pub fn delete_instrument_type(conn: &Connection, id: i64) -> Result<usize, rusqlite::Error> {
    conn.prepare_cached("DELETE FROM instrument_types WHERE id = ?1")?
        .execute(params![id])
}

pub fn update_instrument_type(
    conn: &Connection,
    id: i64,
    name: &str,
) -> Result<usize, rusqlite::Error> {
    conn.prepare_cached("UPDATE instrument_types SET name = ?1 WHERE id = ?2")?
        .execute(params![name, id])
}
