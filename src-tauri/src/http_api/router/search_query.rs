use crate::http_api::contracts::{ApiError, ApiOperation, SearchSamplesRequest};

pub(crate) fn compose_search_query(
    request: &SearchSamplesRequest,
    request_id: &str,
) -> Result<String, ApiError> {
    let mut terms = Vec::new();
    if let Some(query) = request
        .query
        .as_deref()
        .filter(|query| !query.trim().is_empty())
    {
        terms.push(query.to_owned());
    }
    if let Some(sample_type) = request.sample_type.as_deref() {
        terms.push(structured_dsl_term("type", sample_type, request_id)?);
    }
    if let Some(instrument) = request.instrument.as_deref() {
        terms.push(structured_dsl_term("instrument", instrument, request_id)?);
    }
    if let Some(key) = request.key.as_deref() {
        terms.push(structured_dsl_term("key", key, request_id)?);
    }
    if let Some(tags) = request.tags.as_deref() {
        for tag in tags {
            terms.push(structured_dsl_term("tag", tag, request_id)?);
        }
    }
    if request.bpm_min.is_some() || request.bpm_max.is_some() {
        let minimum = request
            .bpm_min
            .map_or_else(String::new, |value| value.to_string());
        let maximum = request
            .bpm_max
            .map_or_else(String::new, |value| value.to_string());
        terms.push(format!("bpm:{minimum}-{maximum}"));
    }
    Ok(terms.join(" "))
}

fn structured_dsl_term(field: &str, value: &str, request_id: &str) -> Result<String, ApiError> {
    if value.contains('"') {
        return Err(ApiError::invalid_request(
            request_id,
            ApiOperation::SearchSamples,
            "structured search values cannot contain quotes",
        ));
    }
    Ok(format!("{field}:\"{value}\""))
}
