mod action_handlers;
mod parsing;
mod read_handlers;
mod response;
mod search_query;
mod security;
mod state;

use axum::{middleware::from_fn, routing::post, Router};
use open_sample_manager_core::SampleManager;
use std::sync::{Arc, Mutex};

#[cfg(test)]
use super::contracts::ApiOperation;
use super::external_commands::UiCommandQueue;
use action_handlers::{
    add_to_collection_handler, create_instrument_type_handler, create_midi_tag_handler,
    list_instrument_types_handler, preview_sample_handler, show_samples_in_app_handler,
    update_midi_tags_handler, update_sample_instruments_handler,
};
use read_handlers::{
    find_similar_samples_handler, get_sample_handler, list_midi_tags_handler, list_midis_handler,
    search_samples_handler,
};
use response::fallback;
use security::enforce_http_api_security;
use state::ReadHandlerState;

pub const LOCALHOST_API_HOST: &str = "127.0.0.1:37421";
pub const MAX_JSON_BODY_BYTES: usize = 64 * 1024;
pub type UiCommandWakeCallback = Arc<dyn Fn() -> bool + Send + Sync + 'static>;

#[cfg(test)]
fn no_wake_callback() -> UiCommandWakeCallback {
    Arc::new(|| false)
}

#[cfg(test)]
pub fn build_router(token: impl Into<String>) -> Router<()> {
    let token = token.into();

    Router::new()
        .route(
            "/v1/search_samples",
            post(|request| async move {
                parsing::route_stub_handler(request, ApiOperation::SearchSamples).await
            }),
        )
        .route(
            "/v1/get_sample",
            post(|request| async move {
                parsing::route_stub_handler(request, ApiOperation::GetSample).await
            }),
        )
        .route(
            "/v1/find_similar_samples",
            post(|request| async move {
                parsing::route_stub_handler(request, ApiOperation::FindSimilarSamples).await
            }),
        )
        .route(
            "/v1/show_samples_in_app",
            post(|request| async move {
                parsing::route_stub_handler(request, ApiOperation::ShowSamplesInApp).await
            }),
        )
        .route(
            "/v1/preview_sample",
            post(|request| async move {
                parsing::route_stub_handler(request, ApiOperation::PreviewSample).await
            }),
        )
        .route(
            "/v1/add_to_collection",
            post(|request| async move {
                parsing::route_stub_handler(request, ApiOperation::AddToCollection).await
            }),
        )
        .route(
            "/v1/list_instrument_types",
            post(|request| async move {
                parsing::route_stub_handler(request, ApiOperation::ListInstrumentTypes).await
            }),
        )
        .route(
            "/v1/create_instrument_type",
            post(|request| async move {
                parsing::route_stub_handler(request, ApiOperation::CreateInstrumentType).await
            }),
        )
        .route(
            "/v1/update_sample_instruments",
            post(|request| async move {
                parsing::route_stub_handler(request, ApiOperation::UpdateSampleInstruments).await
            }),
        )
        .route(
            "/v1/list_midis",
            post(|request| async move {
                parsing::route_stub_handler(request, ApiOperation::ListMidis).await
            }),
        )
        .route(
            "/v1/list_midi_tags",
            post(|request| async move {
                parsing::route_stub_handler(request, ApiOperation::ListMidiTags).await
            }),
        )
        .route(
            "/v1/create_midi_tag",
            post(|request| async move {
                parsing::route_stub_handler(request, ApiOperation::CreateMidiTag).await
            }),
        )
        .route(
            "/v1/update_midi_tags",
            post(|request| async move {
                parsing::route_stub_handler(request, ApiOperation::UpdateMidiTags).await
            }),
        )
        .fallback(fallback)
        .layer(from_fn(move |request, next| {
            enforce_http_api_security(request, next, token.clone())
        }))
}

#[cfg(test)]
pub fn build_router_with_manager(
    token: impl Into<String>,
    manager: Arc<Mutex<SampleManager>>,
) -> Router<()> {
    build_router_with_manager_and_queue(token, manager, Arc::new(UiCommandQueue::with_capacity(64)))
}

#[cfg(test)]
pub fn build_router_with_manager_and_queue(
    token: impl Into<String>,
    manager: Arc<Mutex<SampleManager>>,
    ui_commands: Arc<UiCommandQueue>,
) -> Router<()> {
    build_router_with_manager_and_queue_with_wake_callback(
        token,
        manager,
        ui_commands,
        no_wake_callback(),
    )
}

pub fn build_router_with_manager_and_queue_with_wake_callback(
    token: impl Into<String>,
    manager: Arc<Mutex<SampleManager>>,
    ui_commands: Arc<UiCommandQueue>,
    wake_callback: UiCommandWakeCallback,
) -> Router<()> {
    let token = token.into();
    let state = ReadHandlerState::new_with_wake_callback(manager, ui_commands, wake_callback);

    build_manager_router(token, state)
}

fn build_manager_router(token: String, state: ReadHandlerState) -> Router<()> {
    Router::new()
        .route("/v1/search_samples", post(search_samples_handler))
        .route("/v1/get_sample", post(get_sample_handler))
        .route(
            "/v1/find_similar_samples",
            post(find_similar_samples_handler),
        )
        .route("/v1/show_samples_in_app", post(show_samples_in_app_handler))
        .route("/v1/preview_sample", post(preview_sample_handler))
        .route("/v1/add_to_collection", post(add_to_collection_handler))
        .route(
            "/v1/list_instrument_types",
            post(list_instrument_types_handler),
        )
        .route(
            "/v1/create_instrument_type",
            post(create_instrument_type_handler),
        )
        .route(
            "/v1/update_sample_instruments",
            post(update_sample_instruments_handler),
        )
        .route("/v1/list_midis", post(list_midis_handler))
        .route("/v1/list_midi_tags", post(list_midi_tags_handler))
        .route("/v1/create_midi_tag", post(create_midi_tag_handler))
        .route("/v1/update_midi_tags", post(update_midi_tags_handler))
        .fallback(fallback)
        .layer(from_fn(move |request, next| {
            enforce_http_api_security(request, next, token.clone())
        }))
        .with_state(state)
}
