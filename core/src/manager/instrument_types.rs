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
}
