use crate::db::operations::{
    delete_instrument_type, get_all_instrument_types, insert_instrument_type,
    update_instrument_type, InstrumentTypeRow,
};

use super::{ManagerError, SampleManager};

impl SampleManager {
    pub fn get_all_instrument_types(&self) -> Result<Vec<InstrumentTypeRow>, ManagerError> {
        Ok(get_all_instrument_types(&self.conn)?)
    }

    pub fn add_instrument_type(&self, name: &str) -> Result<i64, ManagerError> {
        Ok(insert_instrument_type(&self.conn, name)?)
    }

    pub fn delete_instrument_type(&self, id: i64) -> Result<usize, ManagerError> {
        Ok(delete_instrument_type(&self.conn, id)?)
    }

    pub fn update_instrument_type(&self, id: i64, name: &str) -> Result<usize, ManagerError> {
        Ok(update_instrument_type(&self.conn, id, name)?)
    }

    /// Atomically assigns registered instrument types to samples.
    pub fn update_sample_instrument_types(
        &mut self,
        assignments: &[(i64, String)],
    ) -> Result<usize, ManagerError> {
        let transaction = self.conn.transaction()?;
        let mut updated = 0;

        for (sample_id, instrument_type) in assignments {
            let instrument_exists: bool = transaction.query_row(
                "SELECT EXISTS(SELECT 1 FROM instrument_types WHERE name = ?1)",
                [instrument_type],
                |row| row.get(0),
            )?;
            if !instrument_exists {
                return Err(rusqlite::Error::QueryReturnedNoRows.into());
            }

            let affected = transaction.execute(
                "UPDATE samples SET instrument_type = ?1 WHERE id = ?2",
                rusqlite::params![instrument_type, sample_id],
            )?;
            if affected == 0 {
                return Err(rusqlite::Error::QueryReturnedNoRows.into());
            }
            updated += affected;
        }

        transaction.commit()?;
        Ok(updated)
    }
}
