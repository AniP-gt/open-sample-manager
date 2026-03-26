use std::collections::HashSet;
use std::panic::AssertUnwindSafe;
use std::path::{Path, PathBuf};
use std::thread;
use std::time::{Duration, Instant};

use crossbeam_channel::unbounded;
use rayon::prelude::*;

use crate::db::operations::insert_sample;
use crate::scanner::scan_directory as scan_dir;

use super::analyze::analyze;
use super::{ManagerError, ScanProgress, ScanStage};

pub(super) fn scan_with_progress(
    conn: &rusqlite::Connection,
    path: &Path,
    mut progress: impl FnMut(ScanProgress),
) -> Result<usize, ManagerError> {
    progress(ScanProgress {
        stage: ScanStage::Discovering,
        current: 0,
        total: 0,
        current_file: "Scanning directory...".to_string(),
    });

    let all_files = scan_dir(path);
    let total_discovered = all_files.len();

    let existing_paths: HashSet<String> = {
        let mut stmt = conn
            .prepare_cached("SELECT path FROM samples")
            .map_err(ManagerError::Db)?;
        let paths: HashSet<String> = stmt
            .query_map([], |row| row.get::<_, String>(0))
            .map_err(ManagerError::Db)?
            .filter_map(|r| r.ok())
            .collect();
        paths
    };

    let files: Vec<PathBuf> = all_files
        .into_iter()
        .filter(|p| {
            p.to_str()
                .map(|s| !existing_paths.contains(s))
                .unwrap_or(true)
        })
        .collect();
    let total_files = files.len();
    let skipped = total_discovered.saturating_sub(total_files);

    progress(ScanProgress {
        stage: ScanStage::Discovering,
        current: 0,
        total: total_files,
        current_file: if skipped > 0 {
            format!(
                "Found {} audio files ({} already indexed, skipping)",
                total_files, skipped
            )
        } else {
            format!("Found {} audio files", total_files)
        },
    });

    if total_files == 0 {
        progress(ScanProgress {
            stage: ScanStage::Complete,
            current: 0,
            total: 0,
            current_file: format!("All {} files already indexed", total_discovered),
        });
        return Ok(0);
    }

    let mut count = 0usize;

    let (tx, rx) = unbounded::<(
        PathBuf,
        Result<crate::db::operations::SampleInput, ManagerError>,
    )>();

    let producer = thread::spawn(move || {
        files.into_par_iter().for_each(|file_path| {
            let outcome = std::panic::catch_unwind(AssertUnwindSafe(|| analyze(&file_path)))
                .map_err(|_| {
                    ManagerError::Io(std::io::Error::new(
                        std::io::ErrorKind::Other,
                        "analysis panicked",
                    ))
                })
                .and_then(|r| r);
            let _ = tx.send((file_path, outcome));
        });
    });

    if let Err(e) = conn.execute_batch("BEGIN IMMEDIATE;") {
        return Err(ManagerError::Db(e));
    }

    // Throttle progress updates to avoid flooding the UI
    // Emit at most every 100ms (or on first/last file)
    let throttle_interval = Duration::from_millis(100);
    let mut last_emit = Instant::now();

    let should_emit = |current: usize, total: usize, last_emit_time: Instant| -> bool {
        // Always emit for first file, last file, or complete stage
        if current == 0 || current == total {
            return true;
        }
        // Emit if enough time has passed
        last_emit_time.elapsed() >= throttle_interval
    };

    for idx in 0..total_files {
        let (file_path, analysis_res) = match rx.recv() {
            Ok(v) => v,
            Err(_) => break,
        };

        let file_name = file_path
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("unknown")
            .to_string();

        // Only emit progress if enough time has passed or it's the last file
        if should_emit(idx + 1, total_files, last_emit) {
            progress(ScanProgress {
                stage: ScanStage::Analyzing,
                current: idx + 1,
                total: total_files,
                current_file: file_name.clone(),
            });
            last_emit = Instant::now();
        }

        match analysis_res {
            Ok(input) => match insert_sample(conn, &input) {
                Ok(_) => count += 1,
                Err(rusqlite::Error::SqliteFailure(err, _))
                    if err.code == rusqlite::ErrorCode::ConstraintViolation => {}
                Err(e) => {
                    let _ = conn.execute_batch("ROLLBACK;");
                    return Err(ManagerError::Db(e));
                }
            },
            Err(ManagerError::Decode(_)) => {}
            Err(e) => {
                let _ = conn.execute_batch("ROLLBACK;");
                return Err(e);
            }
        }
    }

    if let Err(e) = conn.execute_batch("COMMIT;") {
        return Err(ManagerError::Db(e));
    }

    let _ = producer.join();

    progress(ScanProgress {
        stage: ScanStage::Complete,
        current: total_files,
        total: total_files,
        current_file: format!("Indexed {} samples", count),
    });

    Ok(count)
}
