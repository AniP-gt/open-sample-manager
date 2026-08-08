use std::fs;
use std::path::Path;

use rusqlite::{params, Connection, DatabaseName, OptionalExtension};
use serde::{Deserialize, Serialize};

use crate::db::schema::init_database;

use super::migration_io::{
    checkpoint_truncate, cleanup_sqlite_sidecars, invalid_data, invalid_input, path_to_string,
    replace_file, unique_path,
};
use super::{ManagerError, SampleManager};

const EXPORT_DB_FILE: &str = "samples.db";

const REQUIRED_TABLES: &[&str] = &[
    "samples",
    "tags",
    "sample_tags",
    "watched_paths",
    "instrument_types",
    "midis",
    "midi_tags",
    "midi_file_tags",
    "collections",
    "collection_members",
    "saved_searches",
    "samples_fts",
    "midis_fts",
];

const LEGACY_REQUIRED_TABLES: &[&str] = &[
    "samples",
    "tags",
    "sample_tags",
    "watched_paths",
    "instrument_types",
    "midis",
    "midi_tags",
    "midi_file_tags",
    "samples_fts",
    "midis_fts",
];

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct LibraryExportSummary {
    pub folder_path: String,
    pub database_path: String,
    pub sample_count: i64,
    pub midi_count: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct LibraryImportSummary {
    pub folder_path: String,
    pub sample_count: i64,
    pub midi_count: i64,
}

impl SampleManager {
    pub fn export_library_database(
        &self,
        folder: impl AsRef<Path>,
    ) -> Result<LibraryExportSummary, ManagerError> {
        let folder = folder.as_ref();
        fs::create_dir_all(folder)?;

        let target_db_path = folder.join(EXPORT_DB_FILE);
        let temp_db_path = unique_path(folder, "samples.db.tmp");

        if temp_db_path.exists() {
            fs::remove_file(&temp_db_path)?;
        }

        checkpoint_truncate(&self.conn)?;
        self.conn.backup(
            DatabaseName::Main,
            &temp_db_path,
            None::<fn(rusqlite::backup::Progress)>,
        )?;

        let exported_conn = Connection::open(&temp_db_path)?;
        validate_export_database(&exported_conn)?;
        let sample_count = count_rows(&exported_conn, "samples")?;
        let midi_count = count_rows(&exported_conn, "midis")?;
        drop(exported_conn);

        replace_file(&temp_db_path, &target_db_path)?;

        Ok(LibraryExportSummary {
            folder_path: path_to_string(folder)?,
            database_path: path_to_string(&target_db_path)?,
            sample_count,
            midi_count,
        })
    }

    pub fn import_library_database(
        &mut self,
        folder: impl AsRef<Path>,
    ) -> Result<LibraryImportSummary, ManagerError> {
        let current_db_path = self
            .db_path
            .clone()
            .ok_or_else(|| invalid_input("database import requires a file-backed SampleManager"))?;
        let folder = folder.as_ref();
        let source_db_path = folder.join(EXPORT_DB_FILE);

        let parent = current_db_path
            .parent()
            .ok_or_else(|| invalid_input("database path must have a parent directory"))?;
        fs::create_dir_all(parent)?;

        let staged_path = unique_path(parent, "samples.db.importing");
        if staged_path.exists() {
            fs::remove_file(&staged_path)?;
        }
        fs::copy(&source_db_path, &staged_path)?;

        {
            let staged_conn = Connection::open(&staged_path)?;
            validate_legacy_import_database(&staged_conn)?;
            init_database(&staged_conn)?;
            validate_export_database(&staged_conn)?;
        }

        let rollback_path = unique_path(parent, "samples.db.rollback");
        let import_result = self.restore_staged_database(&staged_path, &rollback_path);
        cleanup_sqlite_sidecars(&staged_path)?;
        if rollback_path.exists() {
            fs::remove_file(&rollback_path)?;
        }
        cleanup_sqlite_sidecars(&rollback_path)?;
        import_result?;

        let sample_count = count_rows(&self.conn, "samples")?;
        let midi_count = count_rows(&self.conn, "midis")?;

        Ok(LibraryImportSummary {
            folder_path: path_to_string(folder)?,
            sample_count,
            midi_count,
        })
    }

    fn restore_staged_database(
        &mut self,
        staged_path: &Path,
        rollback_path: &Path,
    ) -> Result<(), ManagerError> {
        checkpoint_truncate(&self.conn)?;
        self.conn.backup(
            DatabaseName::Main,
            rollback_path,
            None::<fn(rusqlite::backup::Progress)>,
        )?;

        let result = (|| -> Result<(), ManagerError> {
            self.conn.restore(
                DatabaseName::Main,
                staged_path,
                None::<fn(rusqlite::backup::Progress)>,
            )?;
            init_database(&self.conn)?;
            validate_export_database(&self.conn)?;
            checkpoint_truncate(&self.conn)?;
            Ok(())
        })();

        if let Err(error) = result {
            self.conn.restore(
                DatabaseName::Main,
                rollback_path,
                None::<fn(rusqlite::backup::Progress)>,
            )?;
            init_database(&self.conn)?;
            checkpoint_truncate(&self.conn)?;
            return Err(error);
        }

        Ok(())
    }
}

fn validate_export_database(conn: &Connection) -> Result<(), ManagerError> {
    validate_database_tables(conn, REQUIRED_TABLES)
}

fn validate_legacy_import_database(conn: &Connection) -> Result<(), ManagerError> {
    validate_database_tables(conn, LEGACY_REQUIRED_TABLES)
}

fn validate_database_tables(
    conn: &Connection,
    required_tables: &[&str],
) -> Result<(), ManagerError> {
    let integrity: String = conn.query_row("PRAGMA integrity_check", [], |row| row.get(0))?;
    if integrity != "ok" {
        return Err(invalid_data(format!(
            "database integrity check failed: {integrity}"
        )));
    }

    for table in required_tables {
        if !table_exists(conn, table)? {
            return Err(invalid_data(format!(
                "database export is missing table {table}"
            )));
        }
    }

    Ok(())
}

fn table_exists(conn: &Connection, table: &str) -> Result<bool, ManagerError> {
    let found = conn
        .query_row(
            "SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?1",
            params![table],
            |_| Ok(()),
        )
        .optional()?;
    Ok(found.is_some())
}

fn count_rows(conn: &Connection, table: &str) -> Result<i64, ManagerError> {
    let sql = format!("SELECT COUNT(*) FROM {table}");
    Ok(conn.query_row(&sql, [], |row| row.get(0))?)
}
