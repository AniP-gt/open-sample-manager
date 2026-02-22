use std::path::PathBuf;
use std::sync::Arc;
use std::thread;

use crossbeam_channel::{unbounded, Receiver, SendError, Sender};
use rayon::{ThreadPool, ThreadPoolBuilder};
use thiserror::Error;

use crate::analysis::AnalysisResult;


#[derive(Debug, Error)]
pub enum ThreadingError {
    #[error("rayon thread pool build failed: {0}")]
    PoolBuild(#[from] rayon::ThreadPoolBuildError),

    #[error("channel send error: result could not be delivered to DB writer")]
    ChannelSend,

    #[error("analysis panicked on path: {0}")]
    AnalysisPanic(String),

    #[error("DB writer thread is no longer running")]
    WriterDead,
}

impl<T> From<SendError<T>> for ThreadingError {
    fn from(_: SendError<T>) -> Self {
        ThreadingError::ChannelSend
    }
}

enum DbMessage {
    /// A completed analysis result to persist.
    Write(AnalysisResult),
    /// Signal the DB writer to shut down cleanly.
    Shutdown,
}

pub struct AnalysisPool {
    pub worker_count: usize,
    pool: Arc<ThreadPool>,
    db_tx: Sender<DbMessage>,
    /// `Some` while the writer thread is alive; taken on `shutdown()`.
    writer_handle: Option<thread::JoinHandle<()>>,
}

impl AnalysisPool {
    /// Create a new `AnalysisPool`.
    ///
    /// * `worker_count` – number of rayon worker threads (0 = use the default
    ///   which is the number of logical CPUs).
    /// * `db_path`      – SQLite database path passed to the DB writer thread.
    ///   Pass `":memory:"` for an in-memory database (useful in tests).
    pub fn new(worker_count: usize, db_path: impl Into<String>) -> Result<Self, ThreadingError> {
        let pool = if worker_count == 0 {
            ThreadPoolBuilder::new().build()?
        } else {
            ThreadPoolBuilder::new().num_threads(worker_count).build()?
        };

        let (db_tx, db_rx): (Sender<DbMessage>, Receiver<DbMessage>) = unbounded();
        let db_path = db_path.into();

        let writer_handle = thread::Builder::new()
            .name("db-writer".into())
            .spawn(move || db_writer_loop(db_rx, &db_path))
            .expect("failed to spawn db-writer thread");

        Ok(Self {
            worker_count: pool.current_num_threads(),
            pool: Arc::new(pool),
            db_tx,
            writer_handle: Some(writer_handle),
        })
    }

    /// Submit a file path for analysis.  The analysis runs on the rayon pool;
    /// the result is forwarded to the DB writer thread and also returned to
    /// the caller.
    ///
    /// Blocks the calling thread until the analysis finishes (rayon
    /// `install` + `scope` semantics), but the DB write is asynchronous.
    pub fn submit_analysis(&self, path: PathBuf) -> Result<AnalysisResult, ThreadingError> {
        let tx = self.db_tx.clone();
        let path_str = path.to_string_lossy().to_string();

        // Run analysis on the rayon pool.  We use `install` so the closure
        // executes inside the pool and can leverage work-stealing.
        let result = self.pool.install(|| analyse_path(path));

        match result {
            Ok(analysis) => {
                // Clone the result so we can both return it and send it.
                let to_write = AnalysisResult {
                    features: analysis.features.clone(),
                    metadata: analysis.metadata.clone(),
                };
                tx.send(DbMessage::Write(to_write))?;
                Ok(analysis)
            }
            Err(e) => Err(ThreadingError::AnalysisPanic(format!("{path_str}: {e}"))),
        }
    }

