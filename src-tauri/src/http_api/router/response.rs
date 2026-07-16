use axum::{
    body::Body,
    http::{Method, Request, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use open_sample_manager_core::SimilarityError;

use crate::http_api::contracts::{ApiError, ApiOperation};

use super::state::ActionTaskFailure;

pub(crate) fn action_error_response(
    request_id: &str,
    operation: ApiOperation,
    error: ActionTaskFailure,
    unavailable_message: &'static str,
) -> Response {
    let error = match error {
        ActionTaskFailure::ManagerUnavailable | ActionTaskFailure::QueueFull => {
            ApiError::service_unavailable(request_id, operation, unavailable_message)
        }
        ActionTaskFailure::NotFound => {
            ApiError::not_found(request_id, operation, "sample was not found")
        }
        ActionTaskFailure::OperationFailed => {
            ApiError::internal_error(request_id, operation, unavailable_message)
        }
    };
    api_error_response(error)
}

pub(crate) fn similarity_error_response(request_id: &str, error: SimilarityError) -> Response {
    let error = match error {
        SimilarityError::NotFound(_) => ApiError::not_found(
            request_id,
            ApiOperation::FindSimilarSamples,
            "sample was not found",
        ),
        SimilarityError::MissingEmbedding(_) | SimilarityError::MalformedEmbedding(_) => {
            ApiError::duplicate(
                request_id,
                ApiOperation::FindSimilarSamples,
                "sample has no usable embedding",
            )
        }
        SimilarityError::InvalidLimit(_) => ApiError::invalid_request(
            request_id,
            ApiOperation::FindSimilarSamples,
            "limit must be within 1..=100",
        ),
        SimilarityError::Db(_) => ApiError::internal_error(
            request_id,
            ApiOperation::FindSimilarSamples,
            "similarity search is unavailable",
        ),
    };
    api_error_response(error)
}

pub(crate) async fn fallback(request: Request<Body>) -> Response {
    let status = if request.method() == Method::OPTIONS {
        ApiError::invalid_request(
            "unknown",
            ApiOperation::SearchSamples,
            "OPTIONS is not supported",
        )
    } else {
        ApiError::not_found("unknown", ApiOperation::SearchSamples, "route not found")
    };

    api_error_response(status)
}

pub(crate) fn operation_for_path(path: &str) -> ApiOperation {
    match path {
        "/v1/search_samples" => ApiOperation::SearchSamples,
        "/v1/get_sample" => ApiOperation::GetSample,
        "/v1/find_similar_samples" => ApiOperation::FindSimilarSamples,
        "/v1/show_samples_in_app" => ApiOperation::ShowSamplesInApp,
        "/v1/preview_sample" => ApiOperation::PreviewSample,
        "/v1/add_to_collection" => ApiOperation::AddToCollection,
        _ => ApiOperation::SearchSamples,
    }
}

pub(crate) fn api_error_response(error: ApiError) -> Response {
    let status = StatusCode::from_u16(error.status()).unwrap_or(StatusCode::INTERNAL_SERVER_ERROR);
    api_error_response_with_status(error, status)
}

pub(crate) fn api_error_response_with_status(error: ApiError, status: StatusCode) -> Response {
    (status, Json(error)).into_response()
}
