use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct SampleSummary {
    pub file_name: String,
    pub duration_seconds: f32,
}

pub fn healthcheck() -> &'static str {
    "open-sample-manager-core-ready"
}

#[cfg(test)]
mod tests {
    use super::healthcheck;

    #[test]
    fn healthcheck_returns_expected_value() {
        assert_eq!(healthcheck(), "open-sample-manager-core-ready");
    }
}
