use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::thread;

use crossbeam_channel::{unbounded, Sender};
use rayon::{ThreadPool, ThreadPoolBuilder};
use thiserror::Error;

use crate::analysis::AnalysisResult;

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
}

impl<T> From<crossbeam_channel::SendError<T>> for ThreadingError {
    fn from(_: crossbeam_channel::SendError<T>) -> Self {
        ThreadingError::ChannelSend
    }
}

enum DbMessage {
    /// A completed analysis result to persist.
    Write(AnalysisResult),
    /// Signal the DB writer to shut down cleanly.
    Shutdown,
}

/// Thread pool for parallel audio analysis with database persistence.
pub struct AnalysisPool {
    /// Number of worker threads in the analysis pool.
    pub worker_count: usize,
    pool: Arc<ThreadPool>,
    db_tx: Sender<DbMessage>,
    /// `Some` while the writer thread is alive; taken on `shutdown()`.
    writer_handle: Option<thread::JoinHandle<()>>,
}

impl AnalysisPool {
    /// Create a new `AnalysisPool`.
    ///
    /// Spawns `worker_count` analysis threads and one database writer thread.
    ///
    /// # Arguments
    /// * `worker_count` - Number of parallel analysis workers to spawn
    ///
    /// # Returns
    /// AnalysisPool ready to accept analysis tasks or an error if pool creation fails.
    pub fn new(worker_count: usize) -> Result<Self, ThreadingError> {
        if worker_count == 0 {
            return Err(ThreadingError::InvalidWorkerCount);
        }

        let pool = Arc::new(ThreadPoolBuilder::new().num_threads(worker_count).build()?);

        let (db_tx, db_rx) = unbounded::<DbMessage>();

        let writer_handle = std::thread::spawn(move || {
            while let Ok(message) = db_rx.recv() {
                match message {
                    DbMessage::Shutdown => break,
                    DbMessage::Write(_result) => {
                        // TODO: persist to database
                    }
                }
            }
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
        self.db_tx.send(DbMessage::Shutdown).ok();
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
        .map_err(|_| format!("Analysis panicked for {}", path_str))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn analysis_pool_creation_succeeds() {
        let pool = AnalysisPool::new(2);
        assert!(pool.is_ok());
    }

    #[test]
    fn analysis_pool_creation_with_zero_threads_fails() {
        let pool = AnalysisPool::new(0);
        assert!(pool.is_err());
    }
}
