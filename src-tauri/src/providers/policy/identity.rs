use serde::{Deserialize, Serialize};
use url::Url;

use super::{url_policy, ProviderPolicyError};

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub(crate) enum ProviderId {
    MusicRadar,
    FiftySounds,
}

impl ProviderId {
    pub(crate) const fn window_label(self) -> &'static str {
        match self {
            Self::MusicRadar => "provider-musicradar",
            Self::FiftySounds => "provider-fiftysounds",
        }
    }

    pub(crate) const fn child_label(self) -> &'static str {
        match self {
            Self::MusicRadar => "provider-child-musicradar",
            Self::FiftySounds => "provider-child-fiftysounds",
        }
    }

    pub(crate) const fn all() -> [Self; 2] {
        [Self::MusicRadar, Self::FiftySounds]
    }

    pub(crate) fn homepage(self) -> Result<Url, ProviderPolicyError> {
        let source = match self {
            Self::MusicRadar => "https://www.musicradar.com/news/tech/free-music-samples-royalty-free-loops-hits-and-multis-to-download-sampleradar",
            Self::FiftySounds => "https://www.fiftysounds.com/royalty-free-music/free-sound-effects.html",
        };
        source
            .parse()
            .map_err(|_| ProviderPolicyError::UnapprovedUrl)
    }

    pub(crate) fn allows_navigation(self, url: &Url) -> bool {
        url_policy::matches(self, url, false)
    }

    pub(crate) fn approved_navigation_url(self, candidate: Option<&str>) -> Option<Url> {
        candidate
            .and_then(|raw| raw.parse::<Url>().ok())
            .filter(|url| self.allows_navigation(url))
    }

    pub(crate) fn allows_download(self, url: &Url) -> bool {
        url_policy::matches(self, url, true)
    }
}
