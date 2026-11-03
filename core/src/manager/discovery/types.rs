use serde::{Deserialize, Serialize};

use crate::db::operations::SampleRow;

#[derive(Debug, thiserror::Error)]
pub enum DiscoveryError {
    #[error("{0}")]
    Invalid(String),
    #[error("database error: {0}")]
    Db(#[from] rusqlite::Error),
    #[error("saved rule error: {0}")]
    Json(#[from] serde_json::Error),
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum UsageKind {
    Preview,
    Export,
}

impl UsageKind {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Preview => "preview",
            Self::Export => "export",
        }
    }
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ProjectStatus {
    Candidate,
    Adopted,
}

impl ProjectStatus {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Candidate => "candidate",
            Self::Adopted => "adopted",
        }
    }
}

#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(deny_unknown_fields)]
pub struct SmartRules {
    pub instrument: Option<String>,
    pub playback_type: Option<String>,
    pub bpm_min: Option<f64>,
    pub bpm_max: Option<f64>,
    #[serde(default)]
    pub favorites_only: bool,
}

impl SmartRules {
    pub fn validate(&self) -> Result<(), DiscoveryError> {
        if self
            .instrument
            .as_ref()
            .is_some_and(|v| v.trim().is_empty() || v.len() > 100)
            || self
                .playback_type
                .as_ref()
                .is_some_and(|v| v != "loop" && v != "oneshot")
            || [self.bpm_min, self.bpm_max]
                .iter()
                .flatten()
                .any(|v| !v.is_finite() || *v < 0.0 || *v > 1000.0)
            || matches!((self.bpm_min, self.bpm_max), (Some(a), Some(b)) if a > b)
        {
            return Err(DiscoveryError::Invalid(
                "Invalid instrument, type or BPM range".into(),
            ));
        }
        Ok(())
    }
}

#[derive(Debug, Deserialize, Serialize)]
pub struct SmartCollection {
    pub id: i64,
    pub name: String,
    pub rules: SmartRules,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(tag = "mode", rename_all = "snake_case")]
pub enum DiscoveryView {
    Ranking {
        metric: RankingMetric,
        days: Option<u32>,
    },
    Project {
        collection_id: i64,
    },
    Smart {
        rules: SmartRules,
    },
    Unplayed,
    Forgotten {
        days: u32,
    },
    Similar {
        sample_id: i64,
    },
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum RankingMetric {
    Preview,
    Export,
    Adopted,
}

#[derive(Debug, Deserialize)]
pub struct DiscoveryQuery {
    pub view: DiscoveryView,
    pub instrument: Option<String>,
    #[serde(default)]
    pub favorite_ids: Vec<i64>,
    #[serde(default)]
    pub offset: u32,
}

#[derive(Debug, Serialize)]
pub struct DiscoveryRow {
    pub sample: SampleRow,
    pub count: Option<i64>,
    pub last_used: Option<i64>,
    pub status: Option<String>,
    pub note: String,
}

#[derive(Debug, Deserialize)]
pub struct ProjectMemberUpdate {
    pub collection_id: i64,
    pub sample_id: i64,
    pub status: ProjectStatus,
    pub note: String,
    #[serde(default)]
    pub add_only: bool,
}

pub(super) fn checked_name(name: &str) -> Result<&str, DiscoveryError> {
    let name = name.trim();
    if name.is_empty() || name.chars().count() > 120 {
        return Err(DiscoveryError::Invalid(
            "Name must contain 1–120 characters".into(),
        ));
    }
    Ok(name)
}
