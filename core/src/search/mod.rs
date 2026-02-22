/// Search module for sample querying and filtering.
///
/// Provides functionality for searching samples by text query, metadata attributes,
/// and semantic similarity in the sample database.
pub struct SearchQuery {
    /// Search query string for full-text or prefix matching.
    pub query_string: String,
}
