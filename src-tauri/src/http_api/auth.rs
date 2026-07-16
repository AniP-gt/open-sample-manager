use sha2::{Digest, Sha256};
use subtle::ConstantTimeEq;

pub const AUTH_PREFIX: &str = "Bearer";

pub fn parse_bearer_token(raw: &str) -> Option<&str> {
    let mut split = raw.splitn(2, ' ');
    let scheme = split.next()?.trim();
    let token = split.next()?.trim();
    if !scheme.eq_ignore_ascii_case(AUTH_PREFIX) {
        return None;
    }
    if token.is_empty() {
        return None;
    }
    Some(token)
}

pub fn is_valid_bearer_token(raw_token: Option<&str>, expected: &str) -> bool {
    let provided = match raw_token.and_then(parse_bearer_token) {
        Some(token) => token,
        None => return false,
    };

    let expected_digest = token_digest(expected);
    let provided_digest = token_digest(provided);

    bool::from(expected_digest.ct_eq(&provided_digest))
}

fn token_digest(token: &str) -> [u8; 32] {
    Sha256::digest(token.as_bytes()).into()
}

#[cfg(test)]
mod tests {
    use super::{is_valid_bearer_token, parse_bearer_token, token_digest};

    #[test]
    fn parse_bearer_token_rejects_invalid_prefix_and_empty_value() {
        assert_eq!(parse_bearer_token("Basic abc"), None);
        assert_eq!(parse_bearer_token("Bearer "), None);
        assert_eq!(parse_bearer_token("BadHeader"), None);
    }

    #[test]
    fn parse_bearer_token_extracts_bearer_token_only() {
        assert_eq!(
            parse_bearer_token("Bearer secret-token"),
            Some("secret-token")
        );
    }

    #[test]
    fn is_valid_bearer_token_checks_constant_time_match() {
        assert!(is_valid_bearer_token(
            Some("Bearer secret-token"),
            "secret-token"
        ));
        assert!(!is_valid_bearer_token(
            Some("Bearer wrong-token"),
            "secret-token"
        ));
        assert!(!is_valid_bearer_token(
            Some("Basic secret-token"),
            "secret-token"
        ));
        assert!(!is_valid_bearer_token(Some("Bearer"), "secret-token"));
    }

    #[test]
    fn is_valid_bearer_token_hashes_different_length_candidates_before_comparing() {
        let expected_digest = token_digest("expected-token");
        let short_digest = token_digest("short");
        let long_digest = token_digest("a-token-that-is-deliberately-much-longer-than-expected");

        assert_eq!(expected_digest.len(), short_digest.len());
        assert_eq!(expected_digest.len(), long_digest.len());
        assert!(!is_valid_bearer_token(
            Some("Bearer short"),
            "expected-token"
        ));
        assert!(!is_valid_bearer_token(
            Some("Bearer a-token-that-is-deliberately-much-longer-than-expected"),
            "expected-token"
        ));
    }
}
