use super::FreesoundApiKey;

#[test]
fn api_key_accepts_trimmed_ascii_alphanumeric_value_at_minimum_length() {
    // Given: an API key with incidental surrounding whitespace.
    let raw = format!("  {}  ", "a".repeat(16));

    // When: the renderer value crosses the credential boundary.
    let key = FreesoundApiKey::parse(&raw);

    // Then: the secret is accepted without preserving whitespace.
    assert!(key.is_ok());
}

#[test]
fn api_key_rejects_non_alphanumeric_or_out_of_range_value() {
    // Given: malformed and boundary-invalid API keys.
    let cases = ["a".repeat(15), "a-b".repeat(6), "a".repeat(513)];

    // When / Then: each value is parsed at the credential boundary.
    for raw in cases {
        assert!(FreesoundApiKey::parse(&raw).is_err());
    }
}
