/// Embedding module for vector representations of samples.
///
/// Provides a minimal, local embedding generator used for semantic similarity
/// search. Current implementation builds a deterministic 64-dimensional vector
/// from the audio waveform by computing segment-wise RMS/energy and L2-normalizing.
///
/// This is a simple, self-contained placeholder implementation intended to
/// bootstrap embedding support until a model-based or learned embedder is
/// integrated.
pub struct EmbeddingVector {
    /// Vector of floating-point coefficients representing the sample's embedding.
    pub vector: Vec<f32>,
}

/// Generate a 64-dimensional embedding from raw audio samples.
///
/// The function splits the input samples into 64 (approximately) equal segments,
/// computes the root-mean-square (RMS) magnitude per segment, and returns a
/// unit (L2) normalized Vec<f32> of length 64. If the input is empty, returns
/// a zero vector.
pub fn generate_embedding(samples: &[f32], _sample_rate: u32) -> Vec<f32> {
    const DIM: usize = 64;
    if samples.is_empty() {
        return vec![0.0f32; DIM];
    }

    let n = samples.len();
    let per = (n + DIM - 1) / DIM; // ceil
    let mut vec: Vec<f32> = Vec::with_capacity(DIM);

    for i in 0..DIM {
        let start = i * per;
        if start >= n {
            vec.push(0.0);
            continue;
        }
        let end = ((start + per).min(n)) as usize;
        let mut sum_sq = 0.0f64;
        for &s in &samples[start..end] {
            let v = s as f64;
            sum_sq += v * v;
        }
        let mean_sq = sum_sq / ((end - start) as f64);
        let rms = mean_sq.sqrt() as f32;
        vec.push(rms);
    }

    // L2 normalize
    let mut norm = 0.0f32;
    for v in &vec {
        norm += v * v;
    }
    norm = norm.sqrt();
    if norm > 0.0 {
        for v in &mut vec {
            *v /= norm;
        }
    }
    vec
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn generate_embedding_empty_returns_zero_vector() {
        let v = generate_embedding(&[], 44_100);
        assert_eq!(v.len(), 64);
        assert!(v.iter().all(|&x| x == 0.0));
    }

    #[test]
    fn generate_embedding_nonzero_is_normalized_and_length_64() {
        // create a simple sine wave chunk to ensure non-zero
        let samples: Vec<f32> = (0..1024).map(|i| ((i as f32) * 0.01).sin()).collect();
        let v = generate_embedding(&samples, 44_100);
        assert_eq!(v.len(), 64);
        let mut norm = 0.0f32;
        for x in &v {
            norm += x * x;
        }
        norm = norm.sqrt();
        // Should be approximately 1.0
        assert!((norm - 1.0).abs() < 1e-6, "norm was {}", norm);
    }
}
