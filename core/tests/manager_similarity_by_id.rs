use open_sample_manager_core::{
    db::operations::{insert_sample, SampleInput},
    SampleManager, SimilarityError,
};
use rusqlite::Connection;
use tempfile::TempDir;

fn setup_similarity_manager() -> (TempDir, SampleManager, Connection) {
    let directory = TempDir::new().expect("tempdir");
    let database_path = directory.path().join("similarity.db");
    let manager = SampleManager::new(Some(database_path.to_str().expect("UTF-8 database path")))
        .expect("manager");
    let connection = Connection::open(database_path).expect("shared connection");
    (directory, manager, connection)
}

fn sample_input(path: &str, embedding: Option<Vec<u8>>) -> SampleInput {
    SampleInput {
        path: path.to_string(),
        file_name: path.to_string(),
        duration: None,
        bpm: None,
        periodicity: None,
        sample_rate: None,
        file_size: None,
        artist: None,
        low_ratio: None,
        sample_type: None,
        waveform_peaks: None,
        attack_slope: None,
        decay_time: None,
        embedding,
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
        playback_type: None,
        instrument_type: None,
        musical_key: None,
        content_hash: None,
    }
}

fn insert_similarity_sample(connection: &Connection, embedding: Option<Vec<u8>>) -> i64 {
    insert_sample(connection, &sample_input("/samples/source.wav", embedding))
        .expect("insert sample")
}

fn encode_embedding(values: [f32; 3]) -> Vec<u8> {
    values.into_iter().flat_map(f32::to_le_bytes).collect()
}

#[test]
fn manager_get_sample_by_id_returns_none_for_missing_row() {
    // Given: an empty in-memory manager.
    let manager = SampleManager::new(None).expect("manager");

    // When: a missing row is requested by ID.
    let sample = manager.get_sample_by_id(42).expect("lookup");

    // Then: the facade returns no row instead of a database error.
    assert!(sample.is_none());
}

#[test]
fn manager_similarity_by_id_returns_not_found_for_missing_source() {
    // Given: an empty in-memory manager.
    let manager = SampleManager::new(None).expect("manager");

    // When: similarity is requested for an absent source id.
    let error = manager
        .find_similar_samples(42, 1, false)
        .expect_err("missing source should fail");

    // Then: the caller receives the typed not-found error.
    assert!(matches!(error, SimilarityError::NotFound(42)));
}

#[test]
fn manager_similarity_by_id_validates_missing_source_before_zero_limit() {
    // Given: an empty in-memory manager.
    let manager = SampleManager::new(None).expect("manager");

    // When: zero-limit similarity is requested for a missing source.
    let error = manager
        .find_similar_samples(42, 0, false)
        .expect_err("missing source should fail");

    // Then: source validation takes precedence over the invalid limit.
    assert!(matches!(error, SimilarityError::NotFound(42)));
}

#[test]
fn manager_similarity_by_id_validates_missing_embedding_before_zero_limit() {
    // Given: a source with no embedding.
    let (_directory, manager, connection) = setup_similarity_manager();
    let source_id = insert_similarity_sample(&connection, None);

    // When: zero-limit similarity is requested.
    let error = manager
        .find_similar_samples(source_id, 0, false)
        .expect_err("missing embedding should fail");

    // Then: embedding validation takes precedence over the invalid limit.
    assert!(matches!(error, SimilarityError::MissingEmbedding(id) if id == source_id));
}

#[test]
fn manager_similarity_by_id_validates_malformed_embedding_before_zero_limit() {
    // Given: a source with a malformed embedding.
    let (_directory, manager, connection) = setup_similarity_manager();
    let source_id = insert_similarity_sample(&connection, Some(vec![1, 2, 3]));

    // When: zero-limit similarity is requested.
    let error = manager
        .find_similar_samples(source_id, 0, false)
        .expect_err("malformed embedding should fail");

    // Then: malformed data takes precedence over the invalid limit.
    assert!(matches!(error, SimilarityError::MalformedEmbedding(id) if id == source_id));
}

#[test]
fn manager_similarity_by_id_rejects_zero_limit_after_validating_source_embedding() {
    // Given: a source with a valid embedding.
    let (_directory, manager, connection) = setup_similarity_manager();
    let source_id = insert_similarity_sample(&connection, Some(encode_embedding([1.0, 0.0, 0.0])));

    // When: zero-limit similarity is requested.
    let error = manager
        .find_similar_samples(source_id, 0, false)
        .expect_err("zero limit should fail");

    // Then: the public 1..=100 limit policy is enforced.
    assert!(matches!(error, SimilarityError::InvalidLimit(0)));
}

#[test]
fn manager_similarity_by_id_rejects_limit_above_one_hundred() {
    // Given: a source with a valid embedding.
    let (_directory, manager, connection) = setup_similarity_manager();
    let source_id = insert_similarity_sample(&connection, Some(encode_embedding([1.0, 0.0, 0.0])));

    // When: more than one hundred results are requested.
    let error = manager
        .find_similar_samples(source_id, 101, false)
        .expect_err("limit above one hundred should fail");

    // Then: the public maximum is enforced.
    assert!(matches!(error, SimilarityError::InvalidLimit(101)));
}
