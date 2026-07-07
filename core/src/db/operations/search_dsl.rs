use super::fuzzy::matches_fuzzy_query;
use super::types::SampleRow;

#[derive(Debug, Clone, PartialEq)]
pub(super) struct SampleSearchQuery {
    text_terms: Vec<String>,
    excluded_terms: Vec<String>,
    bpm: Option<NumberRange>,
    playback_type: Option<String>,
    instrument_type: Option<String>,
    key: Option<String>,
    tags: Vec<String>,
    excluded_tags: Vec<String>,
}

#[derive(Debug, Clone, Copy, PartialEq)]
struct NumberRange {
    min: Option<f64>,
    max: Option<f64>,
}

impl SampleSearchQuery {
    pub(super) fn parse(query: &str) -> Self {
        let mut parsed = Self {
            text_terms: Vec::new(),
            excluded_terms: Vec::new(),
            bpm: None,
            playback_type: None,
            instrument_type: None,
            key: None,
            tags: Vec::new(),
            excluded_tags: Vec::new(),
        };

        let tokens = tokenize(query);
        if tokens.is_empty() && !query.trim().is_empty() {
            parsed.push_text(false, query);
            return parsed;
        }

        for token in tokens {
            let (negated, body) = match token.strip_prefix('-') {
                Some(rest) if !rest.is_empty() => (true, rest),
                _ => (false, token.as_str()),
            };

            let Some((raw_field, raw_value)) = body.split_once(':') else {
                parsed.push_text(negated, body);
                continue;
            };

            let field = normalize_field(raw_field);
            let value = raw_value.trim();
            if value.is_empty() {
                parsed.push_text(negated, body);
                continue;
            }

            match field.as_str() {
                "bpm" => {
                    if !negated {
                        parsed.bpm = parse_number_range(value);
                    }
                }
                "type" | "playback" | "playbacktype" | "sampletype" => {
                    if !negated {
                        parsed.playback_type = normalize_playback_type(value);
                    }
                }
                "instrument" | "instrumenttype" => {
                    if !negated {
                        parsed.instrument_type = Some(normalize_value(value));
                    }
                }
                "key" => {
                    if !negated {
                        parsed.key = normalize_key(value);
                    }
                }
                "tag" | "tags" => parsed.push_tag(negated, value),
                "favorite" | "favourite" | "fav" => {}
                _ => parsed.push_text(negated, body),
            }
        }

        parsed
    }

    pub(super) fn matches(&self, sample: &SampleRow) -> bool {
        let tag_text = sample.tags.join(" ");
        let text_targets = [sample.file_name.as_str(), tag_text.as_str()];

        for term in &self.text_terms {
            if !matches_fuzzy_query(term, &text_targets) {
                return false;
            }
        }

        for term in &self.excluded_terms {
            if matches_fuzzy_query(term, &text_targets) {
                return false;
            }
        }

        if let Some(range) = self.bpm {
            if !matches_number_range(sample.bpm, range) {
                return false;
            }
        }

        if let Some(playback_type) = &self.playback_type {
            if normalize_playback_label(&sample.playback_type) != *playback_type
                && sample
                    .sample_type
                    .as_deref()
                    .map(normalize_playback_label)
                    .as_deref()
                    != Some(playback_type.as_str())
            {
                return false;
            }
        }

        if let Some(instrument_type) = &self.instrument_type {
            if normalize_value(&sample.instrument_type) != *instrument_type {
                return false;
            }
        }

        if let Some(key) = &self.key {
            if sample
                .musical_key
                .as_deref()
                .and_then(normalize_key)
                .as_deref()
                != Some(key)
            {
                return false;
            }
        }

        for tag in &self.tags {
            if !sample
                .tags
                .iter()
                .any(|sample_tag| normalize_value(sample_tag) == *tag)
            {
                return false;
            }
        }

        for tag in &self.excluded_tags {
            if sample
                .tags
                .iter()
                .any(|sample_tag| normalize_value(sample_tag) == *tag)
            {
                return false;
            }
        }

        true
    }

    fn push_text(&mut self, negated: bool, value: &str) {
        let normalized = normalize_value(value);
        if normalized.is_empty() {
            return;
        }
        if negated {
            self.excluded_terms.push(normalized);
        } else {
            self.text_terms.push(normalized);
        }
    }

    fn push_tag(&mut self, negated: bool, value: &str) {
        let normalized = normalize_value(value);
        if normalized.is_empty() {
            return;
        }
        if negated {
            self.excluded_tags.push(normalized);
        } else {
            self.tags.push(normalized);
        }
    }
}

