use crate::db::operations::{self, CollectionInput, CollectionRow, SampleRow};

use super::{ManagerError, SampleManager};

impl SampleManager {
    pub fn create_collection(
        &self,
        name: String,
        description: Option<String>,
    ) -> Result<CollectionRow, ManagerError> {
        Ok(operations::create_collection(
            &self.conn,
            &CollectionInput { name, description },
        )?)
    }

    pub fn list_collections(&self) -> Result<Vec<CollectionRow>, ManagerError> {
        Ok(operations::list_collections(&self.conn)?)
    }

    pub fn update_collection(
        &self,
        id: i64,
        name: String,
        description: Option<String>,
    ) -> Result<Option<CollectionRow>, ManagerError> {
        Ok(operations::update_collection(
            &self.conn,
            id,
            &CollectionInput { name, description },
        )?)
    }

    pub fn delete_collection(&self, id: i64) -> Result<usize, ManagerError> {
        Ok(operations::delete_collection(&self.conn, id)?)
    }

    pub fn add_samples_to_collection(
        &self,
        collection_id: i64,
        sample_ids: Vec<i64>,
    ) -> Result<usize, ManagerError> {
        Ok(operations::add_samples_to_collection(
            &self.conn,
            collection_id,
            &sample_ids,
        )?)
    }

    pub fn remove_samples_from_collection(
        &self,
        collection_id: i64,
        sample_ids: Vec<i64>,
    ) -> Result<usize, ManagerError> {
        Ok(operations::remove_samples_from_collection(
            &self.conn,
            collection_id,
            &sample_ids,
        )?)
    }

    pub fn list_collection_samples(
        &self,
        collection_id: i64,
    ) -> Result<Vec<SampleRow>, ManagerError> {
        Ok(operations::list_collection_samples(
            &self.conn,
            collection_id,
        )?)
    }
}
