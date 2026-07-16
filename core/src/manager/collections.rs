use crate::db::operations::{
    self, CollectionAddResult, CollectionInput, CollectionMemberRow, CollectionRow, SampleRow,
};

use super::{ManagerError, SampleManager};

impl SampleManager {
    pub fn create_collection(
        &mut self,
        name: String,
        description: Option<String>,
    ) -> Result<CollectionRow, ManagerError> {
        Ok(operations::create_collection(
            &mut self.conn,
            &CollectionInput { name, description },
        )?)
    }

    pub fn list_collections(&self) -> Result<Vec<CollectionRow>, ManagerError> {
        Ok(operations::list_collections(&self.conn)?)
    }

    pub fn get_collection_by_id(
        &self,
        collection_id: i64,
    ) -> Result<Option<CollectionRow>, ManagerError> {
        Ok(operations::get_collection_by_id(&self.conn, collection_id)?)
    }

    pub fn update_collection(
        &mut self,
        id: i64,
        name: String,
        description: Option<String>,
    ) -> Result<Option<CollectionRow>, ManagerError> {
        Ok(operations::update_collection(
            &mut self.conn,
            id,
            &CollectionInput { name, description },
        )?)
    }

    pub fn delete_collection(&mut self, id: i64) -> Result<usize, ManagerError> {
        Ok(operations::delete_collection(&mut self.conn, id)?)
    }

    pub fn add_samples_to_collection(
        &mut self,
        collection_name: &str,
        sample_ids: &[i64],
    ) -> Result<CollectionAddResult, ManagerError> {
        Ok(operations::add_samples_to_collection(
            &mut self.conn,
            collection_name,
            sample_ids,
        )?)
    }

    pub fn add_samples_to_collection_by_id(
        &mut self,
        collection_id: i64,
        sample_ids: Vec<i64>,
    ) -> Result<usize, ManagerError> {
        Ok(operations::add_samples_to_collection_by_id(
            &mut self.conn,
            collection_id,
            &sample_ids,
        )?)
    }

    pub fn remove_samples_from_collection(
        &mut self,
        collection_id: i64,
        sample_ids: Vec<i64>,
    ) -> Result<usize, ManagerError> {
        Ok(operations::remove_samples_from_collection(
            &mut self.conn,
            collection_id,
            &sample_ids,
        )?)
    }

    pub fn list_collection_member_sample_ids(
        &self,
        collection_id: i64,
    ) -> Result<Vec<i64>, ManagerError> {
        Ok(operations::list_collection_member_sample_ids(
            &self.conn,
            collection_id,
        )?)
    }

    pub fn get_collection_members(
        &self,
        collection_id: i64,
    ) -> Result<Vec<SampleRow>, ManagerError> {
        Ok(operations::get_collection_members(
            &self.conn,
            collection_id,
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

    pub fn list_collection_members_with_positions(
        &self,
        collection_id: i64,
    ) -> Result<Vec<CollectionMemberRow>, ManagerError> {
        Ok(operations::list_collection_members_with_positions(
            &self.conn,
            collection_id,
        )?)
    }
}
