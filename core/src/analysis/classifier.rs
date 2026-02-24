use std::path::Path;

use super::kick::KickResult;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum InstrumentType {
    Kick,
    Snare,
    Hihat,
    Clap,
    Bass,
    Synth,
    Fx,
    Vocal,
    Percussion,
    Other,
}

impl InstrumentType {
    pub fn as_str(&self) -> &'static str {
        match self {
            InstrumentType::Kick => "kick",
            InstrumentType::Snare => "snare",
            InstrumentType::Hihat => "hihat",
            InstrumentType::Clap => "clap",
            InstrumentType::Bass => "bass",
            InstrumentType::Synth => "synth",
            InstrumentType::Fx => "fx",
            InstrumentType::Vocal => "vocal",
            InstrumentType::Percussion => "percussion",
            InstrumentType::Other => "other",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PlaybackType {
    Loop,
    OneShot,
}

impl PlaybackType {
    pub fn as_str(&self) -> &'static str {
        match self {
            PlaybackType::Loop => "loop",
            PlaybackType::OneShot => "oneshot",
        }
    }
}

pub struct ClassificationResult {
    pub playback_type: PlaybackType,
    pub instrument_type: InstrumentType,
}

pub fn classify_sample(
    file_path: &Path,
    duration_seconds: f64,
    bpm_confidence: f64,
    kick_result: Option<&KickResult>,
) -> ClassificationResult {
    let file_name = file_path
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or_default();

    let instrument_type = classify_instrument_type(file_name, kick_result);
    let playback_type = classify_playback_type(file_name, duration_seconds, bpm_confidence);

    ClassificationResult {
        playback_type,
        instrument_type,
    }
}

fn classify_instrument_type(file_name: &str, kick_result: Option<&KickResult>) -> InstrumentType {
    let lower = file_name.to_lowercase();

    if lower.starts_with("kick")
        || lower.contains("_kick")
        || lower.contains("-kick")
        || lower.contains("kick_")
        || lower.contains(".kick")
    {
        return InstrumentType::Kick;
    }

    if lower.starts_with("snare")
        || lower.contains("_snare")
        || lower.contains("-snare")
        || lower.contains("snare_")
    {
        return InstrumentType::Snare;
    }

    if lower.starts_with("hihat")
        || lower.starts_with("hi-hat")
        || lower.contains("_hh")
        || lower.contains("_hihat")
        || lower.contains("-hh")
        || lower.contains("hh_")
    {
        return InstrumentType::Hihat;
    }

    if lower.starts_with("clap")
        || lower.contains("_clap")
        || lower.contains("-clap")
    {
        return InstrumentType::Clap;
    }

    if lower.starts_with("bass")
        || lower.contains("_bass")
        || lower.contains("-bass")
        || lower.contains("_sub")
        || lower.contains("sub_")
    {
        return InstrumentType::Bass;
    }

    if lower.starts_with("synth")
        || lower.contains("_synth")
        || lower.contains("-synth")
        || lower.contains("_lead")
        || lower.contains("_pad")
    {
        return InstrumentType::Synth;
    }

    if lower.starts_with("fx")
        || lower.contains("_fx")
        || lower.contains("-fx")
        || lower.contains("riser")
        || lower.contains("impact")
        || lower.contains("sweep")
    {
        return InstrumentType::Fx;
    }

    if lower.starts_with("vox")
        || lower.starts_with("vocal")
        || lower.contains("_vox")
        || lower.contains("_vocal")
        || lower.contains("voice")
    {
        return InstrumentType::Vocal;
    }

    if lower.contains("loop")
        || lower.contains("_lp")
    {
        return InstrumentType::Percussion;
    }

    if let Some(kick) = kick_result {
        if kick.is_kick {
            return InstrumentType::Kick;
        }
    }

    InstrumentType::Other
}

fn classify_playback_type(file_name: &str, duration_seconds: f64, bpm_confidence: f64) -> PlaybackType {
    let lower = file_name.to_lowercase();

    if lower.contains(".loop")
        || lower.contains("_loop")
        || lower.contains("-loop")
        || lower.contains("loop.")
        || lower.ends_with("_lp")
    {
        return PlaybackType::Loop;
    }

    // More conservative loop detection: require longer duration AND higher confidence
    // This prevents drum fills, long one-shots, and sound effects from being misclassified
    if duration_seconds > 8.0 && bpm_confidence > 0.7 {
        return PlaybackType::Loop;
    }

    if duration_seconds > 10.0 && bpm_confidence > 0.5 {
        return PlaybackType::Loop;
    }

    if duration_seconds > 15.0 && bpm_confidence > 0.3 {
        return PlaybackType::Loop;
    }

    PlaybackType::OneShot
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_kick_filename_detection() {
        let result = classify_instrument_type("kick_808.wav", None);
        assert_eq!(result, InstrumentType::Kick);

        let result = classify_instrument_type("kick_808.wav", None);
        assert_eq!(result, InstrumentType::Kick);

        let result = classify_instrument_type("deep_kick.wav", None);
        assert_eq!(result, InstrumentType::Kick);
    }

    #[test]
    fn test_snare_filename_detection() {
        let result = classify_instrument_type("snare_tight.wav", None);
        assert_eq!(result, InstrumentType::Snare);

        let result = classify_instrument_type("snare_808.wav", None);
        assert_eq!(result, InstrumentType::Snare);
    }

    #[test]
    fn test_hihat_filename_detection() {
        let result = classify_instrument_type("hihat_closed.wav", None);
        assert_eq!(result, InstrumentType::Hihat);

        let result = classify_instrument_type("hh_open.wav", None);
        assert_eq!(result, InstrumentType::Hihat);
    }

    #[test]
    fn test_bass_filename_detection() {
        let result = classify_instrument_type("bass_sub.wav", None);
        assert_eq!(result, InstrumentType::Bass);

        let result = classify_instrument_type("808_bass.wav", None);
        assert_eq!(result, InstrumentType::Bass);
    }

    #[test]
    fn test_loop_filename_detection() {
        let result = classify_playback_type("drum_loop.wav", 8.0, 0.8);
        assert_eq!(result, PlaybackType::Loop);

        let result = classify_playback_type("melody_loop.wav", 4.5, 0.6);
        assert_eq!(result, PlaybackType::Loop);
    }

    #[test]
    fn test_oneshot_by_default() {
        let result = classify_playback_type("kick_808.wav", 0.5, 0.1);
        assert_eq!(result, PlaybackType::OneShot);

        let result = classify_playback_type("impact.wav", 2.0, 0.2);
        assert_eq!(result, PlaybackType::OneShot);
    }

    #[test]
    fn test_loop_by_duration_and_confidence() {
        let result = classify_playback_type("unknown.wav", 5.0, 0.7);
        assert_eq!(result, PlaybackType::Loop);

        let result = classify_playback_type("unknown.wav", 4.5, 0.4);
        assert_eq!(result, PlaybackType::Loop);
    }
}
