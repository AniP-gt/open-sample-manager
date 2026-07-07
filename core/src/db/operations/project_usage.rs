use rusqlite::{params, Connection, OptionalExtension};

use super::types::{ProjectRow, ProjectSampleEventRow};

pub const DEFAULT_PROJECT_ID: &str = "default";

pub fn list_projects(conn: &Connection) -> Result<Vec<ProjectRow>, rusqlite::Error> {
    let mut stmt = conn.prepare_cached(
        "SELECT id, name, is_default, created_at, updated_at FROM projects ORDER BY is_default DESC, name",
    )?;
    let rows = stmt.query_map([], project_from_row)?.collect();
    rows
}

pub fn create_project(conn: &Connection, name: &str) -> Result<ProjectRow, rusqlite::Error> {
    let trimmed_name = name.trim();
    let project_name = if trimmed_name.is_empty() {
        "Untitled Project"
    } else {
        trimmed_name
    };
    let project_id = unique_project_id(conn, project_name)?;
    conn.execute(
        "INSERT INTO projects (id, name, is_default) VALUES (?1, ?2, 0)",
        params![project_id, project_name],
    )?;
    conn.query_row(
        "SELECT id, name, is_default, created_at, updated_at FROM projects WHERE id = ?1",
        params![project_id],
        project_from_row,
    )
}

pub fn get_default_project(conn: &Connection) -> Result<ProjectRow, rusqlite::Error> {
    let default = conn
        .query_row(
            "SELECT id, name, is_default, created_at, updated_at FROM projects WHERE is_default = 1 ORDER BY id LIMIT 1",
            [],
            project_from_row,
        )
        .optional()?;

    if let Some(project) = default {
        return Ok(project);
    }

    conn.query_row(
        "SELECT id, name, is_default, created_at, updated_at FROM projects WHERE id = ?1",
        params![DEFAULT_PROJECT_ID],
        project_from_row,
    )
}

pub fn record_project_sample_selection(
    conn: &Connection,
    project_id: &str,
    sample_id: i64,
) -> Result<i64, rusqlite::Error> {
    insert_project_sample_event(conn, project_id, sample_id, "selected", None)
}

pub fn record_project_sample_export(
    conn: &Connection,
    project_id: &str,
    sample_id: i64,
    variant: &str,
) -> Result<i64, rusqlite::Error> {
    insert_project_sample_event(conn, project_id, sample_id, "exported", Some(variant))
}

pub fn add_project_collection_sample(
    conn: &Connection,
    project_id: &str,
    sample_id: i64,
) -> Result<usize, rusqlite::Error> {
    conn.prepare_cached(
        "INSERT OR IGNORE INTO project_collections (project_id, sample_id) VALUES (?1, ?2)",
    )?
    .execute(params![project_id, sample_id])
}

pub fn remove_project_collection_sample(
    conn: &Connection,
    project_id: &str,
    sample_id: i64,
) -> Result<usize, rusqlite::Error> {
    conn.prepare_cached("DELETE FROM project_collections WHERE project_id = ?1 AND sample_id = ?2")?
        .execute(params![project_id, sample_id])
}

pub fn list_project_collection_sample_ids(
    conn: &Connection,
    project_id: &str,
) -> Result<Vec<i64>, rusqlite::Error> {
    let mut stmt = conn.prepare_cached(
        "SELECT sample_id FROM project_collections WHERE project_id = ?1 ORDER BY added_at DESC, sample_id DESC",
    )?;
    let rows = stmt
        .query_map(params![project_id], |row| row.get(0))?
        .collect();
    rows
}

pub fn list_project_usage_events(
    conn: &Connection,
    project_id: &str,
) -> Result<Vec<ProjectSampleEventRow>, rusqlite::Error> {
    let mut stmt = conn.prepare_cached(
        "SELECT id, project_id, sample_id, event_type, variant, metadata_json, created_at
         FROM project_sample_events
         WHERE project_id = ?1
         ORDER BY created_at DESC, id DESC",
    )?;
    let rows = stmt
        .query_map(params![project_id], event_from_row)?
        .collect();
    rows
}

pub fn list_project_used_sample_ids(
    conn: &Connection,
    project_id: &str,
) -> Result<Vec<i64>, rusqlite::Error> {
    let mut stmt = conn.prepare_cached(
        "SELECT sample_id FROM project_sample_events WHERE project_id = ?1
         UNION
         SELECT sample_id FROM project_collections WHERE project_id = ?1
         ORDER BY sample_id",
    )?;
    let rows = stmt
        .query_map(params![project_id], |row| row.get(0))?
        .collect();
    rows
}

pub fn list_other_project_used_sample_ids(
    conn: &Connection,
    project_id: &str,
) -> Result<Vec<i64>, rusqlite::Error> {
    let mut stmt = conn.prepare_cached(
        "SELECT sample_id FROM project_sample_events WHERE project_id <> ?1
         UNION
         SELECT sample_id FROM project_collections WHERE project_id <> ?1
         ORDER BY sample_id",
    )?;
    let rows = stmt
        .query_map(params![project_id], |row| row.get(0))?
        .collect();
    rows
}

fn insert_project_sample_event(
    conn: &Connection,
    project_id: &str,
    sample_id: i64,
    event_type: &str,
    variant: Option<&str>,
) -> Result<i64, rusqlite::Error> {
    conn.prepare_cached(
        "INSERT INTO project_sample_events (project_id, sample_id, event_type, variant) VALUES (?1, ?2, ?3, ?4)",
    )?
    .execute(params![project_id, sample_id, event_type, variant])?;
    Ok(conn.last_insert_rowid())
}

fn project_from_row(row: &rusqlite::Row<'_>) -> Result<ProjectRow, rusqlite::Error> {
    let is_default: i64 = row.get(2)?;
    Ok(ProjectRow {
        id: row.get(0)?,
        name: row.get(1)?,
        is_default: is_default != 0,
        created_at: row.get(3)?,
        updated_at: row.get(4)?,
    })
}

fn event_from_row(row: &rusqlite::Row<'_>) -> Result<ProjectSampleEventRow, rusqlite::Error> {
    Ok(ProjectSampleEventRow {
        id: row.get(0)?,
        project_id: row.get(1)?,
        sample_id: row.get(2)?,
        event_type: row.get(3)?,
        variant: row.get(4)?,
        metadata_json: row.get(5)?,
        created_at: row.get(6)?,
    })
}

fn unique_project_id(conn: &Connection, name: &str) -> Result<String, rusqlite::Error> {
    let slug = project_slug(name);
    let mut candidate = slug.clone();
    let mut suffix = 2;
    while project_exists(conn, &candidate)? {
        candidate = format!("{slug}-{suffix}");
        suffix += 1;
    }
    Ok(candidate)
}

fn project_slug(name: &str) -> String {
    let mut slug = String::new();
    let mut last_dash = false;
    for ch in name.chars().flat_map(char::to_lowercase) {
        if ch.is_ascii_alphanumeric() {
            slug.push(ch);
            last_dash = false;
        } else if !last_dash && !slug.is_empty() {
            slug.push('-');
            last_dash = true;
        }
    }
    let trimmed = slug.trim_matches('-').to_string();
    if trimmed.is_empty() {
        "project".to_string()
    } else {
        trimmed
    }
}

fn project_exists(conn: &Connection, project_id: &str) -> Result<bool, rusqlite::Error> {
    let found = conn
        .query_row(
            "SELECT 1 FROM projects WHERE id = ?1",
            params![project_id],
            |_| Ok(()),
        )
        .optional()?;
    Ok(found.is_some())
}

#[cfg(test)]
mod tests;
