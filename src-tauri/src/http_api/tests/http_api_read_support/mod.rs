use std::sync::{Arc, Mutex};

use super::http_api_support::external_commands::UiCommandQueue;
use super::http_api_support::router::UiCommandWakeCallback;
use axum::{
    body::{to_bytes, Body},
    http::{Method, Request, StatusCode},
};
use open_sample_manager_core::{
    db::operations::{insert_sample, SampleInput},
    SampleManager,
};
use rusqlite::Connection;
use serde_json::Value;
use tempfile::TempDir;
use tower::ServiceExt;

use super::http_api_support::{format_auth, request_with, router, LOCAL_HOST, TOKEN};

pub struct SeededRouter {
    _database_directory: TempDir,
    pub app: axum::Router,
    pub manager: Arc<Mutex<SampleManager>>,
    pub queue: Arc<UiCommandQueue>,
    pub source_id: i64,
    pub duplicate_id: i64,
    pub matching_id: i64,
    pub no_embedding_id: i64,
}

pub fn seeded_router() -> SeededRouter {
    seeded_router_with_queue_capacity(64)
}

pub fn seeded_router_with_queue_capacity(queue_capacity: usize) -> SeededRouter {
    seeded_router_with_queue_capacity_and_wake_callback(
        queue_capacity,
        std::sync::Arc::new(|| false),
    )
}

pub fn seeded_router_with_queue_capacity_and_wake_callback(
    queue_capacity: usize,
    wake_callback: UiCommandWakeCallback,
) -> SeededRouter {
    let database_directory = TempDir::new().expect("temporary database directory");
    let database_path = database_directory.path().join("samples.db");
    let manager = SampleManager::new(Some(database_path.to_str().expect("UTF-8 database path")))
        .expect("sample manager");
    let connection = Connection::open(database_path).expect("seeding connection");
    let source_id = insert(&connection, SampleSeed::source());
    let duplicate_id = insert(&connection, SampleSeed::duplicate());
    let matching_id = insert(&connection, SampleSeed::matching());
    let no_embedding_id = insert(&connection, SampleSeed::without_embedding());
    let manager = Arc::new(Mutex::new(manager));
    let queue = Arc::new(UiCommandQueue::with_capacity(queue_capacity));
    let app = router::build_router_with_manager_and_queue_with_wake_callback(
        TOKEN,
        Arc::clone(&manager),
        Arc::clone(&queue),
        wake_callback,
    );

    SeededRouter {
        _database_directory: database_directory,
        app,
        manager,
        queue,
        source_id,
        duplicate_id,
        matching_id,
        no_embedding_id,
    }
}

pub fn in_memory_router() -> axum::Router {
    let manager = SampleManager::new(None).expect("in-memory manager");
    router::build_router_with_manager(TOKEN, Arc::new(Mutex::new(manager)))
}

pub fn request(path: &str, body: Value) -> Request<Body> {
    request_with(
        Method::POST,
        path,
        Some(format_auth(TOKEN)),
        Some(LOCAL_HOST),
        Some(body.to_string()),
        Some("application/json"),
        None,
    )
}

pub fn call(app: &axum::Router, request: Request<Body>) -> (StatusCode, Value) {
    let runtime = tokio::runtime::Builder::new_current_thread()
        .enable_all()
        .build()
        .expect("test runtime");
    runtime.block_on(async {
        let response = app.clone().oneshot(request).await.expect("router response");
        let status = response.status();
        let body = to_bytes(response.into_body(), 64 * 1024)
            .await
            .expect("response body");
        (
            status,
            serde_json::from_slice(&body).expect("JSON response"),
        )
    })
}

struct SampleSeed {
    path: &'static str,
    file_name: &'static str,
    instrument: &'static str,
    key: &'static str,
    tags: &'static [&'static str],
    content_hash: Option<&'static str>,
    embedding: Option<Vec<u8>>,
}

impl SampleSeed {
    fn source() -> Self {
        Self::new(
            "/library/kick-source.wav",
            "kick source.wav",
            "kick",
            "C",
            &["drums", "metal"],
            Some("same-content"),
            Some(vector([1.0, 0.0, 0.0])),
        )
    }
    fn duplicate() -> Self {
        Self::new(
            "/library/kick-duplicate.wav",
            "kick duplicate.wav",
            "kick",
            "C",
            &["drums", "metal"],
            Some("same-content"),
            Some(vector([0.99, 0.01, 0.0])),
        )
    }
    fn matching() -> Self {
        Self::new(
            "/library/kick-match.wav",
            "kick match.wav",
            "kick",
            "C",
            &["drums", "metal"],
            Some("different-content"),
            Some(vector([0.8, 0.6, 0.0])),
        )
    }
    fn without_embedding() -> Self {
        Self::new(
            "/library/snare.wav",
            "snare.wav",
            "snare",
            "D",
            &["drums"],
            None,
            None,
        )
    }
    fn new(
        path: &'static str,
        file_name: &'static str,
        instrument: &'static str,
        key: &'static str,
        tags: &'static [&'static str],
        content_hash: Option<&'static str>,
        embedding: Option<Vec<u8>>,
    ) -> Self {
        Self {
            path,
            file_name,
            instrument,
            key,
            tags,
            content_hash,
            embedding,
        }
    }
}

fn insert(connection: &Connection, seed: SampleSeed) -> i64 {
    let sample_id = insert_sample(
        connection,
        &SampleInput {
            path: seed.path.to_owned(),
            file_name: seed.file_name.to_owned(),
            duration: Some(1.0),
            bpm: Some(128.0),
            periodicity: Some(0.8),
            sample_rate: Some(44_100),
            file_size: Some(512),
            artist: Some("Test Artist".to_owned()),
            low_ratio: Some(0.6),
            sample_type: Some("oneshot".to_owned()),
            waveform_peaks: Some("[0.2,0.4]".to_owned()),
            attack_slope: Some(1.0),
            decay_time: Some(50.0),
            embedding: seed.embedding,
            source: None,
            pack_name: None,
            license: None,
            license_url: None,
            license_memo: None,
            imported_at: None,
            peak_db: None,
            rms_db: None,
            leading_silence_ms: None,
            clipping_count: None,
            channel_count: None,
            bit_depth: None,
            quality_flags: None,
            playback_type: Some("oneshot".to_owned()),
            instrument_type: Some(seed.instrument.to_owned()),
            musical_key: Some(seed.key.to_owned()),
            content_hash: seed.content_hash.map(str::to_owned),
        },
    )
    .expect("seed sample");
    for tag in seed.tags {
        connection
            .execute(
                "INSERT INTO tags (name) VALUES (?1) ON CONFLICT(name) DO NOTHING",
                [tag],
            )
            .expect("seed tag");
        connection.execute("INSERT INTO sample_tags (sample_id, tag_id) SELECT ?1, id FROM tags WHERE name = ?2", rusqlite::params![sample_id, tag]).expect("assign tag");
    }
    sample_id
}

fn vector(values: [f32; 3]) -> Vec<u8> {
    values.into_iter().flat_map(f32::to_le_bytes).collect()
}
