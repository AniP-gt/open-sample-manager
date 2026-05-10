use std::path::Path;

use crate::db::operations::{list_midis_around_id, MidiRow};

use super::{midi, ManagerError, SampleManager};

impl SampleManager {
    pub fn scan_midi_directory(&self, path: impl AsRef<Path>) -> Result<usize, ManagerError> {
        midi::scan_midi_directory(&self.conn, path.as_ref())
    }

    pub fn list_midis_paginated(
        &self,
        limit: usize,
        offset: usize,
        directory_path: Option<&str>,
        tag_id: Option<i64>,
    ) -> Result<Vec<MidiRow>, ManagerError> {
        midi::list_midis_paginated(&self.conn, limit, offset, directory_path, tag_id)
    }

    pub fn list_midis_around_id(
        &self,
        target_id: i64,
        limit: usize,
    ) -> Result<Vec<MidiRow>, ManagerError> {
        Ok(list_midis_around_id(&self.conn, target_id, limit)?)
    }

    pub fn get_all_midi_paths(&self) -> Result<Vec<String>, ManagerError> {
        midi::get_all_midi_paths(&self.conn)
    }

    pub fn get_midi(&self, path: &str) -> Result<Option<MidiRow>, ManagerError> {
        midi::get_midi(&self.conn, path)
    }

    pub fn delete_midi(&self, path: &str) -> Result<usize, ManagerError> {
        midi::delete_midi(&self.conn, path)
    }

    pub fn clear_all_midis(&self) -> Result<usize, ManagerError> {
        midi::clear_all_midis(&self.conn)
    }

    pub fn search_midis(&self, query: &str) -> Result<Vec<MidiRow>, ManagerError> {
        midi::search_midis(&self.conn, query)
    }

    pub fn search_midis_paginated(
        &self,
        query: &str,
        limit: usize,
        offset: usize,
        directory_path: Option<&str>,
        tag_id: Option<i64>,
    ) -> Result<Vec<MidiRow>, ManagerError> {
        midi::search_midis_paginated(&self.conn, query, limit, offset, directory_path, tag_id)
    }
}
