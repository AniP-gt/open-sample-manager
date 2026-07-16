use crate::http_api::contracts::{
    AddToCollectionRequest, AddToCollectionResponse, ApiError, ApiRequest,
    FindSimilarSamplesRequest, FindSimilarSamplesResponse, GetSampleRequest, GetSampleResponse,
    PreviewSampleRequest, PreviewSampleResponse, SampleSimilarity, SampleSummary,
    SearchSamplesRequest, SearchSamplesResponse, ShowSamplesInAppRequest, ShowSamplesInAppResponse,
};
use std::{fs, path::PathBuf};

fn fixture_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("contracts/localhost-api-mcp/fixtures")
}

fn fixture(relative: &str) -> String {
    fs::read_to_string(fixture_root().join(relative)).expect("fixture should be readable")
}

fn assert_snapshot<T>(raw: &str)
where
    T: serde::de::DeserializeOwned + serde::Serialize,
{
    let parsed = serde_json::from_str::<T>(raw).expect("fixture should parse through the DTO");
    assert_eq!(
        serde_json::to_value(parsed).expect("DTO should serialize"),
        serde_json::from_str::<serde_json::Value>(raw).expect("fixture should be JSON")
    );
}

#[test]
fn local_api_contract_parses_and_validates_every_request_fixture() {
    let search = serde_json::from_str::<ApiRequest<SearchSamplesRequest>>(&fixture(
        "requests/search_samples.json",
    ))
    .expect("search request should parse");
    search
        .payload
        .validate(&search.request_id)
        .expect("search request should validate");
    let get =
        serde_json::from_str::<ApiRequest<GetSampleRequest>>(&fixture("requests/get_sample.json"))
            .expect("get request should parse");
    get.payload
        .validate(&get.request_id)
        .expect("get request should validate");
    let similar = serde_json::from_str::<ApiRequest<FindSimilarSamplesRequest>>(&fixture(
        "requests/find_similar_samples.json",
    ))
    .expect("similar request should parse");
    similar
        .payload
        .validate(&similar.request_id)
        .expect("similar request should validate");
    let show = serde_json::from_str::<ApiRequest<ShowSamplesInAppRequest>>(&fixture(
        "requests/show_samples_in_app.json",
    ))
    .expect("show request should parse");
    show.payload
        .validate(&show.request_id)
        .expect("show request should validate");
    let preview = serde_json::from_str::<ApiRequest<PreviewSampleRequest>>(&fixture(
        "requests/preview_sample.json",
    ))
    .expect("preview request should parse");
    preview
        .payload
        .validate(&preview.request_id)
        .expect("preview request should validate");
    let add = serde_json::from_str::<ApiRequest<AddToCollectionRequest>>(&fixture(
        "requests/add_to_collection.json",
    ))
    .expect("collection request should parse");
    add.payload
        .validate(&add.request_id)
        .expect("collection request should validate");
}

#[test]
fn local_api_contract_snapshots_every_response_and_error_fixture() {
    assert_snapshot::<SearchSamplesResponse>(&fixture("responses/search_samples.json"));
    assert_snapshot::<GetSampleResponse>(&fixture("responses/get_sample.json"));
    assert_snapshot::<FindSimilarSamplesResponse>(&fixture("responses/find_similar_samples.json"));
    assert_snapshot::<ShowSamplesInAppResponse>(&fixture("responses/show_samples_in_app.json"));
    assert_snapshot::<PreviewSampleResponse>(&fixture("responses/preview_sample.json"));
    assert_snapshot::<AddToCollectionResponse>(&fixture("responses/add_to_collection.json"));
    for path in [
        "errors/invalid_request_limit_0.json",
        "errors/unauthorized.json",
        "errors/forbidden.json",
        "errors/not_found.json",
        "errors/duplicate_ids.json",
        "errors/payload_too_large.json",
        "errors/service_unavailable.json",
        "errors/internal_error.json",
    ] {
        assert_snapshot::<ApiError>(&fixture(path));
    }
}

#[test]
fn local_api_contract_redacts_embeddings_waveforms_and_tokens() {
    let get = serde_json::from_str::<GetSampleResponse>(&fixture("responses/get_sample.json"))
        .expect("get response should parse");
    let sample: &SampleSummary = get.sample.as_ref().expect("fixture includes a sample");
    assert_redacted(&serde_json::to_string(sample).expect("sample should serialize"));
    let similar = serde_json::from_str::<FindSimilarSamplesResponse>(&fixture(
        "responses/find_similar_samples.json",
    ))
    .expect("similar response should parse");
    for sample in &similar.matches {
        let similarity: &SampleSimilarity = sample;
        assert_redacted(&serde_json::to_string(similarity).expect("similarity should serialize"));
    }
}

#[test]
fn local_api_contract_has_no_sensitive_payload_in_checked_in_fixtures() {
    let mut fixture_paths = vec![fixture_root()];
    while let Some(path) = fixture_paths.pop() {
        for entry in fs::read_dir(path).expect("fixture directory should be readable") {
            let path = entry.expect("fixture entry should be readable").path();
            if path.is_dir() {
                fixture_paths.push(path);
            } else if path
                .extension()
                .is_some_and(|extension| extension == "json")
            {
                assert_no_sensitive_sample_payload(
                    &fs::read_to_string(path).expect("fixture should be readable"),
                );
            }
        }
    }
}

fn assert_redacted(serialized: &str) {
    assert_no_sensitive_sample_payload(serialized);
    assert!(!serialized.contains("token"));
}

fn assert_no_sensitive_sample_payload(serialized: &str) {
    assert!(!serialized.contains("embedding"));
    assert!(!serialized.contains("waveform_peaks"));
}
