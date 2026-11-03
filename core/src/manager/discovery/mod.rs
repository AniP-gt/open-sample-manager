mod projects;
mod queries;
mod types;
pub use types::*;

use super::SampleManager;
use rusqlite::params;

impl SampleManager {
    pub fn record_sample_usage(
        &self,
        sample_id: i64,
        kind: UsageKind,
    ) -> Result<bool, DiscoveryError> {
        let changed = self.conn.execute(
            "INSERT INTO sample_usage_events(sample_id, kind)
             SELECT ?1, ?2 WHERE NOT EXISTS (
                SELECT 1 FROM sample_usage_events
                WHERE sample_id=?1 AND kind=?2 AND occurred_at > unixepoch()-5
             )",
            params![sample_id, kind.as_str()],
        )?;
        Ok(changed > 0)
    }

    pub fn list_smart_collections(&self) -> Result<Vec<SmartCollection>, DiscoveryError> {
        let mut stmt = self
            .conn
            .prepare_cached("SELECT id,name,rules_json FROM smart_collections ORDER BY name,id")?;
        let values = stmt.query_map([], |r| {
            Ok((
                r.get::<_, i64>(0)?,
                r.get::<_, String>(1)?,
                r.get::<_, String>(2)?,
            ))
        })?;
        values
            .map(|row| {
                let (id, name, json) = row?;
                let rules: SmartRules = serde_json::from_str(&json)?;
                rules.validate()?;
                Ok(SmartCollection { id, name, rules })
            })
            .collect()
    }

    pub fn save_smart_collection(
        &self,
        name: &str,
        rules: &SmartRules,
    ) -> Result<(), DiscoveryError> {
        let name = types::checked_name(name)?;
        rules.validate()?;
        self.conn.execute(
            "INSERT INTO smart_collections(name,rules_json) VALUES(?1,?2)
             ON CONFLICT(name) DO UPDATE SET rules_json=excluded.rules_json",
            params![name, serde_json::to_string(rules)?],
        )?;
        Ok(())
    }

    pub fn delete_smart_collection(&self, id: i64) -> Result<(), DiscoveryError> {
        self.conn
            .execute("DELETE FROM smart_collections WHERE id=?1", [id])?;
        Ok(())
    }
}

#[cfg(test)]
mod tests;
