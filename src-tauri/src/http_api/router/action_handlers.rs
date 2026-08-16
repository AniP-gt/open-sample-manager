use axum::{
    body::Body,
    extract::State,
    http::{Request, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use open_sample_manager_core::SampleManager;
use std::sync::Arc;

use crate::{
    external_commands::{EnqueueAfterError, UiCommand, UiCommandQueueError},
    http_api::contracts::{
        AddToCollectionRequest, AddToCollectionResponse, ApiError, ApiOperation,
        CreateInstrumentTypeRequest, CreateInstrumentTypeResponse, InstrumentTypeSummary,
        ListInstrumentTypesRequest, ListInstrumentTypesResponse, PreviewSampleRequest,
        PreviewSampleResponse, ShowSamplesInAppRequest, ShowSamplesInAppResponse,
        UpdateSampleInstrumentsRequest, UpdateSampleInstrumentsResponse,
    },
};

use super::{
    parsing::parse_typed_request,
    response::{action_error_response, api_error_response},
    state::{ActionTaskFailure, ReadHandlerState},
};

pub(crate) async fn show_samples_in_app_handler(
    State(state): State<ReadHandlerState>,
    request: Request<Body>,
) -> Response {
    let request = match parse_typed_request::<ShowSamplesInAppRequest>(
        request,
        ApiOperation::ShowSamplesInApp,
    )
    .await
    {
        Ok(request) => request,
        Err(response) => return response,
    };
    let selected_id = match request
        .payload
        .selected_id
        .or_else(|| request.payload.sample_ids.first().copied())
    {
        Some(selected_id) => selected_id,
        None => {
            return api_error_response(ApiError::invalid_request(
                &request.request_id,
                ApiOperation::ShowSamplesInApp,
                "sample_ids must have 1..=100 entries",
            ));
        }
    };
    let requested_count = request.payload.sample_ids.len();
    let sample_ids = request.payload.sample_ids;
    let manager = Arc::clone(&state.manager);
    let ui_commands = Arc::clone(&state.ui_commands);
    let result = tokio::task::spawn_blocking(move || {
        {
            let manager = manager
                .lock()
                .map_err(|_| ActionTaskFailure::ManagerUnavailable)?;
            validate_sample_ids(&manager, &sample_ids)?;
        }
        ui_commands
            .enqueue(UiCommand::ShowSamples {
                sample_ids,
                selected_id: Some(selected_id),
            })
            .map_err(|_| ActionTaskFailure::QueueFull)
    })
    .await;

    match result {
        Ok(Ok(())) => {
            let _ = (state.wake_callback)();
            (
                StatusCode::ACCEPTED,
                Json(ShowSamplesInAppResponse {
                    request_id: request.request_id,
                    operation: ApiOperation::ShowSamplesInApp,
                    requested_count,
                    accepted_count: requested_count,
                }),
            )
                .into_response()
        }
        Ok(Err(error)) => action_error_response(
            &request.request_id,
            ApiOperation::ShowSamplesInApp,
            error,
            "sample display is unavailable",
        ),
        Err(_) => api_error_response(ApiError::internal_error(
            &request.request_id,
            ApiOperation::ShowSamplesInApp,
            "sample display is unavailable",
        )),
    }
}

pub(crate) async fn list_instrument_types_handler(
    State(state): State<ReadHandlerState>,
    request: Request<Body>,
) -> Response {
    let request = match parse_typed_request::<ListInstrumentTypesRequest>(
        request,
        ApiOperation::ListInstrumentTypes,
    )
    .await
    {
        Ok(request) => request,
        Err(response) => return response,
    };
    let manager = Arc::clone(&state.manager);
    let result = tokio::task::spawn_blocking(move || {
        let manager = manager
            .lock()
            .map_err(|_| ActionTaskFailure::ManagerUnavailable)?;
        manager
            .get_all_instrument_types()
            .map_err(|_| ActionTaskFailure::OperationFailed)
    })
    .await;
    match result {
        Ok(Ok(rows)) => Json(ListInstrumentTypesResponse {
            request_id: request.request_id,
            operation: ApiOperation::ListInstrumentTypes,
            instrument_types: rows
                .into_iter()
                .map(|row| InstrumentTypeSummary {
                    id: row.id,
                    name: row.name,
                    created_at: row.created_at,
                })
                .collect(),
        })
        .into_response(),
        Ok(Err(error)) => action_error_response(
            &request.request_id,
            ApiOperation::ListInstrumentTypes,
            error,
            "instrument types are unavailable",
        ),
        Err(_) => api_error_response(ApiError::internal_error(
            &request.request_id,
            ApiOperation::ListInstrumentTypes,
            "instrument types are unavailable",
        )),
    }
}

pub(crate) async fn create_instrument_type_handler(
    State(state): State<ReadHandlerState>,
    request: Request<Body>,
) -> Response {
    let request = match parse_typed_request::<CreateInstrumentTypeRequest>(
        request,
        ApiOperation::CreateInstrumentType,
    )
    .await
    {
        Ok(request) => request,
        Err(response) => return response,
    };
    let name = request.payload.name.trim().to_owned();
    let name_for_write = name.clone();
    let manager = Arc::clone(&state.manager);
    let result = tokio::task::spawn_blocking(move || {
        let manager = manager
            .lock()
            .map_err(|_| ActionTaskFailure::ManagerUnavailable)?;
        let id = manager
            .add_instrument_type(&name_for_write)
            .map_err(|_| ActionTaskFailure::OperationFailed)?;
        let row = manager
            .get_all_instrument_types()
            .map_err(|_| ActionTaskFailure::OperationFailed)?
            .into_iter()
            .find(|row| row.id == id)
            .ok_or(ActionTaskFailure::OperationFailed)?;
        Ok::<_, ActionTaskFailure>(row)
    })
    .await;
    match result {
        Ok(Ok(row)) => (
            StatusCode::CREATED,
            Json(CreateInstrumentTypeResponse {
                request_id: request.request_id,
                operation: ApiOperation::CreateInstrumentType,
                instrument_type: InstrumentTypeSummary {
                    id: row.id,
                    name: row.name,
                    created_at: row.created_at,
                },
            }),
        )
            .into_response(),
        Ok(Err(error)) => action_error_response(
            &request.request_id,
            ApiOperation::CreateInstrumentType,
            error,
            "instrument type creation is unavailable",
        ),
        Err(_) => api_error_response(ApiError::internal_error(
            &request.request_id,
            ApiOperation::CreateInstrumentType,
            "instrument type creation is unavailable",
        )),
    }
}

pub(crate) async fn update_sample_instruments_handler(
    State(state): State<ReadHandlerState>,
    request: Request<Body>,
) -> Response {
    let request = match parse_typed_request::<UpdateSampleInstrumentsRequest>(
        request,
        ApiOperation::UpdateSampleInstruments,
    )
    .await
    {
        Ok(request) => request,
        Err(response) => return response,
    };
    let requested_count = request.payload.assignments.len();
    let assignments = request
        .payload
        .assignments
        .into_iter()
        .map(|assignment| {
            (
                assignment.sample_id,
                assignment.instrument_type.trim().to_owned(),
            )
        })
        .collect::<Vec<_>>();
    let manager = Arc::clone(&state.manager);
    let result = tokio::task::spawn_blocking(move || {
        let mut manager = manager
            .lock()
            .map_err(|_| ActionTaskFailure::ManagerUnavailable)?;
        manager
            .update_sample_instrument_types(&assignments)
            .map_err(|_| ActionTaskFailure::OperationFailed)
    })
    .await;
    match result {
        Ok(Ok(updated_count)) => Json(UpdateSampleInstrumentsResponse {
            request_id: request.request_id,
            operation: ApiOperation::UpdateSampleInstruments,
            requested_count,
            updated_count,
        })
        .into_response(),
        Ok(Err(error)) => action_error_response(
            &request.request_id,
            ApiOperation::UpdateSampleInstruments,
            error,
            "sample instrument update is unavailable",
        ),
        Err(_) => api_error_response(ApiError::internal_error(
            &request.request_id,
            ApiOperation::UpdateSampleInstruments,
            "sample instrument update is unavailable",
        )),
    }
}

pub(crate) async fn preview_sample_handler(
    State(state): State<ReadHandlerState>,
    request: Request<Body>,
) -> Response {
    let request =
        match parse_typed_request::<PreviewSampleRequest>(request, ApiOperation::PreviewSample)
            .await
        {
            Ok(request) => request,
            Err(response) => return response,
        };
    let sample_id = request.payload.sample_id;
    let manager = Arc::clone(&state.manager);
    let ui_commands = Arc::clone(&state.ui_commands);
    let result = tokio::task::spawn_blocking(move || {
        {
            let manager = manager
                .lock()
                .map_err(|_| ActionTaskFailure::ManagerUnavailable)?;
            validate_sample_ids(&manager, &[sample_id])?;
        }
        ui_commands
            .enqueue(UiCommand::PreviewSample { sample_id })
            .map_err(|_| ActionTaskFailure::QueueFull)
    })
    .await;

    match result {
        Ok(Ok(())) => {
            let _ = (state.wake_callback)();
            (
                StatusCode::ACCEPTED,
                Json(PreviewSampleResponse {
                    request_id: request.request_id,
                    operation: ApiOperation::PreviewSample,
                    accepted: true,
                }),
            )
                .into_response()
        }
        Ok(Err(error)) => action_error_response(
            &request.request_id,
            ApiOperation::PreviewSample,
            error,
            "sample preview is unavailable",
        ),
        Err(_) => api_error_response(ApiError::internal_error(
            &request.request_id,
            ApiOperation::PreviewSample,
            "sample preview is unavailable",
        )),
    }
}

pub(crate) async fn add_to_collection_handler(
    State(state): State<ReadHandlerState>,
    request: Request<Body>,
) -> Response {
    let request =
        match parse_typed_request::<AddToCollectionRequest>(request, ApiOperation::AddToCollection)
            .await
        {
            Ok(request) => request,
            Err(response) => return response,
        };
    let requested_count = request.payload.sample_ids.len();
    let collection_name = request.payload.collection_name;
    let collection_name_for_write = collection_name.clone();
    let sample_ids = request.payload.sample_ids;
    let manager = Arc::clone(&state.manager);
    let ui_commands = Arc::clone(&state.ui_commands);
    let result = tokio::task::spawn_blocking(move || {
        {
            let manager = manager
                .lock()
                .map_err(|_| ActionTaskFailure::ManagerUnavailable)?;
            validate_sample_ids(&manager, &sample_ids)?;
        }
        ui_commands
            .enqueue_after(UiCommand::CollectionsChanged, || {
                let mut manager = manager
                    .lock()
                    .map_err(|_| ActionTaskFailure::ManagerUnavailable)?;
                manager
                    .add_samples_to_collection(&collection_name_for_write, &sample_ids)
                    .map_err(|_| ActionTaskFailure::OperationFailed)
            })
            .map_err(|error| match error {
                EnqueueAfterError::Queue(UiCommandQueueError::QueueFull { .. }) => {
                    ActionTaskFailure::QueueFull
                }
                EnqueueAfterError::Operation(error) => error,
            })
    })
    .await;

    match result {
        Ok(Ok(result)) => {
            let _ = (state.wake_callback)();
            (
                StatusCode::ACCEPTED,
                Json(AddToCollectionResponse {
                    request_id: request.request_id,
                    operation: ApiOperation::AddToCollection,
                    collection_name,
                    requested_count,
                    added_count: result.added_count,
                    created: result.created,
                }),
            )
                .into_response()
        }
        Ok(Err(error)) => action_error_response(
            &request.request_id,
            ApiOperation::AddToCollection,
            error,
            "collection update is unavailable",
        ),
        Err(_) => api_error_response(ApiError::internal_error(
            &request.request_id,
            ApiOperation::AddToCollection,
            "collection update is unavailable",
        )),
    }
}

fn validate_sample_ids(
    manager: &SampleManager,
    sample_ids: &[i64],
) -> Result<(), ActionTaskFailure> {
    for &sample_id in sample_ids {
        match manager.get_sample_by_id(sample_id) {
            Ok(Some(_)) => {}
            Ok(None) => return Err(ActionTaskFailure::NotFound),
            Err(_) => return Err(ActionTaskFailure::OperationFailed),
        }
    }
    Ok(())
}
