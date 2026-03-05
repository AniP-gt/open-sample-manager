use std::path::Path;

use crate::db::operations::{MidiInput, MidiRow, MidiTagRow};

use super::ManagerError;

pub(super) fn scan_midi_directory(
    conn: &rusqlite::Connection,
    path: &Path,
) -> Result<usize, ManagerError> {
    let files = crate::scanner::scan_midi_directory(path);
    let mut count = 0usize;
    for file_path in files {
        let file_name = file_path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("unknown")
            .to_string();
        let file_size = std::fs::metadata(&file_path).ok().map(|m| m.len() as i64);
        let parsed = crate::analysis::midi::parse_midi(&file_path)
            .map_err(|e| eprintln!("[MIDI scan] failed to parse {:?}: {e}", file_path))
            .ok();
        let input = MidiInput {
            path: file_path.to_string_lossy().to_string(),
            file_name,
            duration: parsed.as_ref().and_then(|p| p.duration),
            tempo: parsed.as_ref().and_then(|p| p.tempo),
            time_signature_numerator: parsed.as_ref().and_then(|p| p.time_signature_numerator),
            time_signature_denominator: parsed.as_ref().and_then(|p| p.time_signature_denominator),
            track_count: parsed.as_ref().and_then(|p| p.track_count),
            note_count: parsed.as_ref().and_then(|p| p.note_count),
            channel_count: parsed.as_ref().and_then(|p| p.channel_count),
            key_estimate: parsed.as_ref().and_then(|p| p.key_estimate.clone()),
            file_size,
        };
        match crate::db::operations::insert_midi(conn, &input) {
            Ok(rowid) if rowid > 0 => count += 1,
            Ok(_) => {}
            Err(e) => eprintln!("[MIDI scan] failed to insert {:?}: {e}", file_path),
        }
    }
    Ok(count)
}

pub(super) fn list_midis_paginated(
    conn: &rusqlite::Connection,
    limit: usize,
    offset: usize,
) -> Result<Vec<MidiRow>, ManagerError> {
    Ok(crate::db::operations::list_midis_paginated(
        conn, limit, offset,
    )?)
}

pub(super) fn get_all_midi_paths(conn: &rusqlite::Connection) -> Result<Vec<String>, ManagerError> {
    Ok(crate::db::operations::get_all_midi_paths(conn)?)
}

pub(super) fn get_midi(
    conn: &rusqlite::Connection,
    path: &str,
) -> Result<Option<MidiRow>, ManagerError> {
    Ok(crate::db::operations::get_midi_by_path(conn, path)?)
}

pub(super) fn delete_midi(conn: &rusqlite::Connection, path: &str) -> Result<usize, ManagerError> {
    Ok(crate::db::operations::delete_midi(conn, path)?)
}

pub(super) fn clear_all_midis(conn: &rusqlite::Connection) -> Result<usize, ManagerError> {
    Ok(crate::db::operations::clear_all_midis(conn)?)
}

pub(super) fn search_midis(
    conn: &rusqlite::Connection,
    query: &str,
) -> Result<Vec<MidiRow>, ManagerError> {
    Ok(crate::db::operations::search_midis(conn, query)?)
}

pub(super) fn get_all_midi_tags(
    conn: &rusqlite::Connection,
) -> Result<Vec<MidiTagRow>, ManagerError> {
    Ok(crate::db::operations::get_all_midi_tags(conn)?)
}

pub(super) fn add_midi_tag(conn: &rusqlite::Connection, name: &str) -> Result<i64, ManagerError> {
    Ok(crate::db::operations::insert_midi_tag(conn, name)?)
}

pub(super) fn delete_midi_tag(conn: &rusqlite::Connection, id: i64) -> Result<usize, ManagerError> {
    Ok(crate::db::operations::delete_midi_tag(conn, id)?)
}

pub(super) fn update_midi_tag(
    conn: &rusqlite::Connection,
    id: i64,
    name: &str,
) -> Result<usize, ManagerError> {
    Ok(crate::db::operations::update_midi_tag(conn, id, name)?)
}

pub(super) fn set_midi_file_tag(
    conn: &rusqlite::Connection,
    midi_id: i64,
    tag_id: Option<i64>,
) -> Result<(), ManagerError> {
    crate::db::operations::set_midi_tag(conn, midi_id, tag_id)?;
    Ok(())
}

pub(super) fn get_midi_file_tags(
    conn: &rusqlite::Connection,
    midi_id: i64,
) -> Result<Vec<MidiTagRow>, ManagerError> {
    Ok(crate::db::operations::get_tags_for_midi(conn, midi_id)?)
}
