use std::collections::HashMap;
use std::path::Path;

use rusqlite::{params, Connection};

/// Idempotent migration: adds incremental scan columns if they are missing.
///
/// # Errors
/// Returns `rusqlite::Error` if any SQL statement fails.
pub fn ensure_incremental_columns(conn: &Connection) -> Result<(), rusqlite::Error> {
    let add_col = |sql: &str| -> Result<(), rusqlite::Error> {
        match conn.execute_batch(sql) {
            Ok(()) => Ok(()),
            Err(rusqlite::Error::SqliteFailure(err, _)) if err.extended_code == 1 => Ok(()),
            Err(e) => Err(e),
        }
    };
    add_col("ALTER TABLE watched_paths ADD COLUMN last_scanned_at INTEGER;")?;
    add_col("ALTER TABLE samples ADD COLUMN last_modified INTEGER;")?;
    Ok(())
}

/// Returns the `last_scanned_at` Unix timestamp for a directory, or `None` if untracked.
///
/// # Errors
/// Returns `rusqlite::Error` if any SQL statement fails.
pub fn get_last_scan_time(conn: &Connection, path: &Path) -> Result<Option<i64>, rusqlite::Error> {
    let path_str = path.to_string_lossy();
    let mut stmt =
        conn.prepare_cached("SELECT last_scanned_at FROM watched_paths WHERE path = ?1")?;
    match stmt.query_row(params![path_str.as_ref()], |row| {
        row.get::<_, Option<i64>>(0)
    }) {
        Ok(ts) => Ok(ts),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(e),
    }
}

/// Returns `path→last_modified` mappings for all samples under `dir`.
///
/// # Errors
/// Returns `rusqlite::Error` if any SQL statement fails.
pub fn get_known_file_mtimes(
    conn: &Connection,
    dir: &Path,
) -> Result<HashMap<String, Option<i64>>, rusqlite::Error> {
    let prefix = format!("{}%", dir.to_string_lossy());
    let mut stmt =
        conn.prepare_cached("SELECT path, last_modified FROM samples WHERE path LIKE ?1")?;
    let rows = stmt.query_map(params![prefix], |row| {
        Ok((row.get::<_, String>(0)?, row.get::<_, Option<i64>>(1)?))
    })?;

    let mut map = HashMap::new();
    for row in rows {
        let (path, mtime) = row?;
        map.insert(path, mtime);
    }
    Ok(map)
}

/// Update or insert the `last_scanned_at` timestamp for a watched directory.
///
/// # Errors
/// Returns `rusqlite::Error` if any SQL statement fails.
pub fn upsert_watched_path_scan_time(
    conn: &Connection,
    path: &Path,
    timestamp: i64,
) -> Result<(), rusqlite::Error> {
    let path_str = path.to_string_lossy();
    let updated = conn.execute(
        "UPDATE watched_paths SET last_scanned_at = ?1 WHERE path = ?2",
        params![timestamp, path_str.as_ref()],
    )?;
    if updated == 0 {
        conn.execute(
            "INSERT INTO watched_paths (path, last_scanned_at) VALUES (?1, ?2)",
            params![path_str.as_ref(), timestamp],
        )?;
    }
    Ok(())
}
