use crate::db::operations::MidiTagRow;

use super::{midi, ManagerError, SampleManager};

impl SampleManager {
    pub fn get_all_midi_tags(&self) -> Result<Vec<MidiTagRow>, ManagerError> {
        midi::get_all_midi_tags(&self.conn)
    }

    pub fn add_midi_tag(&self, name: &str) -> Result<i64, ManagerError> {
        midi::add_midi_tag(&self.conn, name)
    }

    pub fn delete_midi_tag(&self, id: i64) -> Result<usize, ManagerError> {
        midi::delete_midi_tag(&self.conn, id)
    }

    pub fn update_midi_tag(&self, id: i64, name: &str) -> Result<usize, ManagerError> {
        midi::update_midi_tag(&self.conn, id, name)
    }

    pub fn set_midi_file_tag(&self, midi_id: i64, tag_id: Option<i64>) -> Result<(), ManagerError> {
        midi::set_midi_file_tag(&self.conn, midi_id, tag_id)
    }

    pub fn get_midi_file_tags(&self, midi_id: i64) -> Result<Vec<MidiTagRow>, ManagerError> {
        midi::get_midi_file_tags(&self.conn, midi_id)
    }
}
