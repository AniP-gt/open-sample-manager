/// CRUD operations for sample records and FTS5 search.
pub mod operations;
/// Database schema initialization and management.
pub mod schema;

/// Database module for sample metadata persistence.
///
/// Provides database abstraction for storing and retrieving sample metadata,
/// including file paths, audio properties, and analysis results.
pub struct Database {
    /// Connection string for database access.
    pub connection_string: String,
}
