use crate::db::operations::{self, SavedSearchInput, SavedSearchRow};

use super::{ManagerError, SampleManager};

impl SampleManager {
    pub fn create_saved_search(
        &self,
        input: SavedSearchInput,
    ) -> Result<SavedSearchRow, ManagerError> {
        Ok(operations::create_saved_search(&self.conn, &input)?)
    }

    pub fn list_saved_searches(&self) -> Result<Vec<SavedSearchRow>, ManagerError> {
        Ok(operations::list_saved_searches(&self.conn)?)
    }

    pub fn update_saved_search(
        &self,
        id: i64,
        input: SavedSearchInput,
    ) -> Result<Option<SavedSearchRow>, ManagerError> {
        Ok(operations::update_saved_search(&self.conn, id, &input)?)
    }

    pub fn delete_saved_search(&self, id: i64) -> Result<usize, ManagerError> {
        Ok(operations::delete_saved_search(&self.conn, id)?)
    }
}
