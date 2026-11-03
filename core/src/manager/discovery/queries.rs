use super::{
    DiscoveryError, DiscoveryQuery, DiscoveryRow, DiscoveryView, RankingMetric, SmartRules,
};
use crate::{db::operations, manager::SampleManager};
use rusqlite::{named_params, OptionalExtension};

impl SampleManager {
    pub fn query_discovery(
        &self,
        query: &DiscoveryQuery,
    ) -> Result<Vec<DiscoveryRow>, DiscoveryError> {
        let favorites = serde_json::to_string(&query.favorite_ids)?;
        let mut rules = SmartRules::default();
        let mut kind = "preview";
        let mut days = None;
        let mut collection_id = None;
        let mut source_id = None;
        let (join, condition, order) = match &query.view {
            DiscoveryView::Ranking { metric, days: period } => {
                if period.is_some_and(|v| v == 0 || v > 36500) {
                    return Err(DiscoveryError::Invalid("Invalid ranking period".into()));
                }
                days = *period;
                match metric {
                    RankingMetric::Preview | RankingMetric::Export => {
                        kind = match metric {
                            RankingMetric::Preview => "preview",
                            RankingMetric::Export => "export",
                            RankingMetric::Adopted => "adopted",
                        };
                        ("JOIN (SELECT sample_id,COUNT(*) AS uses,MAX(occurred_at) AS last_used
                          FROM sample_usage_events WHERE kind=:kind
                          AND (:days IS NULL OR occurred_at >= unixepoch()-:days*86400)
                          GROUP BY sample_id) u ON u.sample_id=s.id", "1", "u.uses DESC,u.last_used DESC,s.id")
                    }
                    RankingMetric::Adopted => (
                        "JOIN (SELECT sample_id,COUNT(*) AS uses,MAX(adopted_at) AS last_used
                         FROM project_sample_details WHERE status='adopted'
                         AND (:days IS NULL OR adopted_at >= unixepoch()-:days*86400)
                         GROUP BY sample_id) u ON u.sample_id=s.id", "1", "u.uses DESC,u.last_used DESC,s.id"),
                }
            }
            DiscoveryView::Project { collection_id: id } => {
                collection_id = Some(*id);
                ("LEFT JOIN (SELECT sample_id,COUNT(*) AS uses,MAX(occurred_at) AS last_used FROM sample_usage_events GROUP BY sample_id) u ON u.sample_id=s.id", "cm.collection_id=:collection", "cm.position,s.id")
            }
            DiscoveryView::Smart { rules: value } => {
                value.validate()?;
                rules = value.clone();
                (USAGE_JOIN, "1", "s.file_name COLLATE NOCASE,s.id")
            }
            DiscoveryView::Unplayed => (USAGE_JOIN, "NOT EXISTS(SELECT 1 FROM sample_usage_events e WHERE e.sample_id=s.id AND e.kind='preview')", "s.id DESC"),
            DiscoveryView::Forgotten { days: period } => {
                if *period == 0 || *period > 36500 {
                    return Err(DiscoveryError::Invalid("Invalid rediscovery period".into()));
                }
                days = Some(*period);
                rules.favorites_only = true;
                (USAGE_JOIN, "(u.last_used IS NULL OR u.last_used < unixepoch()-:days*86400)", "COALESCE(u.last_used,0),s.id")
            }
            DiscoveryView::Similar { sample_id } => {
                let exists = self.conn.query_row("SELECT id FROM samples WHERE id=?1", [sample_id], |r| r.get::<_, i64>(0)).optional()?;
                if exists.is_none() { return Err(DiscoveryError::Invalid("Similarity source was deleted".into())); }
                source_id = Some(*sample_id);
                (USAGE_JOIN, "s.id!=:source AND s.instrument_type=src.instrument_type AND s.playback_type=src.playback_type",
                 "CASE WHEN s.bpm IS NOT NULL AND src.bpm IS NOT NULL THEN ABS(s.bpm-src.bpm)/20.0 ELSE 1 END
                  + ABS(COALESCE(s.duration,0)-COALESCE(src.duration,0))/MAX(COALESCE(src.duration,0),0.1)
                  + ABS(COALESCE(s.low_ratio,0)-COALESCE(src.low_ratio,0))*2
                  + CASE WHEN s.musical_key IS NOT NULL AND s.musical_key=src.musical_key THEN 0 ELSE 1 END,s.id")
            }
        };
        let sql = format!(
            "SELECT s.id,u.uses,u.last_used,p.status,COALESCE(p.note,'')
             FROM samples s {join}
             LEFT JOIN samples src ON src.id=:source
             LEFT JOIN collection_members cm ON cm.sample_id=s.id AND cm.collection_id=:collection
             LEFT JOIN project_sample_details p ON p.sample_id=s.id AND p.collection_id=cm.collection_id
             WHERE ({condition})
             AND (:instrument IS NULL OR s.instrument_type=:instrument)
             AND (:rule_instrument IS NULL OR s.instrument_type=:rule_instrument)
             AND (:playback IS NULL OR s.playback_type=:playback)
             AND (:min IS NULL OR s.bpm>=:min) AND (:max IS NULL OR s.bpm<=:max)
             AND (:favorites_only=0 OR s.id IN (SELECT value FROM json_each(:favorites)))
             AND (:kind IS NOT NULL) AND (:days IS NULL OR :days>=0)
             ORDER BY {order} LIMIT 100 OFFSET :offset"
        );
        let mut stmt = self.conn.prepare_cached(&sql)?;
        let values = stmt.query_map(named_params! {
            ":kind":kind, ":days":days, ":source":source_id, ":collection":collection_id,
            ":instrument":query.instrument, ":rule_instrument":rules.instrument,
            ":playback":rules.playback_type, ":min":rules.bpm_min, ":max":rules.bpm_max,
            ":favorites_only":rules.favorites_only, ":favorites":favorites, ":offset":query.offset,
        }, |r| Ok((r.get::<_,i64>(0)?,r.get::<_,Option<i64>>(1)?,r.get::<_,Option<i64>>(2)?,r.get::<_,Option<String>>(3)?,r.get::<_,String>(4)?)))?;
        let mut results = Vec::new();
        for value in values {
            let (id, count, last_used, status, note) = value?;
            if let Some(sample) = operations::get_sample_by_id(&self.conn, id)? {
                results.push(DiscoveryRow {
                    sample,
                    count,
                    last_used,
                    status,
                    note,
                });
            }
        }
        Ok(results)
    }
}

const USAGE_JOIN: &str = "LEFT JOIN (
    SELECT sample_id,COUNT(*) AS uses,MAX(occurred_at) AS last_used
    FROM sample_usage_events GROUP BY sample_id) u ON u.sample_id=s.id";
