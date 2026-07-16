use serde::{Deserialize, Serialize};

use open_sample_manager_core::db::operations::SampleRow;

use super::requests::ApiOperation;

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SearchSamplesResponse {
    pub request_id: String,
    pub operation: ApiOperation,
    pub results: Vec<SampleSummary>,
    pub limit: u32,
    pub offset: u32,
    pub has_more: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct GetSampleResponse {
    pub request_id: String,
    pub operation: ApiOperation,
    pub sample: Option<SampleSummary>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct FindSimilarSamplesResponse {
    pub request_id: String,
    pub operation: ApiOperation,
    pub source_id: i64,
    pub matches: Vec<SampleSimilarity>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ShowSamplesInAppResponse {
    pub request_id: String,
    pub operation: ApiOperation,
    pub requested_count: usize,
    pub accepted_count: usize,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct PreviewSampleResponse {
    pub request_id: String,
    pub operation: ApiOperation,
    pub accepted: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct AddToCollectionResponse {
    pub request_id: String,
    pub operation: ApiOperation,
    pub collection_name: String,
    pub requested_count: usize,
    pub added_count: usize,
    pub created: bool,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SampleSummary {
    pub id: i64,
    pub path: String,
    pub file_name: String,
    pub duration: Option<f64>,
    pub bpm: Option<f64>,
    pub periodicity: Option<f64>,
    pub sample_rate: Option<i64>,
    pub file_size: Option<i64>,
    pub artist: Option<String>,
    pub low_ratio: Option<f64>,
    pub attack_slope: Option<f64>,
    pub decay_time: Option<f64>,
    pub sample_type: Option<String>,
    pub source: Option<String>,
    pub pack_name: Option<String>,
    pub license: Option<String>,
    pub license_url: Option<String>,
    pub license_memo: Option<String>,
    pub imported_at: Option<String>,
    pub peak_db: Option<f64>,
    pub rms_db: Option<f64>,
    pub leading_silence_ms: Option<f64>,
    pub clipping_count: Option<i64>,
    pub channel_count: Option<i64>,
    pub bit_depth: Option<i64>,
    pub quality_flags: Option<String>,
    pub is_online: bool,
    pub playback_type: String,
    pub instrument_type: String,
    pub musical_key: Option<String>,
    pub content_hash: Option<String>,
    pub duplicate_count: i64,
    pub tags: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SampleSimilarity {
    pub sample: SampleSummary,
    pub similarity: f64,
}

impl From<SampleRow> for SampleSummary {
    fn from(row: SampleRow) -> Self {
        Self {
            id: row.id,
            path: row.path,
            file_name: row.file_name,
            duration: row.duration,
            bpm: row.bpm,
            periodicity: row.periodicity,
            sample_rate: row.sample_rate,
            file_size: row.file_size,
            artist: row.artist,
            low_ratio: row.low_ratio,
            attack_slope: row.attack_slope,
            decay_time: row.decay_time,
            sample_type: row.sample_type,
            source: row.source,
            pack_name: row.pack_name,
            license: row.license,
            license_url: row.license_url,
            license_memo: row.license_memo,
            imported_at: row.imported_at,
            peak_db: row.peak_db,
            rms_db: row.rms_db,
            leading_silence_ms: row.leading_silence_ms,
            clipping_count: row.clipping_count,
            channel_count: row.channel_count,
            bit_depth: row.bit_depth,
            quality_flags: row.quality_flags,
            is_online: row.is_online,
            playback_type: row.playback_type,
            instrument_type: row.instrument_type,
            musical_key: row.musical_key,
            content_hash: row.content_hash,
            duplicate_count: row.duplicate_count,
            tags: row.tags,
        }
    }
}
