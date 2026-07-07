use std::path::Path;

use crate::db::operations::{self, EmbeddingSearchResult, SampleInput, SampleRow};

use super::{analyze, scan, ManagerError, SampleManager, ScanProgress, ScanStage};

impl SampleManager {
    /// Scan a directory, analyze each audio file, and store results.
    pub fn scan_directory(&self, path: impl AsRef<Path>) -> Result<usize, ManagerError> {
        self.scan_directory_with_progress(path, |_| {})
    }

    /// Scan a directory with progress reporting.
    pub fn scan_directory_with_progress(
        &self,
        path: impl AsRef<Path>,
        progress: impl FnMut(ScanProgress),
    ) -> Result<usize, ManagerError> {
        scan::scan_with_progress(&self.conn, path.as_ref(), progress)
    }

    /// Analyze a single audio file without storing it.
    pub fn analyze_file(&self, path: impl AsRef<Path>) -> Result<SampleInput, ManagerError> {
        analyze::analyze(path.as_ref())
    }

    /// Analyze and store a single audio file. Returns the inserted row id.
    pub fn import_file(&self, path: impl AsRef<Path>) -> Result<i64, ManagerError> {
        analyze::analyze_and_store(&self.conn, path.as_ref())
    }

    pub fn search(&self, query: &str) -> Result<Vec<SampleRow>, ManagerError> {
        Ok(operations::search_samples(&self.conn, query)?)
    }

    pub fn list_samples_paginated(
        &self,
        limit: usize,
        offset: usize,
        directory_path: Option<&str>,
    ) -> Result<Vec<SampleRow>, ManagerError> {
        Ok(operations::list_samples_paginated(
            &self.conn,
            limit,
            offset,
            directory_path,
        )?)
    }

    pub fn list_samples_around_id(
        &self,
        target_id: i64,
        limit: usize,
    ) -> Result<Vec<SampleRow>, ManagerError> {
        Ok(operations::list_samples_around_id(
            &self.conn, target_id, limit,
        )?)
    }

    pub fn search_paginated(
        &self,
        query: &str,
        limit: usize,
        offset: usize,
        directory_path: Option<&str>,
    ) -> Result<Vec<SampleRow>, ManagerError> {
        Ok(operations::search_samples_paginated(
            &self.conn,
            query,
            limit,
            offset,
            directory_path,
        )?)
    }

    pub fn get_sample(&self, path: &str) -> Result<Option<SampleRow>, ManagerError> {
        Ok(operations::get_sample_by_path(&self.conn, path)?)
    }

    pub fn get_all_sample_paths(&self) -> Result<Vec<String>, ManagerError> {
        Ok(operations::get_all_sample_paths(&self.conn)?)
    }

    pub fn list_duplicate_groups(&self) -> Result<Vec<operations::DuplicateGroup>, ManagerError> {
        Ok(operations::list_duplicate_groups(&self.conn)?)
    }

    pub fn delete_sample(&self, path: &str) -> Result<usize, ManagerError> {
        Ok(operations::delete_sample(&self.conn, path)?)
    }

    pub fn clear_all_samples(&self) -> Result<usize, ManagerError> {
        Ok(operations::clear_all_samples(&self.conn)?)
    }

    pub fn re_scan_all_samples(
        &self,
        mut progress: impl FnMut(ScanProgress),
    ) -> Result<usize, ManagerError> {
        let paths: Vec<String> = operations::get_all_sample_paths(&self.conn)?;
        let total = paths.len();

        progress(ScanProgress {
            stage: ScanStage::Analyzing,
            current: 0,
            total,
            current_file: "Starting re-scan...".to_string(),
        });

        let mut count = 0usize;
        for (idx, path) in paths.iter().enumerate() {
            progress(ScanProgress {
                stage: ScanStage::Analyzing,
                current: idx + 1,
                total,
                current_file: path.clone(),
            });

            match analyze::analyze(path.as_ref()) {
                Ok(input) => {
                    let updated = operations::update_sample(&self.conn, &input)?;
                    if updated > 0 {
                        count += 1;
                    }
                }
                Err(e) => {
                    eprintln!("Failed to analyze {}: {}", path, e);
                }
            }
        }

        progress(ScanProgress {
            stage: ScanStage::Complete,
            current: total,
            total,
            current_file: format!("Re-scanned {} samples", count),
        });

        Ok(count)
    }

    pub fn move_sample(&self, old_path: &str, new_path: &str) -> Result<String, ManagerError> {
        std::fs::rename(old_path, new_path)?;
        operations::move_sample_path(&self.conn, old_path, new_path)?;
        Ok(new_path.to_string())
    }

    pub fn search_by_embedding(
        &self,
        query: &[f32],
        k: usize,
    ) -> Result<Vec<EmbeddingSearchResult>, ManagerError> {
        operations::search_by_embedding(&self.conn, query, k).map_err(ManagerError::Db)
    }

    pub fn update_sample_classification(
        &self,
        sample_id: Option<i64>,
        path: Option<&str>,
        playback_type: Option<String>,
        instrument_type: Option<String>,
    ) -> Result<usize, ManagerError> {
        let existing = match sample_id {
            Some(id) => operations::get_sample_by_id(&self.conn, id)?,
            None => match path {
                Some(p) => operations::get_sample_by_path(&self.conn, p)?,
                None => None,
            },
        };

        let Some(row) = existing else { return Ok(0) };

        let pt = playback_type.unwrap_or_else(|| row.playback_type.clone());
        let it = instrument_type.unwrap_or_else(|| row.instrument_type.clone());
        let sample_type = if pt == "loop" { "loop" } else { "oneshot" }.to_string();

        let input = SampleInput {
            path: row.path,
            file_name: row.file_name,
            duration: row.duration,
            bpm: row.bpm,
            periodicity: row.periodicity,
            sample_rate: row.sample_rate,
            file_size: row.file_size,
            artist: row.artist,
            low_ratio: row.low_ratio,
            attack_slope: row.attack_slope,
            decay_time: row.decay_time,
            sample_type: Some(sample_type),
            waveform_peaks: row.waveform_peaks,
            embedding: row.embedding,
            playback_type: Some(pt),
            instrument_type: Some(it),
            musical_key: row.musical_key,
            content_hash: row.content_hash,
        };
        Ok(operations::update_sample(&self.conn, &input)?)
    }
}
