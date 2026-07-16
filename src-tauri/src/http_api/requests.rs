use serde::{Deserialize, Serialize};

use super::{
    errors::ApiError,
    validation::{
        field_len, limit, offset, request_id, sample_id, sample_ids, MAX_QUERY_LENGTH,
        MAX_TEXT_FIELD_LENGTH,
    },
};

#[cfg(test)]
pub const ALLOWED_OPERATIONS: [ApiOperation; 6] = [
    ApiOperation::SearchSamples,
    ApiOperation::GetSample,
    ApiOperation::FindSimilarSamples,
    ApiOperation::ShowSamplesInApp,
    ApiOperation::PreviewSample,
    ApiOperation::AddToCollection,
];

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ApiOperation {
    SearchSamples,
    GetSample,
    FindSimilarSamples,
    ShowSamplesInApp,
    PreviewSample,
    AddToCollection,
}

impl ApiOperation {
    #[cfg(test)]
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::SearchSamples => "search_samples",
            Self::GetSample => "get_sample",
            Self::FindSimilarSamples => "find_similar_samples",
            Self::ShowSamplesInApp => "show_samples_in_app",
            Self::PreviewSample => "preview_sample",
            Self::AddToCollection => "add_to_collection",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ApiRequest<T> {
    pub request_id: String,
    pub operation: ApiOperation,
    #[serde(flatten)]
    pub payload: T,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SearchSamplesRequest {
    pub query: Option<String>,
    pub sample_type: Option<String>,
    pub instrument: Option<String>,
    pub bpm_min: Option<f64>,
    pub bpm_max: Option<f64>,
    pub key: Option<String>,
    pub tags: Option<Vec<String>>,
    pub directory_path: Option<String>,
    pub limit: Option<u32>,
    pub offset: Option<u32>,
}

impl SearchSamplesRequest {
    pub fn validate(&self, id: &str) -> Result<(), ApiError> {
        request_id(id)?;
        optional_field(
            &self.query,
            MAX_QUERY_LENGTH,
            id,
            "query exceeds maximum length",
        )?;
        optional_field(
            &self.sample_type,
            MAX_TEXT_FIELD_LENGTH,
            id,
            "sample_type exceeds maximum length",
        )?;
        optional_field(
            &self.instrument,
            MAX_TEXT_FIELD_LENGTH,
            id,
            "instrument exceeds maximum length",
        )?;
        optional_field(
            &self.key,
            MAX_TEXT_FIELD_LENGTH,
            id,
            "key exceeds maximum length",
        )?;
        optional_field(
            &self.directory_path,
            MAX_TEXT_FIELD_LENGTH,
            id,
            "directory_path exceeds maximum length",
        )?;
        if let Some(tags) = &self.tags {
            if tags.len() > super::validation::MAX_SAMPLE_IDS {
                return Err(ApiError::invalid_request(
                    id,
                    ApiOperation::SearchSamples,
                    "tags must have at most 100 entries",
                ));
            }
            for tag in tags {
                field_len(
                    tag,
                    MAX_TEXT_FIELD_LENGTH,
                    id,
                    ApiOperation::SearchSamples,
                    "tag exceeds maximum length",
                )?;
            }
        }
        limit(self.limit, id, ApiOperation::SearchSamples)?;
        offset(self.offset, id)?;
        bpm_range(self.bpm_min, self.bpm_max, id)
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct GetSampleRequest {
    pub sample_id: i64,
}

impl GetSampleRequest {
    pub fn validate(&self, id: &str) -> Result<(), ApiError> {
        request_id(id)?;
        sample_id(self.sample_id, id, ApiOperation::GetSample)
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct FindSimilarSamplesRequest {
    pub sample_id: i64,
    pub limit: u32,
    #[serde(default)]
    pub exclude_duplicates: bool,
}

impl FindSimilarSamplesRequest {
    pub fn validate(&self, id: &str) -> Result<(), ApiError> {
        request_id(id)?;
        sample_id(self.sample_id, id, ApiOperation::FindSimilarSamples)?;
        limit(Some(self.limit), id, ApiOperation::FindSimilarSamples)
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ShowSamplesInAppRequest {
    pub sample_ids: Vec<i64>,
    pub selected_id: Option<i64>,
}

impl ShowSamplesInAppRequest {
    pub fn validate(&self, id: &str) -> Result<(), ApiError> {
        request_id(id)?;
        sample_ids(
            &self.sample_ids,
            self.selected_id,
            id,
            ApiOperation::ShowSamplesInApp,
        )
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct PreviewSampleRequest {
    pub sample_id: i64,
}

impl PreviewSampleRequest {
    pub fn validate(&self, id: &str) -> Result<(), ApiError> {
        request_id(id)?;
        sample_id(self.sample_id, id, ApiOperation::PreviewSample)
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct AddToCollectionRequest {
    pub collection_name: String,
    pub sample_ids: Vec<i64>,
}

impl AddToCollectionRequest {
    pub fn validate(&self, id: &str) -> Result<(), ApiError> {
        request_id(id)?;
        field_len(
            &self.collection_name,
            MAX_TEXT_FIELD_LENGTH,
            id,
            ApiOperation::AddToCollection,
            "collection_name exceeds maximum length",
        )?;
        sample_ids(&self.sample_ids, None, id, ApiOperation::AddToCollection)
    }
}

fn optional_field(
    value: &Option<String>,
    max: usize,
    id: &str,
    message: &'static str,
) -> Result<(), ApiError> {
    if let Some(value) = value {
        field_len(value, max, id, ApiOperation::SearchSamples, message)?;
    }
    Ok(())
}

fn bpm_range(min: Option<f64>, max: Option<f64>, id: &str) -> Result<(), ApiError> {
    if min.is_some_and(|value| !value.is_finite() || value < 0.0)
        || max.is_some_and(|value| !value.is_finite() || value < 0.0)
    {
        return Err(ApiError::invalid_request(
            id,
            ApiOperation::SearchSamples,
            "BPM values must be finite and non-negative",
        ));
    }
    if min.zip(max).is_some_and(|(min, max)| min > max) {
        return Err(ApiError::invalid_request(
            id,
            ApiOperation::SearchSamples,
            "bpm_min must be <= bpm_max",
        ));
    }
    Ok(())
}
