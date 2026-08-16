use serde::de::DeserializeOwned;

use super::{
    errors::ApiError,
    requests::{
        AddToCollectionRequest, ApiOperation, ApiRequest, CreateInstrumentTypeRequest,
        CreateMidiTagRequest, FindSimilarSamplesRequest, GetSampleRequest,
        ListInstrumentTypesRequest, ListMidiTagsRequest, ListMidisRequest, PreviewSampleRequest,
        SearchSamplesRequest, ShowSamplesInAppRequest, UpdateMidiTagsRequest,
        UpdateSampleInstrumentsRequest,
    },
};

pub const MAX_QUERY_LENGTH: usize = 512;
pub const MAX_TEXT_FIELD_LENGTH: usize = 128;
pub const MAX_SAMPLE_IDS: usize = 100;
pub const MAX_LIMIT: u32 = 100;
const MAX_OFFSET: u32 = 10_000;

pub fn request_id(request_id: &str) -> Result<(), ApiError> {
    if request_id.trim().is_empty() {
        return Err(ApiError::invalid_request(
            request_id,
            ApiOperation::SearchSamples,
            "request_id is required",
        ));
    }
    field_len(
        request_id,
        MAX_TEXT_FIELD_LENGTH,
        request_id,
        ApiOperation::SearchSamples,
        "request_id exceeds maximum length",
    )
}

pub fn field_len(
    value: &str,
    max: usize,
    request_id: &str,
    operation: ApiOperation,
    message: &'static str,
) -> Result<(), ApiError> {
    if value.len() > max {
        return Err(ApiError::payload_too_large(request_id, operation, message));
    }
    Ok(())
}

pub fn limit(
    value: Option<u32>,
    request_id: &str,
    operation: ApiOperation,
) -> Result<(), ApiError> {
    if let Some(value) = value {
        if value == 0 || value > MAX_LIMIT {
            return Err(ApiError::invalid_request(
                request_id,
                operation,
                "limit must be within 1..=100",
            ));
        }
    }
    Ok(())
}

pub fn offset(value: Option<u32>, request_id: &str) -> Result<(), ApiError> {
    if value.is_some_and(|value| value > MAX_OFFSET) {
        return Err(ApiError::payload_too_large(
            request_id,
            ApiOperation::SearchSamples,
            "offset exceeds maximum supported value",
        ));
    }
    Ok(())
}

pub fn sample_id(
    sample_id: i64,
    request_id: &str,
    operation: ApiOperation,
) -> Result<(), ApiError> {
    if sample_id <= 0 {
        return Err(ApiError::invalid_request(
            request_id,
            operation,
            "sample_id must be positive",
        ));
    }
    Ok(())
}

pub fn sample_ids(
    sample_ids: &[i64],
    selected_id: Option<i64>,
    request_id: &str,
    operation: ApiOperation,
) -> Result<(), ApiError> {
    if sample_ids.is_empty() || sample_ids.len() > MAX_SAMPLE_IDS {
        return Err(ApiError::invalid_request(
            request_id,
            operation,
            "sample_ids must have 1..=100 entries",
        ));
    }

    for &id in sample_ids {
        sample_id(id, request_id, operation)?;
    }

    let unique_ids = sample_ids
        .iter()
        .copied()
        .collect::<std::collections::HashSet<_>>();
    if unique_ids.len() != sample_ids.len() {
        return Err(ApiError::duplicate(
            request_id,
            operation,
            "sample_ids must be unique",
        ));
    }

    if selected_id.is_some_and(|selected_id| !unique_ids.contains(&selected_id)) {
        return Err(ApiError::invalid_request(
            request_id,
            operation,
            "selected_id must be one of sample_ids",
        ));
    }
    Ok(())
}

pub fn validate_todo_one_request(
    bytes: &[u8],
    request_id: &str,
    expected_operation: ApiOperation,
) -> Result<(), ApiError> {
    match expected_operation {
        ApiOperation::SearchSamples => {
            validate_typed_request::<SearchSamplesRequest>(bytes, request_id, expected_operation)
        }
        ApiOperation::GetSample => {
            validate_typed_request::<GetSampleRequest>(bytes, request_id, expected_operation)
        }
        ApiOperation::FindSimilarSamples => validate_typed_request::<FindSimilarSamplesRequest>(
            bytes,
            request_id,
            expected_operation,
        ),
        ApiOperation::ShowSamplesInApp => {
            validate_typed_request::<ShowSamplesInAppRequest>(bytes, request_id, expected_operation)
        }
        ApiOperation::PreviewSample => {
            validate_typed_request::<PreviewSampleRequest>(bytes, request_id, expected_operation)
        }
        ApiOperation::AddToCollection => {
            validate_typed_request::<AddToCollectionRequest>(bytes, request_id, expected_operation)
        }
        ApiOperation::ListInstrumentTypes => validate_typed_request::<ListInstrumentTypesRequest>(
            bytes,
            request_id,
            expected_operation,
        ),
        ApiOperation::CreateInstrumentType => {
            validate_typed_request::<CreateInstrumentTypeRequest>(
                bytes,
                request_id,
                expected_operation,
            )
        }
        ApiOperation::UpdateSampleInstruments => validate_typed_request::<
            UpdateSampleInstrumentsRequest,
        >(bytes, request_id, expected_operation),
        ApiOperation::ListMidis => {
            validate_typed_request::<ListMidisRequest>(bytes, request_id, expected_operation)
        }
        ApiOperation::ListMidiTags => {
            validate_typed_request::<ListMidiTagsRequest>(bytes, request_id, expected_operation)
        }
        ApiOperation::CreateMidiTag => {
            validate_typed_request::<CreateMidiTagRequest>(bytes, request_id, expected_operation)
        }
        ApiOperation::UpdateMidiTags => {
            validate_typed_request::<UpdateMidiTagsRequest>(bytes, request_id, expected_operation)
        }
    }
}

trait ValidatedRequest {
    fn validate(&self, request_id: &str) -> Result<(), ApiError>;
}

macro_rules! impl_validated_request {
    ($request:ty) => {
        impl ValidatedRequest for $request {
            fn validate(&self, request_id: &str) -> Result<(), ApiError> {
                <$request>::validate(self, request_id)
            }
        }
    };
}

impl_validated_request!(SearchSamplesRequest);
impl_validated_request!(GetSampleRequest);
impl_validated_request!(FindSimilarSamplesRequest);
impl_validated_request!(ShowSamplesInAppRequest);
impl_validated_request!(PreviewSampleRequest);
impl_validated_request!(AddToCollectionRequest);
impl_validated_request!(ListInstrumentTypesRequest);
impl_validated_request!(CreateInstrumentTypeRequest);
impl_validated_request!(UpdateSampleInstrumentsRequest);
impl_validated_request!(ListMidisRequest);
impl_validated_request!(ListMidiTagsRequest);
impl_validated_request!(CreateMidiTagRequest);
impl_validated_request!(UpdateMidiTagsRequest);

fn validate_typed_request<T>(
    bytes: &[u8],
    request_id: &str,
    expected_operation: ApiOperation,
) -> Result<(), ApiError>
where
    T: DeserializeOwned + ValidatedRequest,
{
    let request = serde_json::from_slice::<ApiRequest<T>>(bytes).map_err(|_| {
        ApiError::invalid_request(
            request_id,
            expected_operation,
            "body must match request contract",
        )
    })?;

    if request.operation != expected_operation {
        return Err(ApiError::invalid_request(
            &request.request_id,
            expected_operation,
            "operation mismatch for this route",
        ));
    }

    request.payload.validate(&request.request_id)
}
