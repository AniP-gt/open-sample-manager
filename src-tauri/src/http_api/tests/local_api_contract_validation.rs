use crate::http_api::contracts::{ApiRequest, SearchSamplesRequest, ShowSamplesInAppRequest};
use std::{fs, path::PathBuf};

fn fixture(relative: &str) -> String {
    fs::read_to_string(
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("contracts/localhost-api-mcp/fixtures")
            .join(relative),
    )
    .expect("fixture should be readable")
}

#[test]
fn local_api_contract_rejects_malformed_payloads_deterministically() {
    assert!(
        serde_json::from_str::<ApiRequest<SearchSamplesRequest>>(&fixture(
            "malformed/search_samples_unknown_field.json"
        ))
        .is_err()
    );
    let negative = serde_json::from_str::<ApiRequest<SearchSamplesRequest>>(&fixture(
        "malformed/search_samples_negative_bpm.json",
    ))
    .expect("negative BPM fixture should parse");
    assert_eq!(
        negative
            .payload
            .validate(&negative.request_id)
            .expect_err("negative BPM should fail")
            .status(),
        400
    );
    let invalid_limit = empty_search(Some(0));
    assert_eq!(
        invalid_limit
            .validate("req")
            .expect_err("zero limit should fail")
            .status(),
        400
    );
    assert_eq!(
        empty_search(Some(101))
            .validate("req")
            .expect_err("101 limit should fail")
            .status(),
        400
    );
    assert_eq!(
        ShowSamplesInAppRequest {
            sample_ids: vec![],
            selected_id: None
        }
        .validate("req")
        .expect_err("empty IDs should fail")
        .status(),
        400
    );
    assert_eq!(
        ShowSamplesInAppRequest {
            sample_ids: vec![1, 1],
            selected_id: None
        }
        .validate("req")
        .expect_err("duplicate IDs should fail")
        .status(),
        409
    );
    assert_eq!(
        ShowSamplesInAppRequest {
            sample_ids: vec![1],
            selected_id: Some(2)
        }
        .validate("req")
        .expect_err("selected ID should belong to IDs")
        .status(),
        400
    );
    assert_eq!(
        SearchSamplesRequest {
            query: Some("x".repeat(513)),
            ..empty_search(None)
        }
        .validate("req")
        .expect_err("oversized query should fail")
        .status(),
        413
    );
}

fn empty_search(limit: Option<u32>) -> SearchSamplesRequest {
    SearchSamplesRequest {
        query: None,
        sample_type: None,
        instrument: None,
        bpm_min: None,
        bpm_max: None,
        key: None,
        tags: None,
        directory_path: None,
        limit,
        offset: None,
    }
}
