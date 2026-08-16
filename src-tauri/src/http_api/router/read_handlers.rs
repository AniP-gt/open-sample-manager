use axum::{
    body::Body,
    extract::State,
    http::Request,
    response::{IntoResponse, Response},
    Json,
};
use std::sync::Arc;

use crate::http_api::contracts::{
    ApiError, ApiOperation, FindSimilarSamplesRequest, FindSimilarSamplesResponse,
    GetSampleRequest, GetSampleResponse, ListMidiTagsRequest, ListMidiTagsResponse,
    ListMidisRequest, ListMidisResponse, MidiSummary, MidiTagSummary, SampleSimilarity,
    SampleSummary, SearchSamplesRequest, SearchSamplesResponse,
};

pub(crate) async fn list_midis_handler(
    State(state): State<ReadHandlerState>,
    request: Request<Body>,
) -> Response {
    let request =
        match parse_typed_request::<ListMidisRequest>(request, ApiOperation::ListMidis).await {
            Ok(r) => r,
            Err(response) => return response,
        };
    let response_limit = request.payload.limit.unwrap_or(100);
    let response_offset = request.payload.offset.unwrap_or(0);
    let limit = response_limit as usize;
    let offset = response_offset as usize;
    let directory_path = request.payload.directory_path;
    let tag_id = request.payload.tag_id;
    let manager = Arc::clone(&state.manager);
    let result = tokio::task::spawn_blocking(move || {
        let manager = manager
            .lock()
            .map_err(|_| ReadHandlerFailure::ManagerUnavailable)?;
        manager
            .list_midis_paginated(
                limit.saturating_add(1),
                offset,
                directory_path.as_deref(),
                tag_id,
            )
            .map_err(|_| ReadHandlerFailure::OperationFailed)
    })
    .await;
    let mut rows = match result {
        Ok(Ok(rows)) => rows,
        Ok(Err(ReadHandlerFailure::ManagerUnavailable)) => {
            return api_error_response(ApiError::service_unavailable(
                &request.request_id,
                ApiOperation::ListMidis,
                "MIDI list is unavailable",
            ))
        }
        _ => {
            return api_error_response(ApiError::internal_error(
                &request.request_id,
                ApiOperation::ListMidis,
                "MIDI list is unavailable",
            ))
        }
    };
    let has_more = rows.len() > limit;
    rows.truncate(limit);
    Json(ListMidisResponse {
        request_id: request.request_id,
        operation: ApiOperation::ListMidis,
        results: rows.into_iter().map(MidiSummary::from).collect(),
        limit: response_limit,
        offset: response_offset,
        has_more,
    })
    .into_response()
}

pub(crate) async fn list_midi_tags_handler(
    State(state): State<ReadHandlerState>,
    request: Request<Body>,
) -> Response {
    let request =
        match parse_typed_request::<ListMidiTagsRequest>(request, ApiOperation::ListMidiTags).await
        {
            Ok(r) => r,
            Err(response) => return response,
        };
    let manager = Arc::clone(&state.manager);
    let result = tokio::task::spawn_blocking(move || {
        let manager = manager
            .lock()
            .map_err(|_| ReadHandlerFailure::ManagerUnavailable)?;
        manager
            .get_all_midi_tags()
            .map_err(|_| ReadHandlerFailure::OperationFailed)
    })
    .await;
    match result {
        Ok(Ok(tags)) => Json(ListMidiTagsResponse {
            request_id: request.request_id,
            operation: ApiOperation::ListMidiTags,
            tags: tags
                .into_iter()
                .map(|tag| MidiTagSummary {
                    id: tag.id,
                    name: tag.name,
                    created_at: tag.created_at,
                })
                .collect(),
        })
        .into_response(),
        Ok(Err(ReadHandlerFailure::ManagerUnavailable)) => {
            api_error_response(ApiError::service_unavailable(
                &request.request_id,
                ApiOperation::ListMidiTags,
                "MIDI tags are unavailable",
            ))
        }
        _ => api_error_response(ApiError::internal_error(
            &request.request_id,
            ApiOperation::ListMidiTags,
            "MIDI tags are unavailable",
        )),
    }
}

use super::{
    parsing::parse_typed_request,
    response::{api_error_response, similarity_error_response},
    search_query::compose_search_query,
    state::{ReadHandlerFailure, ReadHandlerState, SimilarityTaskFailure},
};

