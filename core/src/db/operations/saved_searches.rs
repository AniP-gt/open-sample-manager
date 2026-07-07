use rusqlite::{params, Connection, OptionalExtension};

use super::types::{SavedSearchInput, SavedSearchRow};

fn row_to_saved_search(row: &rusqlite::Row<'_>) -> rusqlite::Result<SavedSearchRow> {
    let favorites_only: i64 = row.get(7)?;
    Ok(SavedSearchRow {
        id: row.get(0)?,
        name: row.get(1)?,
        search: row.get(2)?,
        filter_type: row.get(3)?,
        filter_bpm_min: row.get(4)?,
        filter_bpm_max: row.get(5)?,
        filter_instrument_type: row.get(6)?,
        favorites_only: favorites_only != 0,
        filter_key: row.get(8)?,
        directory_path: row.get(9)?,
        sort_field: row.get(10)?,
        sort_direction: row.get(11)?,
        created_at: row.get(12)?,
        updated_at: row.get(13)?,
    })
}

pub fn create_saved_search(
    conn: &Connection,
    input: &SavedSearchInput,
) -> Result<SavedSearchRow, rusqlite::Error> {
    conn.execute(
        "INSERT INTO saved_searches
         (name, search, filter_type, filter_bpm_min, filter_bpm_max, filter_instrument_type, favorites_only, filter_key, directory_path, sort_field, sort_direction)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
        params![
            input.name.trim(),
            input.search,
            input.filter_type,
            input.filter_bpm_min,
            input.filter_bpm_max,
            input.filter_instrument_type,
            if input.favorites_only { 1_i64 } else { 0_i64 },
            input.filter_key,
            input.directory_path,
            input.sort_field,
            input.sort_direction,
        ],
    )?;
    get_saved_search(conn, conn.last_insert_rowid())?.ok_or(rusqlite::Error::QueryReturnedNoRows)
}

pub fn list_saved_searches(conn: &Connection) -> Result<Vec<SavedSearchRow>, rusqlite::Error> {
    let mut stmt = conn.prepare_cached(
        "SELECT id, name, search, filter_type, filter_bpm_min, filter_bpm_max, filter_instrument_type, favorites_only, filter_key, directory_path, sort_field, sort_direction, created_at, updated_at
         FROM saved_searches
         ORDER BY updated_at DESC, name COLLATE NOCASE",
    )?;
    let rows = stmt.query_map([], row_to_saved_search)?.collect();
    rows
}

pub fn get_saved_search(
    conn: &Connection,
    id: i64,
) -> Result<Option<SavedSearchRow>, rusqlite::Error> {
    conn.prepare_cached(
        "SELECT id, name, search, filter_type, filter_bpm_min, filter_bpm_max, filter_instrument_type, favorites_only, filter_key, directory_path, sort_field, sort_direction, created_at, updated_at
         FROM saved_searches
         WHERE id = ?1",
    )?
    .query_row(params![id], row_to_saved_search)
    .optional()
}

pub fn update_saved_search(
    conn: &Connection,
    id: i64,
    input: &SavedSearchInput,
) -> Result<Option<SavedSearchRow>, rusqlite::Error> {
    let updated = conn.execute(
        "UPDATE saved_searches SET
         name = ?1, search = ?2, filter_type = ?3, filter_bpm_min = ?4, filter_bpm_max = ?5,
         filter_instrument_type = ?6, favorites_only = ?7, filter_key = ?8, directory_path = ?9,
         sort_field = ?10, sort_direction = ?11, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?12",
        params![
            input.name.trim(),
            input.search,
            input.filter_type,
            input.filter_bpm_min,
            input.filter_bpm_max,
            input.filter_instrument_type,
            if input.favorites_only { 1_i64 } else { 0_i64 },
            input.filter_key,
            input.directory_path,
            input.sort_field,
            input.sort_direction,
            id,
        ],
    )?;
    if updated == 0 {
        return Ok(None);
    }
    get_saved_search(conn, id)
}

pub fn delete_saved_search(conn: &Connection, id: i64) -> Result<usize, rusqlite::Error> {
    conn.execute("DELETE FROM saved_searches WHERE id = ?1", params![id])
}

#[cfg(test)]
mod tests {
    use rusqlite::Connection;

    use crate::db::schema::init_database;

    use super::*;

    fn input(name: &str) -> SavedSearchInput {
        SavedSearchInput {
            name: name.to_string(),
            search: "kick".to_string(),
            filter_type: "one-shot".to_string(),
            filter_bpm_min: "90".to_string(),
            filter_bpm_max: "130".to_string(),
            filter_instrument_type: "kick".to_string(),
            favorites_only: true,
            filter_key: "C".to_string(),
            directory_path: "/packs".to_string(),
            sort_field: "bpm".to_string(),
            sort_direction: "desc".to_string(),
        }
    }

    #[test]
    fn saved_search_roundtrip_preserves_filters() {
        let conn = Connection::open_in_memory().unwrap();
        init_database(&conn).unwrap();

        let created = create_saved_search(&conn, &input("tight kicks")).unwrap();
        assert!(created.favorites_only);
        assert_eq!(created.sort_field, "bpm");

        let updated = update_saved_search(&conn, created.id, &input("updated kicks"))
            .unwrap()
            .unwrap();
        assert_eq!(updated.name, "updated kicks");
        assert_eq!(list_saved_searches(&conn).unwrap().len(), 1);
        assert_eq!(delete_saved_search(&conn, created.id).unwrap(), 1);
    }
}
