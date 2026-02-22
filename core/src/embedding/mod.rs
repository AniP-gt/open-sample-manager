/// Embedding module for vector representations of samples.
///
/// Provides vector embeddings for semantic search and similarity analysis
/// of audio samples based on their acoustic and perceptual characteristics.
pub struct EmbeddingVector {
    /// Vector of floating-point coefficients representing the sample's embedding.
    pub vector: Vec<f32>,
}