pub(crate) async fn search_samples_handler(
    State(state): State<ReadHandlerState>,
    request: Request<Body>,
) -> Response {
    let request =
        match parse_typed_request::<SearchSamplesRequest>(request, ApiOperation::SearchSamples)
            .await
        {
            Ok(request) => request,
            Err(response) => return response,
        };
    let query = match compose_search_query(&request.payload, &request.request_id) {
        Ok(query) => query,
        Err(error) => return api_error_response(error),
    };
    let response_limit = request.payload.limit.unwrap_or(100);
    let response_offset = request.payload.offset.unwrap_or(0);
    let limit = match usize::try_from(response_limit) {
        Ok(limit) => limit,
        Err(_) => {
            return api_error_response(ApiError::internal_error(
                &request.request_id,
                ApiOperation::SearchSamples,
                "sample search is unavailable",
            ));
        }
    };
    let offset = match usize::try_from(response_offset) {
        Ok(offset) => offset,
        Err(_) => {
            return api_error_response(ApiError::internal_error(
                &request.request_id,
                ApiOperation::SearchSamples,
                "sample search is unavailable",
            ));
        }
    };
    let manager = Arc::clone(&state.manager);
    let directory_path = request.payload.directory_path;
    let result = tokio::task::spawn_blocking(move || {
        let manager = manager
            .lock()
            .map_err(|_| ReadHandlerFailure::ManagerUnavailable)?;
        let fetch_limit = limit.saturating_add(1);
        manager
            .search_paginated(&query, fetch_limit, offset, directory_path.as_deref())
            .map_err(|_| ReadHandlerFailure::OperationFailed)
    })
    .await;

    let mut rows = match result {
        Ok(Ok(rows)) => rows,
        Ok(Err(ReadHandlerFailure::ManagerUnavailable)) => {
            return api_error_response(ApiError::service_unavailable(
                &request.request_id,
                ApiOperation::SearchSamples,
                "sample search is unavailable",
            ));
        }
        Ok(Err(ReadHandlerFailure::OperationFailed)) | Err(_) => {
            return api_error_response(ApiError::internal_error(
                &request.request_id,
                ApiOperation::SearchSamples,
                "sample search is unavailable",
            ));
        }
    };
    let has_more = rows.len() > limit;
    rows.truncate(limit);

    Json(SearchSamplesResponse {
        request_id: request.request_id,
        operation: ApiOperation::SearchSamples,
        results: rows.into_iter().map(SampleSummary::from).collect(),
        limit: response_limit,
        offset: response_offset,
        has_more,
    })
    .into_response()
}

pub(crate) async fn get_sample_handler(
    State(state): State<ReadHandlerState>,
    request: Request<Body>,
) -> Response {
    let request =
        match parse_typed_request::<GetSampleRequest>(request, ApiOperation::GetSample).await {
            Ok(request) => request,
            Err(response) => return response,
        };
    let manager = Arc::clone(&state.manager);
    let sample_id = request.payload.sample_id;
    let result = tokio::task::spawn_blocking(move || {
        let manager = manager
            .lock()
            .map_err(|_| ReadHandlerFailure::ManagerUnavailable)?;
        manager
            .get_sample_by_id(sample_id)
            .map_err(|_| ReadHandlerFailure::OperationFailed)
    })
    .await;

    let sample = match result {
        Ok(Ok(Some(sample))) => sample,
        Ok(Ok(None)) => {
            return api_error_response(ApiError::not_found(
                &request.request_id,
                ApiOperation::GetSample,
                "sample was not found",
            ));
        }
        Ok(Err(ReadHandlerFailure::ManagerUnavailable)) => {
            return api_error_response(ApiError::service_unavailable(
                &request.request_id,
                ApiOperation::GetSample,
                "sample lookup is unavailable",
            ));
        }
        Ok(Err(ReadHandlerFailure::OperationFailed)) | Err(_) => {
            return api_error_response(ApiError::internal_error(
                &request.request_id,
                ApiOperation::GetSample,
                "sample lookup is unavailable",
            ));
        }
    };

    Json(GetSampleResponse {
        request_id: request.request_id,
        operation: ApiOperation::GetSample,
        sample: Some(SampleSummary::from(sample)),
    })
    .into_response()
}

pub(crate) async fn find_similar_samples_handler(
    State(state): State<ReadHandlerState>,
    request: Request<Body>,
) -> Response {
    let request = match parse_typed_request::<FindSimilarSamplesRequest>(
        request,
        ApiOperation::FindSimilarSamples,
    )
    .await
    {
        Ok(request) => request,
        Err(response) => return response,
    };
    let manager = Arc::clone(&state.manager);
    let sample_id = request.payload.sample_id;
    let limit = match usize::try_from(request.payload.limit) {
        Ok(limit) => limit,
        Err(_) => {
            return api_error_response(ApiError::internal_error(
                &request.request_id,
                ApiOperation::FindSimilarSamples,
                "similarity search is unavailable",
            ));
        }
    };
    let exclude_duplicates = request.payload.exclude_duplicates;
    let result = tokio::task::spawn_blocking(move || {
        let manager = manager
            .lock()
            .map_err(|_| SimilarityTaskFailure::ManagerUnavailable)?;
        manager
            .find_similar_samples(sample_id, limit, exclude_duplicates)
            .map_err(SimilarityTaskFailure::Similarity)
    })
    .await;

    let matches = match result {
        Ok(Ok(matches)) => matches,
        Ok(Err(SimilarityTaskFailure::Similarity(error))) => {
            return similarity_error_response(&request.request_id, error);
        }
        Ok(Err(SimilarityTaskFailure::ManagerUnavailable)) => {
            return api_error_response(ApiError::service_unavailable(
                &request.request_id,
                ApiOperation::FindSimilarSamples,
                "similarity search is unavailable",
            ));
        }
        Err(_) => {
            return api_error_response(ApiError::internal_error(
                &request.request_id,
                ApiOperation::FindSimilarSamples,
                "similarity search is unavailable",
            ));
        }
    };

    Json(FindSimilarSamplesResponse {
        request_id: request.request_id,
        operation: ApiOperation::FindSimilarSamples,
        source_id: sample_id,
        matches: matches
            .into_iter()
            .map(|result| SampleSimilarity {
                sample: SampleSummary::from(result.row),
                similarity: f64::from(result.similarity),
            })
            .collect(),
    })
    .into_response()
}