fn tokenize(query: &str) -> Vec<String> {
    let mut tokens = Vec::new();
    let mut current = String::new();
    let mut in_quotes = false;

    for c in query.chars() {
        match c {
            '"' => in_quotes = !in_quotes,
            c if c.is_whitespace() && !in_quotes => {
                if !current.is_empty() {
                    tokens.push(std::mem::take(&mut current));
                }
            }
            _ => current.push(c),
        }
    }

    if !current.is_empty() {
        tokens.push(current);
    }

    tokens
}

fn parse_number_range(value: &str) -> Option<NumberRange> {
    if let Some((min, max)) = value.split_once('-') {
        let range = NumberRange {
            min: parse_number(min),
            max: parse_number(max),
        };
        return (range.min.is_some() || range.max.is_some()).then_some(range);
    }

    parse_number(value).map(|number| NumberRange {
        min: Some(number),
        max: Some(number),
    })
}

fn parse_number(value: &str) -> Option<f64> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return None;
    }
    trimmed
        .parse::<f64>()
        .ok()
        .filter(|number| number.is_finite())
}

fn matches_number_range(value: Option<f64>, range: NumberRange) -> bool {
    let Some(value) = value else {
        return false;
    };
    if let Some(min) = range.min {
        if value < min {
            return false;
        }
    }
    if let Some(max) = range.max {
        if value > max {
            return false;
        }
    }
    true
}

fn normalize_field(value: &str) -> String {
    normalize_value(value).replace(['_', '-'], "")
}

fn normalize_value(value: &str) -> String {
    value
        .chars()
        .flat_map(|c| match c {
            '\u{3000}' => ' '.to_lowercase(),
            '\u{ff01}'..='\u{ff5e}' => {
                let ascii = char::from_u32(c as u32 - 0xfee0).unwrap_or(c);
                ascii.to_lowercase()
            }
            _ => c.to_lowercase(),
        })
        .collect::<String>()
        .trim()
        .to_string()
}

fn normalize_playback_type(value: &str) -> Option<String> {
    let normalized = normalize_playback_label(value);
    match normalized.as_str() {
        "loop" | "oneshot" => Some(normalized),
        _ => None,
    }
}

fn normalize_playback_label(value: &str) -> String {
    match normalize_value(value).replace(['_', '-', ' '], "").as_str() {
        "one" | "shot" | "oneshot" => "oneshot".to_string(),
        other => other.to_string(),
    }
}

fn normalize_key(value: &str) -> Option<String> {
    let normalized = normalize_value(value);
    let without_minor = normalized.strip_suffix('m').unwrap_or(&normalized);
    let mut chars = without_minor.chars();
    let root = chars.next()?.to_ascii_uppercase();
    let suffix = chars.collect::<String>();
    let key = match suffix.as_str() {
        "" => root.to_string(),
        "#" => format!("{root}#"),
        "b" => normalize_flat_key(root)?,
        _ => return None,
    };

    matches!(
        key.as_str(),
        "C" | "C#" | "D" | "D#" | "E" | "F" | "F#" | "G" | "G#" | "A" | "A#" | "B"
    )
    .then_some(key)
}

fn normalize_flat_key(root: char) -> Option<String> {
    match root {
        'D' => Some("C#".to_string()),
        'E' => Some("D#".to_string()),
        'G' => Some("F#".to_string()),
        'A' => Some("G#".to_string()),
        'B' => Some("A#".to_string()),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample() -> SampleRow {
        SampleRow {
            id: 1,
            path: "/samples/kick.wav".to_string(),
            file_name: "metal_kick.wav".to_string(),
            duration: Some(1.0),
            bpm: Some(140.0),
            periodicity: Some(0.8),
            sample_rate: Some(44_100),
            file_size: None,
            artist: None,
            low_ratio: None,
            attack_slope: None,
            decay_time: None,
            sample_type: Some("oneshot".to_string()),
            waveform_peaks: None,
            embedding: None,
            is_online: true,
            playback_type: "oneshot".to_string(),
            instrument_type: "kick".to_string(),
            musical_key: Some("A".to_string()),
            content_hash: None,
            duplicate_count: 1,
            tags: vec!["metal".to_string(), "drums".to_string()],
        }
    }

    #[test]
    fn parses_and_matches_sample_dsl() {
        let query = SampleSearchQuery::parse("kick bpm:120-180 type:one-shot tag:metal key:Am");

        assert!(query.matches(&sample()));
    }

    #[test]
    fn excludes_negative_text_and_tags() {
        assert!(!SampleSearchQuery::parse("kick -metal").matches(&sample()));
        assert!(!SampleSearchQuery::parse("kick -tag:metal").matches(&sample()));
    }

    #[test]
    fn ignores_frontend_only_favorite_clause() {
        assert!(SampleSearchQuery::parse("favorite:true").matches(&sample()));
    }
}
