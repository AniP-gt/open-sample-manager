pub(super) fn matches_fuzzy_query(query: &str, targets: &[&str]) -> bool {
    let terms = query_terms(query);
    if terms.is_empty() {
        return true;
    }

    let normalized_targets = targets
        .iter()
        .filter(|target| !target.is_empty())
        .map(|target| normalize_search_text(target))
        .collect::<Vec<_>>();

    if normalized_targets.is_empty() {
        return false;
    }

    terms.iter().all(|term| {
        normalized_targets
            .iter()
            .any(|target| is_subsequence(term, target))
    })
}

fn query_terms(query: &str) -> Vec<String> {
    normalize_search_text(query)
        .split_whitespace()
        .map(str::to_string)
        .collect()
}

fn normalize_search_text(text: &str) -> String {
    text.chars().flat_map(normalize_char).collect()
}

fn normalize_char(c: char) -> std::char::ToLowercase {
    match c {
        '\u{3000}' => ' '.to_lowercase(),
        '\u{ff01}'..='\u{ff5e}' => {
            let ascii = char::from_u32(c as u32 - 0xfee0).unwrap_or(c);
            ascii.to_lowercase()
        }
        _ => c.to_lowercase(),
    }
}

fn is_subsequence(term: &str, target: &str) -> bool {
    let mut term_chars = term.chars();
    let Some(mut wanted) = term_chars.next() else {
        return true;
    };

    for candidate in target.chars() {
        if candidate == wanted {
            match term_chars.next() {
                Some(next) => wanted = next,
                None => return true,
            }
        }
    }

    false
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn blank_query_matches_everything() {
        assert!(matches_fuzzy_query("", &["Kick Drum"]));
        assert!(matches_fuzzy_query("   ", &["Kick Drum"]));
        assert!(matches_fuzzy_query("\u{3000}", &["Kick Drum"]));
    }

    #[test]
    fn terms_match_as_ordered_subsequences_across_targets() {
        assert!(matches_fuzzy_query("kdm", &["Kick Drum"]));
        assert!(matches_fuzzy_query("kick loop", &["Kick", "Loop Pack"]));
        assert!(!matches_fuzzy_query("kdk", &["Kick Drum"]));
        assert!(!matches_fuzzy_query("kick sample", &["Kick", "Loop Pack"]));
    }

    #[test]
    fn normalizes_case_full_width_ascii_and_full_width_spaces() {
        assert!(matches_fuzzy_query("ＫＩＣＫ", &["kick"]));
        assert!(matches_fuzzy_query("kick", &["ｋｉｃｋ"]));
        assert!(matches_fuzzy_query(
            "kick\u{3000}loop",
            &["Kick", "Loop Pack"]
        ));
    }
}
