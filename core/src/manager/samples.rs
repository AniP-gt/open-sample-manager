use std::path::Path;

use crate::db::operations::{self, EmbeddingSearchResult, SampleInput, SampleRow};

use super::{analyze, scan, ManagerError, SampleManager, ScanProgress, ScanStage, SimilarityError};

const MAX_SIMILAR_SAMPLES: usize = 100;

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

    pub fn get_sample_by_id(&self, id: i64) -> Result<Option<SampleRow>, ManagerError> {
        Ok(operations::get_sample_by_id(&self.conn, id)?)
    }

    pub fn find_similar_samples(
        &self,
        sample_id: i64,
        limit: usize,
        exclude_duplicates: bool,
    ) -> Result<Vec<EmbeddingSearchResult>, SimilarityError> {
        let source = operations::get_sample_by_id(&self.conn, sample_id)?
            .ok_or(SimilarityError::NotFound(sample_id))?;
        let query = decode_embedding(sample_id, source.embedding.as_deref())?;
        validate_similarity_limit(limit)?;
        let source_hash = source.content_hash.as_deref();

        let mut results = Vec::new();
        let mut seen = 0usize;
        let mut fetch_k = limit.saturating_add(1).max(1);

        loop {
            let batch = operations::search_by_embedding(&self.conn, &query, fetch_k)?;
            let batch_len = batch.len();
            if batch_len <= seen {
                break;
            }

            for candidate in batch.into_iter().skip(seen) {
                let EmbeddingSearchResult { similarity, row } = candidate;
                if row.id == sample_id {
                    continue;
                }
                if exclude_duplicates {
                    if let (Some(source_hash), Some(candidate_hash)) =
                        (source_hash, row.content_hash.as_deref())
                    {
                        if candidate_hash == source_hash {
                            continue;
                        }
                    }
                }

                results.push(EmbeddingSearchResult { similarity, row });
                if results.len() >= limit {
                    return Ok(results);
                }
            }

            if batch_len < fetch_k {
                break;
            }
            seen = batch_len;
            fetch_k = fetch_k.saturating_mul(2);
            if fetch_k <= seen {
                fetch_k = seen.saturating_add(1);
            }
        }

        results.truncate(limit);
        Ok(results)
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
            source: row.source,
            pack_name: row.pack_name,
            license: row.license,
            license_url: row.license_url,
            license_memo: row.license_memo,
            imported_at: row.imported_at,
            peak_db: row.peak_db,
            rms_db: row.rms_db,
            leading_silence_ms: row.leading_silence_ms,
            clipping_count: row.clipping_count,
            channel_count: row.channel_count,
            bit_depth: row.bit_depth,
            quality_flags: row.quality_flags,
            playback_type: Some(pt),
            instrument_type: Some(it),
            musical_key: row.musical_key,
            content_hash: row.content_hash,
        };
        Ok(operations::update_sample(&self.conn, &input)?)
    }

    pub fn update_sample_license_metadata(
        &self,
        path: &str,
        source: Option<String>,
        pack_name: Option<String>,
        license: Option<String>,
        license_url: Option<String>,
        license_memo: Option<String>,
    ) -> Result<usize, ManagerError> {
        let source = normalize_blank(source);
        let pack_name = normalize_blank(pack_name);
        let license = normalize_blank(license);
        let license_url = normalize_blank(license_url);
        let license_memo = normalize_blank(license_memo);

        Ok(operations::update_sample_license_metadata(
            &self.conn,
            path,
            source.as_deref(),
            pack_name.as_deref(),
            license.as_deref(),
            license_url.as_deref(),
            license_memo.as_deref(),
        )?)
    }
}

fn validate_similarity_limit(limit: usize) -> Result<(), SimilarityError> {
    if (1..=MAX_SIMILAR_SAMPLES).contains(&limit) {
        Ok(())
    } else {
        Err(SimilarityError::InvalidLimit(limit))
    }
}

fn normalize_blank(value: Option<String>) -> Option<String> {
    value.and_then(|value| {
        let trimmed = value.trim();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed.to_string())
        }
    })
}

fn decode_embedding(sample_id: i64, blob: Option<&[u8]>) -> Result<Vec<f32>, SimilarityError> {
    let blob = blob.ok_or(SimilarityError::MissingEmbedding(sample_id))?;
    if blob.is_empty() || blob.len() % 4 != 0 {
        return Err(SimilarityError::MalformedEmbedding(sample_id));
    }

    Ok(blob
        .chunks_exact(4)
        .map(|chunk| f32::from_le_bytes([chunk[0], chunk[1], chunk[2], chunk[3]]))
        .collect())
}