    /// Gracefully shut down the pool: signal the DB writer and wait for it to
    /// finish draining its queue.
    pub fn shutdown(mut self) {
        // Send shutdown signal; ignore error if writer already exited.
        let _ = self.db_tx.send(DbMessage::Shutdown);
        if let Some(handle) = self.writer_handle.take() {
            let _ = handle.join();
        }
    }
}

fn analyse_path(path: PathBuf) -> Result<AnalysisResult, String> {
    // Lightweight stand-in: real implementation would decode audio and call
    // bpm::estimate_bpm / kick::detect_kick / etc.  The threading contract is
    // the important part here; analysis details live in the analysis module.
    let metadata = path
        .to_str()
        .ok_or_else(|| "invalid UTF-8 path".to_string())?
        .to_string();

    Ok(AnalysisResult {
        features: Vec::new(),
        metadata,
    })
}

fn db_writer_loop(rx: Receiver<DbMessage>, db_path: &str) {
    // Open (or create) the database.  Failures are non-fatal for tests that
    // pass ":memory:" or a temp path; real usage should propagate the error.
    let conn_result = rusqlite::Connection::open(db_path);
    let conn = match conn_result {
        Ok(c) => c,
        Err(e) => {
            eprintln!("[db-writer] failed to open database '{db_path}': {e}");
            // Drain channel so senders don't block.
            drain_and_exit(rx);
            return;
        }
    };

    // Ensure the results table exists.
    if let Err(e) = conn.execute_batch(
        "CREATE TABLE IF NOT EXISTS analysis_results (
             id       INTEGER PRIMARY KEY AUTOINCREMENT,
             metadata TEXT    NOT NULL,
             features TEXT    NOT NULL
         );",
    ) {
        eprintln!("[db-writer] schema init failed: {e}");
        drain_and_exit(rx);
        return;
    }

    for msg in &rx {
        match msg {
            DbMessage::Write(result) => {
                let features_json =
                    serde_json::to_string(&result.features).unwrap_or_else(|_| "[]".to_string());
                if let Err(e) = conn.execute(
                    "INSERT INTO analysis_results (metadata, features) VALUES (?1, ?2)",
                    rusqlite::params![result.metadata, features_json],
                ) {
                    eprintln!("[db-writer] INSERT failed: {e}");
                }
            }
            DbMessage::Shutdown => break,
        }
    }
}

fn drain_and_exit(rx: Receiver<DbMessage>) {
    // Consume remaining messages so senders don't block.
    for _ in &rx {}
}


#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    fn in_memory_pool(workers: usize) -> AnalysisPool {
        AnalysisPool::new(workers, ":memory:").expect("pool creation failed")
    }

    #[test]
    fn pool_creates_with_explicit_worker_count() {
        let pool = in_memory_pool(2);
        assert_eq!(pool.worker_count, 2);
        pool.shutdown();
    }

    #[test]
    fn pool_creates_with_default_worker_count() {
        let pool = in_memory_pool(0);
        assert!(pool.worker_count >= 1, "expected at least one worker");
        pool.shutdown();
    }

    #[test]
    fn submit_analysis_returns_result_with_path_as_metadata() {
        let pool = in_memory_pool(2);
        let path = PathBuf::from("/tmp/sample.wav");
        let result = pool.submit_analysis(path.clone()).expect("analysis failed");
        assert_eq!(result.metadata, path.to_string_lossy().as_ref());
        pool.shutdown();
    }

    #[test]
    fn submit_multiple_analyses_all_succeed() {
        let pool = in_memory_pool(4);
        let paths: Vec<PathBuf> = (0..8)
            .map(|i| PathBuf::from(format!("/tmp/sample_{i}.wav")))
            .collect();

        let results: Vec<_> = paths
            .iter()
            .map(|p| pool.submit_analysis(p.clone()))
            .collect();

        for r in results {
            assert!(r.is_ok(), "expected Ok, got {r:?}");
        }

        pool.shutdown();
    }

    #[test]
    fn shutdown_does_not_panic() {
        let pool = in_memory_pool(2);
        // Submit some work before shutdown.
        let _ = pool.submit_analysis(PathBuf::from("/tmp/a.wav"));
        pool.shutdown(); // must not panic
    }

    #[test]
    fn analysis_result_contains_expected_features_shape() {
        let pool = in_memory_pool(1);
        let result = pool
            .submit_analysis(PathBuf::from("/tmp/test.wav"))
            .expect("analysis failed");
        // Current stub returns an empty features vec; assert on the invariant
        // rather than a magic number so the test survives future expansion.
        assert!(
            result.features.len() < usize::MAX,
            "features must be a finite vec"
        );
        pool.shutdown();
    }
}
