use rusqlite::Connection;

use crate::db::operations::types::{EmbeddingSearchResult, SampleRow};

use super::row_to_sample;

pub fn search_by_embedding(
    conn: &Connection,
    query: &[f32],
    k: usize,
) -> Result<Vec<EmbeddingSearchResult>, rusqlite::Error> {
    if query.is_empty() {
        return Ok(Vec::new());
    }

    let mut stmt = conn.prepare_cached(
        "SELECT id, path, file_name, duration, bpm, periodicity, sample_rate, file_size, artist, low_ratio, attack_slope, decay_time, sample_type, waveform_peaks, embedding, is_online, playback_type, instrument_type, musical_key, COALESCE((SELECT GROUP_CONCAT(name, char(31)) FROM (SELECT t.name AS name FROM sample_tags st JOIN tags t ON t.id = st.tag_id WHERE st.sample_id = samples.id ORDER BY t.name)), '') AS tag_names FROM samples WHERE embedding IS NOT NULL",
    )?;
    let rows = stmt.query_map([], row_to_sample)?;

    let mut scored: Vec<(f32, SampleRow)> = Vec::new();
    for r in rows {
        if let Ok(sample) = r {
            if let Some(ref blob) = sample.embedding {
                if blob.len() % 4 != 0 {
                    continue;
                }
                let dim = blob.len() / 4;
                if dim != query.len() {
                    continue;
                }
                let other: Vec<f32> = (0..dim)
                    .map(|i| {
                        f32::from_le_bytes([
                            blob[i * 4],
                            blob[i * 4 + 1],
                            blob[i * 4 + 2],
                            blob[i * 4 + 3],
                        ])
                    })
                    .collect();
                scored.push((cos_sim(query, &other), sample));
            }
        }
    }
    scored.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));
    Ok(scored
        .into_iter()
        .take(k)
        .map(|(sim, s)| EmbeddingSearchResult {
            similarity: sim,
            row: s,
        })
        .collect())
}

fn cos_sim(a: &[f32], b: &[f32]) -> f32 {
    let (mut dot, mut na, mut nb) = (0.0f32, 0.0f32, 0.0f32);
    for i in 0..a.len() {
        dot += a[i] * b[i];
        na += a[i] * a[i];
        nb += b[i] * b[i];
    }
    dot / (na.sqrt() * nb.sqrt()).max(1e-8)
}
