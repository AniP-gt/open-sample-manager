use super::{types::checked_name, DiscoveryError, ProjectMemberUpdate, ProjectStatus};
use crate::manager::SampleManager;
use rusqlite::params;

impl SampleManager {
    pub fn create_project_shelf(&self, name: &str) -> Result<i64, DiscoveryError> {
        let name = checked_name(name)?;
        let name = crate::db::operations::normalize_collection_name(name)?;
        self.conn.execute(
            "INSERT INTO collections(name) VALUES(?1) ON CONFLICT(name) DO NOTHING",
            [&name],
        )?;
        Ok(self
            .conn
            .query_row("SELECT id FROM collections WHERE name=?1", [&name], |r| {
                r.get(0)
            })?)
    }

    pub fn update_project_member(
        &mut self,
        update: &ProjectMemberUpdate,
    ) -> Result<(), DiscoveryError> {
        if update.note.chars().count() > 4000 {
            return Err(DiscoveryError::Invalid(
                "Note must be at most 4000 characters".into(),
            ));
        }
        let tx = self.conn.transaction()?;
        tx.query_row(
            "SELECT id FROM collections WHERE id=?1",
            [update.collection_id],
            |_| Ok(()),
        )?;
        let added = tx.execute(
            "INSERT INTO collection_members(collection_id,sample_id,position)
             SELECT ?1,?2,COALESCE(MAX(position),0)+1 FROM collection_members WHERE collection_id=?1
             ON CONFLICT(collection_id,sample_id) DO NOTHING",
            params![update.collection_id, update.sample_id],
        )?;
        if update.add_only && added == 0 {
            tx.commit()?;
            return Ok(());
        }
        let adopted = matches!(update.status, ProjectStatus::Adopted);
        tx.execute(
            "INSERT INTO project_sample_details(collection_id,sample_id,status,note,adopted_at)
             VALUES(?1,?2,?3,?4,CASE WHEN ?5 THEN unixepoch() END)
             ON CONFLICT(collection_id,sample_id) DO UPDATE SET
             status=excluded.status,note=excluded.note,
             adopted_at=CASE WHEN excluded.status='candidate' THEN NULL
                WHEN project_sample_details.status='adopted' THEN project_sample_details.adopted_at
                ELSE unixepoch() END",
            params![
                update.collection_id,
                update.sample_id,
                update.status.as_str(),
                update.note,
                adopted
            ],
        )?;
        tx.commit()?;
        Ok(())
    }

    pub fn remove_project_member(
        &self,
        collection_id: i64,
        sample_id: i64,
    ) -> Result<(), DiscoveryError> {
        self.conn.execute(
            "DELETE FROM collection_members WHERE collection_id=?1 AND sample_id=?2",
            params![collection_id, sample_id],
        )?;
        Ok(())
    }
}
