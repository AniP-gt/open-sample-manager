use crate::db::operations::{self, ProjectRow, ProjectSampleEventRow, DEFAULT_PROJECT_ID};

use super::{ManagerError, SampleManager};

impl SampleManager {
    pub fn list_projects(&self) -> Result<Vec<ProjectRow>, ManagerError> {
        Ok(operations::list_projects(&self.conn)?)
    }

    pub fn get_default_project(&self) -> Result<ProjectRow, ManagerError> {
        Ok(operations::get_default_project(&self.conn)?)
    }

    pub fn create_project(&self, name: &str) -> Result<ProjectRow, ManagerError> {
        Ok(operations::create_project(&self.conn, name)?)
    }

    pub fn record_project_sample_selection(
        &self,
        project_id: Option<&str>,
        sample_id: i64,
    ) -> Result<i64, ManagerError> {
        Ok(operations::record_project_sample_selection(
            &self.conn,
            project_id.unwrap_or(DEFAULT_PROJECT_ID),
            sample_id,
        )?)
    }

    pub fn record_project_sample_export(
        &self,
        project_id: Option<&str>,
        sample_id: i64,
        variant: &str,
    ) -> Result<i64, ManagerError> {
        Ok(operations::record_project_sample_export(
            &self.conn,
            project_id.unwrap_or(DEFAULT_PROJECT_ID),
            sample_id,
            variant,
        )?)
    }

    pub fn add_project_collection_sample(
        &self,
        project_id: Option<&str>,
        sample_id: i64,
    ) -> Result<usize, ManagerError> {
        Ok(operations::add_project_collection_sample(
            &self.conn,
            project_id.unwrap_or(DEFAULT_PROJECT_ID),
            sample_id,
        )?)
    }

    pub fn remove_project_collection_sample(
        &self,
        project_id: Option<&str>,
        sample_id: i64,
    ) -> Result<usize, ManagerError> {
        Ok(operations::remove_project_collection_sample(
            &self.conn,
            project_id.unwrap_or(DEFAULT_PROJECT_ID),
            sample_id,
        )?)
    }

    pub fn list_project_collection_sample_ids(
        &self,
        project_id: Option<&str>,
    ) -> Result<Vec<i64>, ManagerError> {
        Ok(operations::list_project_collection_sample_ids(
            &self.conn,
            project_id.unwrap_or(DEFAULT_PROJECT_ID),
        )?)
    }

    pub fn list_project_usage_events(
        &self,
        project_id: Option<&str>,
    ) -> Result<Vec<ProjectSampleEventRow>, ManagerError> {
        Ok(operations::list_project_usage_events(
            &self.conn,
            project_id.unwrap_or(DEFAULT_PROJECT_ID),
        )?)
    }

    pub fn list_project_used_sample_ids(
        &self,
        project_id: Option<&str>,
    ) -> Result<Vec<i64>, ManagerError> {
        Ok(operations::list_project_used_sample_ids(
            &self.conn,
            project_id.unwrap_or(DEFAULT_PROJECT_ID),
        )?)
    }

    pub fn list_other_project_used_sample_ids(
        &self,
        project_id: Option<&str>,
    ) -> Result<Vec<i64>, ManagerError> {
        Ok(operations::list_other_project_used_sample_ids(
            &self.conn,
            project_id.unwrap_or(DEFAULT_PROJECT_ID),
        )?)
    }
}
