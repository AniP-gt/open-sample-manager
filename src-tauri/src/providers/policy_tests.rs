use super::ProviderId;

#[test]
fn approved_navigation_url_returns_allowed_provider_page() {
    let candidate = Some("https://www.musicradar.com/music-tech/drum-machines");

    let url = ProviderId::MusicRadar.approved_navigation_url(candidate);

    assert_eq!(
        url.as_ref().map(url::Url::as_str),
        Some("https://www.musicradar.com/music-tech/drum-machines")
    );
}

#[test]
fn approved_navigation_url_rejects_unapproved_forms() {
    let provider = ProviderId::MusicRadar;
    for candidate in [
        "http://www.musicradar.com/news/tech/free-samples",
        "https://user@www.musicradar.com/news/tech/free-samples",
        "https://127.0.0.1/news/tech/free-samples",
        "https://www.musicradar.com:444/news/tech/free-samples",
        "https://www.musicradar.com/reviews/free-samples",
        "https://www.fiftysounds.com/royalty-free-music/free-sound-effects.html",
    ] {
        assert_eq!(provider.approved_navigation_url(Some(candidate)), None);
    }
}

#[test]
fn approved_navigation_url_rejects_missing_or_malformed_candidates() {
    assert_eq!(ProviderId::FiftySounds.approved_navigation_url(None), None);
    assert_eq!(
        ProviderId::FiftySounds.approved_navigation_url(Some("not a URL")),
        None
    );
}

#[test]
fn rejects_unapproved_url_forms() {
    let provider = ProviderId::MusicRadar;
    for raw in [
        "http://cdn.mos.musicradar.com/audio/samples/a.zip",
        "https://user@cdn.mos.musicradar.com/audio/samples/a.zip",
        "https://127.0.0.1/audio/samples/a.zip",
        "https://cdn.mos.musicradar.com:444/audio/samples/a.zip",
        "https://evil.test/a.zip",
    ] {
        let url = raw.parse().expect("test URL parses");
        assert!(!provider.allows_download(&url));
    }
}

#[test]
fn provider_surface_labels_are_exact_and_distinct() {
    assert_eq!(ProviderId::MusicRadar.window_label(), "provider-musicradar");
    assert_eq!(
        ProviderId::FiftySounds.window_label(),
        "provider-fiftysounds"
    );
    assert_eq!(
        ProviderId::MusicRadar.child_label(),
        "provider-child-musicradar"
    );
    assert_eq!(
        ProviderId::FiftySounds.child_label(),
        "provider-child-fiftysounds"
    );
}

#[test]
fn accepts_only_observed_musicradar_cdn_route() {
    let allowed = "https://cdn.mos.musicradar.com/audio/samples/musicradar-drums.zip"
        .parse()
        .expect("test URL parses");
    let other = "https://cdn.mos.musicradar.com/musicradar-drums.zip"
        .parse()
        .expect("test URL parses");
    assert!(ProviderId::MusicRadar.allows_download(&allowed));
    assert!(!ProviderId::MusicRadar.allows_download(&other));
}

#[test]
fn rejects_encoded_or_non_single_segment_musicradar_downloads() {
    for raw in [
        "https://cdn.mos.musicradar.com/audio/samples/nested/kit.zip",
        "https://cdn.mos.musicradar.com/audio/samples/kit%2Fescape.zip",
        "https://cdn.mos.musicradar.com/audio/samples/kit.zip?download=1",
        "https://cdn.mos.musicradar.com/audio/samples/kit.zip#download",
    ] {
        let url = raw.parse().expect("test URL parses");
        assert!(!ProviderId::MusicRadar.allows_download(&url));
    }
}

#[test]
fn accepts_only_observed_fiftysounds_music_zip_routes() {
    for raw in [
        "https://www.fiftysounds.com/music/sfx-horror5.zip",
        "https://www.fiftysounds.com/music/sfx-texture5.zip",
    ] {
        let url = raw.parse().expect("test URL parses");
        assert!(ProviderId::FiftySounds.allows_download(&url));
    }
}

#[test]
fn rejects_unapproved_fiftysounds_download_variants() {
    for raw in [
        "https://fiftysounds.com/music/sfx-horror5.zip",
        "https://www.fiftysounds.com/music/nested/sfx-horror5.zip",
        "https://www.fiftysounds.com/music/sfx-horror5.wav",
        "https://www.fiftysounds.com/music/.zip",
        "https://www.fiftysounds.com/music/sfx%2Fhorror5.zip",
        "https://www.fiftysounds.com/music/%2e%2e%2Fsfx-horror5.zip",
        "https://www.fiftysounds.com/music/sfx-horror5.zip?download=1",
        "https://www.fiftysounds.com/music/sfx-horror5.zip#download",
        "https://user@www.fiftysounds.com/music/sfx-horror5.zip",
        "https://127.0.0.1/music/sfx-horror5.zip",
        "https://preview.shutterstock.com/music/sfx-horror5.zip",
    ] {
        let url = raw.parse().expect("test URL parses");
        assert!(!ProviderId::FiftySounds.allows_download(&url));
    }
}
