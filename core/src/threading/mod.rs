use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::thread;

use crossbeam_channel::{unbounded, Sender};
use rayon::{ThreadPool, ThreadPoolBuilder};
use rusqlite::Connection;
use thiserror::Error;

use crate::analysis::loop_classifier::LoopType;
use crate::analysis::AnalysisResult;
use crate::db::operations::{insert_sample, SampleInput};
use crate::db::schema::init_database;

/// Errors that can occur during threading and analysis operations.
#[derive(Debug, Error)]
pub enum ThreadingError {
    /// Invalid worker count (zero).
    #[error("invalid worker count: must be at least 1")]
    InvalidWorkerCount,

    /// Rayon thread pool creation failed.
    #[error("rayon thread pool build failed: {0}")]
    PoolBuild(#[from] rayon::ThreadPoolBuildError),

    /// Channel send error when delivering results to database writer.
    #[error("channel send error: result could not be delivered to DB writer")]
    ChannelSend,

    /// Analysis task panicked on a given file path.
    #[error("analysis panicked on path: {0}")]
    AnalysisPanic(String),

    /// Database writer thread is no longer running.
    #[error("DB writer thread is no longer running")]
    WriterDead,

    /// Database error in the writer thread.
    #[error("database error: {0}")]
    Database(#[from] rusqlite::Error),
}

impl<T> From<crossbeam_channel::SendError<T>> for ThreadingError {
    fn from(_: crossbeam_channel::SendError<T>) -> Self {
        ThreadingError::ChannelSend
    }
}

enum DbMessage {
    Write(AnalysisResult),
}

fn analysis_result_to_sample_input(result: &AnalysisResult) -> SampleInput {
    let path_str = result.path.to_string_lossy().to_string();
    let file_name = result
        .path
        .file_name()
        .map(|f| f.to_string_lossy().to_string())
        .unwrap_or_default();

    let sample_type = match result.loop_type {
        LoopType::Loop => Some("loop".to_string()),
        LoopType::OneShot => Some("oneshot".to_string()),
    };

    SampleInput {
        path: path_str,
        file_name,
        duration: Some(f64::from(result.duration_seconds)),
        bpm: result.bpm.map(|b| b.bpm),
        periodicity: result.bpm.map(|b| b.periodicity_strength),
        sample_rate: Some(result.sample_rate as i64),
        file_size: None,
        artist: None,
        low_ratio: result.kick.map(|k| k.low_ratio),
        attack_slope: result.kick.map(|k| k.attack_slope),
        decay_time: result.kick.map(|k| k.decay_time_ms),
        sample_type,
        waveform_peaks: None,
        embedding: None,
        playback_type: None,
        instrument_type: None,
    }
}

/// Thread pool for parallel audio analysis with database persistence.
pub struct AnalysisPool {
    /// Number of worker threads in the analysis pool.
    pub worker_count: usize,
    pool: Arc<ThreadPool>,
    db_tx: Sender<DbMessage>,
    writer_handle: Option<thread::JoinHandle<()>>,
}

impl AnalysisPool {
    /// Create a new `AnalysisPool` with database persistence.
    ///
    /// The writer thread opens its own `Connection` at `db_path` and persists
    /// each `AnalysisResult` via `insert_sample`. Duplicate paths are silently
    /// skipped.
    ///
    /// # Errors
    /// Returns `ThreadingError::InvalidWorkerCount` if `worker_count` is 0,
    /// or `ThreadingError::ThreadPool` if thread pool creation fails.
    pub fn new(worker_count: usize, db_path: &Path) -> Result<Self, ThreadingError> {
        if worker_count == 0 {
            return Err(ThreadingError::InvalidWorkerCount);
        }

        let pool = Arc::new(ThreadPoolBuilder::new().num_threads(worker_count).build()?);
        let (db_tx, db_rx) = unbounded::<DbMessage>();

        let db_path_owned = db_path.to_path_buf();
        let writer_handle = std::thread::spawn(move || {
            let conn = match Connection::open(&db_path_owned) {
                Ok(c) => c,
                Err(e) => {
                    eprintln!("DB writer: failed to open database: {e}");
                    return;
                }
            };
            if let Err(e) = init_database(&conn) {
                eprintln!("DB writer: failed to init schema: {e}");
                return;
            }

            while let Ok(message) = db_rx.recv() {
                match message {
                    DbMessage::Write(result) => {
                        let input = analysis_result_to_sample_input(&result);
                        match insert_sample(&conn, &input) {
                            Ok(_id) => {}
                            Err(e) => {
                                // Duplicate path (UNIQUE constraint) → skip silently
                                if !e.to_string().contains("UNIQUE constraint") {
                                    eprintln!(
                                        "DB writer: failed to insert {}: {e}",
                                        result.path.display()
                                    );
                                }
                            }
                        }
                    }
                }
            }
            // Checkpoint WAL before closing so readers see committed data
            let _ = conn.execute_batch("PRAGMA wal_checkpoint(TRUNCATE)");
        });

        Ok(AnalysisPool {
            worker_count,
            pool,
            db_tx,
            writer_handle: Some(writer_handle),
        })
    }

    /// Queue an analysis task for a given file path.
    ///
    /// # Arguments
    /// * `path` - File path to analyze
    /// * `callback` - Function to process analysis results
    ///
    /// # Returns
    /// Error if the writer thread is dead or channel send fails.
    ///
    /// # Errors
    /// Returns `ThreadingError::SendError` if the writer thread is dead or channel send fails.
    pub fn queue<F>(&self, path: PathBuf, callback: F) -> Result<(), ThreadingError>
    where
        F: Fn() -> AnalysisResult + Send + 'static,
    {
        let tx = self.db_tx.clone();
        self.pool.spawn(move || {
            let result = catch_unwind_analysis(&path, callback);
            match result {
                Ok(analysis) => {
                    let _ = tx.send(DbMessage::Write(analysis));
                }
                Err(panic_msg) => {
                    eprintln!("Analysis panicked for {}: {}", path.display(), panic_msg);
                }
            }
        });

        Ok(())
    }

    /// Gracefully shut down the analysis pool and wait for all tasks to complete.
    pub fn shutdown(mut self) {
        // 1. Drop our sender so the channel can close once rayon tasks finish.
        drop(self.db_tx);
        // 2. Drop the pool — rayon tasks already in flight run to completion.
        drop(self.pool);
        // 3. Writer thread exits when all senders are dropped (recv returns Err).
        if let Some(handle) = self.writer_handle.take() {
            handle.join().ok();
        }
    }
}

fn catch_unwind_analysis<F>(path: &Path, callback: F) -> Result<AnalysisResult, String>
where
    F: Fn() -> AnalysisResult,
{
    let path_str = path.to_string_lossy().to_string();
    std::panic::catch_unwind(std::panic::AssertUnwindSafe(callback))
        .map_err(|_| format!("Analysis panicked for {path_str}"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::analysis::loop_classifier::LoopType;

    fn test_db_path() -> PathBuf {
        let dir = tempfile::TempDir::new().expect("tempdir");
        // Leak the TempDir so it isn't cleaned up before the test finishes.
        // This is fine in tests.
        let path = dir.path().join("test.db");
        std::mem::forget(dir);
        path
    }

    fn make_result(path: &str) -> AnalysisResult {
        AnalysisResult {
            path: PathBuf::from(path),
            bpm: None,
            kick: None,
            loop_type: LoopType::OneShot,
            duration_seconds: 1.5,
            sample_rate: 11_025u32,
        }
    }

    #[test]
    fn analysis_pool_creation_succeeds() {
        let db = test_db_path();
        let pool = AnalysisPool::new(2, &db);
        assert!(pool.is_ok());
        pool.unwrap().shutdown();
    }

    #[test]
    fn analysis_pool_creation_with_zero_threads_fails() {
        let db = test_db_path();
        let pool = AnalysisPool::new(0, &db);
        assert!(pool.is_err());
    }

    #[test]
    fn analysis_pool_persists_results_after_shutdown() {
        let dir = tempfile::TempDir::new().expect("tempdir");
        let db_path = dir.path().join("persist_test.db");

        {
            let pool = AnalysisPool::new(2, &db_path).expect("pool creation");
            pool.queue(PathBuf::from("/samples/kick_808.wav"), || {
                make_result("/samples/kick_808.wav")
            })
            .expect("queue");
            pool.shutdown();
        }

        let conn = Connection::open(&db_path).expect("reopen db");
        let row = crate::db::operations::get_sample_by_path(&conn, "/samples/kick_808.wav")
            .expect("query")
            .expect("row should exist after shutdown");
        assert_eq!(row.file_name, "kick_808.wav");
        assert_eq!(row.duration, Some(1.5));
        assert_eq!(row.sample_type, Some("oneshot".to_string()));
    }

    #[test]
    fn analysis_pool_handles_duplicate_paths() {
        let dir = tempfile::TempDir::new().expect("tempdir");
        let db_path = dir.path().join("dup_test.db");

        {
            let pool = AnalysisPool::new(1, &db_path).expect("pool creation");
            pool.queue(PathBuf::from("/dup.wav"), || make_result("/dup.wav"))
                .expect("queue 1");
            pool.queue(PathBuf::from("/dup.wav"), || make_result("/dup.wav"))
                .expect("queue 2");
            pool.shutdown();
        }

        let conn = Connection::open(&db_path).expect("reopen db");
        let row = crate::db::operations::get_sample_by_path(&conn, "/dup.wav")
            .expect("query")
            .expect("row should exist for duplicate path");
        assert_eq!(row.file_name, "dup.wav");
    }
}
