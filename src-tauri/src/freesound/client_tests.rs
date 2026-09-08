use super::super::policy::is_preview_url;
use super::super::response::SearchBody;
use super::{
    append_response_chunk, authorization_header, validate_page, validate_query, FreesoundApiKey,
    API_SEARCH_URL, MAX_RESPONSE_BYTES,
};
use reqwest::StatusCode;
use url::Url;

#[test]
fn search_inputs_are_bounded_before_network_access() {
    assert_eq!(validate_query(" kick ").expect("valid query"), "kick");
    assert!(validate_query("").is_err());
    assert!(validate_query(&"a".repeat(201)).is_err());
    assert_eq!(validate_page(None).expect("default page"), 1);
    assert!(validate_page(Some(0)).is_err());
}

#[test]
fn response_chunks_stop_before_exceeding_the_search_limit() {
    let mut body = Vec::new();

    append_response_chunk(&mut body, &vec![0; MAX_RESPONSE_BYTES]).expect("cap-sized chunk");

    assert!(append_response_chunk(&mut body, &[0]).is_err());
    assert_eq!(body.len(), MAX_RESPONSE_BYTES);
}

#[test]
fn preview_urls_require_documented_https_hosts_and_paths() {
    assert!(is_preview_url(
        &Url::parse("https://cdn.freesound.org/previews/1/2_3-hq.mp3").expect("url")
    ));
    assert!(is_preview_url(
        &Url::parse("https://freesound.org/data/previews/1/2_3-lq.mp3").expect("url")
    ));
    assert!(!is_preview_url(
        &Url::parse("http://cdn.freesound.org/previews/1/2.mp3").expect("url")
    ));
    assert!(!is_preview_url(
        &Url::parse("https://example.com/previews/1/2.mp3").expect("url")
    ));
}

#[test]
fn search_contract_uses_v2_endpoint_token_auth_and_tolerates_documented_extra_fields() {
    let key = FreesoundApiKey::parse(&"a".repeat(16)).expect("valid key");
    let body = r#"{"count":1,"next":null,"previous":null,"results":[{"id":7,"name":"Kick","url":"https://freesound.org/apiv2/sounds/7/","username":"maker","license":"http://creativecommons.org/publicdomain/zero/1.0/","previews":{"preview-hq-mp3":"https://cdn.freesound.org/previews/1/7_1-hq.mp3"}}]}"#;
    let response_with_documented_extra_field = r#"{"count":1,"next":null,"previous":null,"results":[{"id":7,"name":"Kick","url":"https://freesound.org/s/7/","username":"maker","license":"https://creativecommons.org/publicdomain/zero/1.0/","type":"wav","previews":{"preview-hq-mp3":"https://cdn.freesound.org/previews/1/7_1-hq.mp3"}}]}"#;

    assert_eq!(API_SEARCH_URL, "https://freesound.org/apiv2/search/");
    assert!(authorization_header(&key).starts_with("Token "));
    let response = serde_json::from_str::<SearchBody>(body)
        .expect("documented response")
        .into_public(1, 20)
        .expect("public response");
    let serialized = serde_json::to_value(response).expect("serializes Tauri response");

    assert_eq!(
        serialized,
        serde_json::json!({
            "page": 1,
            "pageSize": 20,
            "totalCount": 1,
            "hasPrevious": false,
            "hasNext": false,
            "sounds": [{
                "id": 7,
                "name": "Kick",
                "uploader": "maker",
                "license": "CC0",
                "licenseUrl": "https://creativecommons.org/publicdomain/zero/1.0/",
                "pageUrl": "https://freesound.org/s/7/",
                "previewUrl": "https://cdn.freesound.org/previews/1/7_1-hq.mp3"
            }]
        })
    );
    assert!(serde_json::from_str::<SearchBody>(response_with_documented_extra_field).is_ok());
}

#[test]
fn search_response_rejects_unapproved_renderer_links() {
    let body = r#"{"count":1,"next":null,"previous":null,"results":[{"id":7,"name":"Kick","url":"https://freesound.org/apiv2/sounds/7/","username":"maker","license":"https://example.com/license/","previews":{"preview-hq-mp3":"https://cdn.freesound.org/previews/1/7_1-hq.mp3"}}]}"#;

    let result = serde_json::from_str::<SearchBody>(body)
        .expect("response shape")
        .into_public(1, 20);

    assert!(result.is_err());
}

#[test]
fn search_response_accepts_the_canonical_sampling_plus_license() {
    let body = r#"{"count":1,"next":null,"previous":null,"results":[{"id":7,"name":"Kick","url":"https://freesound.org/apiv2/sounds/7/","username":"maker","license":"https://creativecommons.org/licenses/sampling+/1.0/","previews":{"preview-hq-mp3":"https://cdn.freesound.org/previews/1/7_1-hq.mp3"}}]}"#;

    let response = serde_json::from_str::<SearchBody>(body)
        .expect("Sampling+ response shape")
        .into_public(1, 20)
        .expect("Sampling+ public response");

    assert_eq!(response.sounds[0].license, "CC Sampling+ 1.0");
    assert_eq!(
        response.sounds[0].license_url,
        "https://creativecommons.org/licenses/sampling+/1.0/"
    );
}

#[test]
fn authentication_statuses_map_to_public_api_errors() {
    assert!(matches!(
        super::api_error_for_status(StatusCode::UNAUTHORIZED),
        super::FreesoundApiError::Unauthorized
    ));
    assert!(matches!(
        super::api_error_for_status(StatusCode::TOO_MANY_REQUESTS),
        super::FreesoundApiError::RateLimited
    ));
}
