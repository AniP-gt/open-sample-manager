use rusqlite::Connection;

pub(super) fn migrate(conn: &Connection) -> rusqlite::Result<()> {
    conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS sample_usage_events (
            id INTEGER PRIMARY KEY,
            sample_id INTEGER NOT NULL REFERENCES samples(id) ON DELETE CASCADE,
            kind TEXT NOT NULL CHECK(kind IN ('preview', 'export')),
            occurred_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
        CREATE INDEX IF NOT EXISTS idx_usage_sample_kind_time
            ON sample_usage_events(sample_id, kind, occurred_at);
        CREATE INDEX IF NOT EXISTS idx_usage_kind_time
            ON sample_usage_events(kind, occurred_at);
        CREATE TABLE IF NOT EXISTS project_sample_details (
            collection_id INTEGER NOT NULL,
            sample_id INTEGER NOT NULL,
            status TEXT NOT NULL CHECK(status IN ('candidate', 'adopted')),
            note TEXT NOT NULL DEFAULT '',
            adopted_at INTEGER,
            PRIMARY KEY(collection_id, sample_id),
            FOREIGN KEY(collection_id, sample_id)
                REFERENCES collection_members(collection_id, sample_id) ON DELETE CASCADE
        );
        CREATE TABLE IF NOT EXISTS smart_collections (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            rules_json TEXT NOT NULL
        );",
    )
}
