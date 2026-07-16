use crate::db::operations::{
    self, CollectionAddResult, CollectionMemberRow, CollectionRow, SampleRow,
};

use super::{ManagerError, SampleManager};

impl SampleManager {
    pub fn list_collections(&self) -> Result<Vec<CollectionRow>, ManagerError> {
        Ok(operations::list_collections(&self.conn)?)
    }

    pub fn get_collection_by_id(
        &self,
        collection_id: i64,
    ) -> Result<Option<CollectionRow>, ManagerError> {
        Ok(operations::get_collection_by_id(&self.conn, collection_id)?)
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
