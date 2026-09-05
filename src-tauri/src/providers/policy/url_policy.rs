use url::{Host, Url};

use super::ProviderId;

pub(super) fn matches(provider: ProviderId, url: &Url, download: bool) -> bool {
    if url.scheme() != "https"
        || url.port_or_known_default() != Some(443)
        || !url.username().is_empty()
        || url.password().is_some()
    {
        return false;
    }
    let Some(Host::Domain(host)) = url.host() else {
        return false;
    };
    match (provider, download, host, url.path()) {
        (ProviderId::MusicRadar, false, "www.musicradar.com", path) => {
            path.starts_with("/news/") || path.starts_with("/music-tech/")
        }
        (ProviderId::MusicRadar, true, "cdn.mos.musicradar.com", path) => {
            is_musicradar_zip(url, path)
        }
        (ProviderId::FiftySounds, false, "www.fiftysounds.com", path) => {
            path.starts_with("/royalty-free-music/")
        }
        (ProviderId::FiftySounds, true, "www.fiftysounds.com", path) => {
            is_fiftysounds_zip(url, path)
        }
        _ => false,
    }
}

fn is_musicradar_zip(url: &Url, path: &str) -> bool {
    valid_zip_filename(url, path, "/audio/samples/")
}

fn is_fiftysounds_zip(url: &Url, path: &str) -> bool {
    valid_zip_filename(url, path, "/music/")
}

fn valid_zip_filename(url: &Url, path: &str, prefix: &str) -> bool {
    if url.query().is_some() || url.fragment().is_some() || path.contains('%') {
        return false;
    }
    let Some(filename) = path.strip_prefix(prefix) else {
        return false;
    };
    filename.strip_suffix(".zip").is_some_and(|stem| {
        !stem.is_empty()
            && !filename.contains('/')
            && stem
                .bytes()
                .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_' | b'.'))
    })
}
