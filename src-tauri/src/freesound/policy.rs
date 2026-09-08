use url::Url;

pub(crate) fn is_preview_url(url: &Url) -> bool {
    url.scheme() == "https"
        && matches!(
            url.host_str(),
            Some("cdn.freesound.org") | Some("freesound.org") | Some("www.freesound.org")
        )
        && (url.path().starts_with("/previews/") || url.path().starts_with("/data/previews/"))
}

pub(crate) fn is_license_url(url: &Url) -> bool {
    matches!(
        url.as_str(),
        "https://creativecommons.org/publicdomain/zero/1.0/"
            | "https://creativecommons.org/licenses/by/3.0/"
            | "https://creativecommons.org/licenses/by/4.0/"
            | "https://creativecommons.org/licenses/by-nc/3.0/"
            | "https://creativecommons.org/licenses/by-nc/4.0/"
            | "https://creativecommons.org/licenses/by-nc-nd/3.0/"
            | "https://creativecommons.org/licenses/by-nc-sa/3.0/"
            | "https://creativecommons.org/licenses/sampling+/1.0/"
    )
}

#[cfg(test)]
mod tests {
    use super::is_license_url;
    use url::Url;

    #[test]
    fn license_links_require_approved_creative_commons_routes() {
        assert!(is_license_url(
            &Url::parse("https://creativecommons.org/licenses/by/4.0/").expect("license URL")
        ));
        assert!(is_license_url(
            &Url::parse("https://creativecommons.org/licenses/sampling+/1.0/")
                .expect("sampling URL")
        ));
        assert!(!is_license_url(
            &Url::parse("https://creativecommons.org/licenses/sampling+/1.0")
                .expect("missing slash URL")
        ));
        assert!(!is_license_url(
            &Url::parse("https://creativecommons.org/licenses/sampling+/1.0/?source=freesound")
                .expect("query URL")
        ));
        assert!(!is_license_url(
            &Url::parse("https://example.com/licenses/by/4.0/").expect("unapproved license URL")
        ));
    }
}
