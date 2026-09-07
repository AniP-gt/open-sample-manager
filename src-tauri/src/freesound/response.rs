use std::fmt;

use serde::{Deserialize, Serialize};
use url::Url;

use super::{
    policy::{is_license_url, is_preview_url},
    FreesoundCredentialError,
};

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct FreesoundSearchResponse {
    pub page: u32,
    pub page_size: u8,
    pub total_count: u64,
    pub has_previous: bool,
    pub has_next: bool,
    pub sounds: Vec<FreesoundSound>,
}

#[derive(Debug, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct FreesoundSound {
    pub id: u64,
    pub name: String,
    pub uploader: String,
    pub license: String,
    pub license_url: String,
    pub page_url: String,
    pub preview_url: String,
}

#[derive(Debug)]
pub(crate) enum FreesoundApiError {
    Credential(FreesoundCredentialError),
    InvalidQuery,
    InvalidPage,
    InvalidPreviewUrl,
    Unauthorized,
    RateLimited,
    Request,
    Response,
    TooLarge,
}

impl fmt::Display for FreesoundApiError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::Credential(_) => formatter.write_str("Freesound credentials are unavailable"),
            Self::InvalidQuery => formatter.write_str("Freesound search query is invalid"),
            Self::InvalidPage => formatter.write_str("Freesound search page is invalid"),
            Self::InvalidPreviewUrl => formatter.write_str("Freesound preview URL is not approved"),
            Self::Unauthorized => formatter.write_str("Freesound rejected the API key"),
            Self::RateLimited => formatter.write_str("Freesound is rate limiting requests"),
            Self::Request => formatter.write_str("Freesound request failed"),
            Self::Response => formatter.write_str("Freesound returned an invalid response"),
            Self::TooLarge => formatter.write_str("Freesound preview exceeds the size limit"),
        }
    }
}

impl std::error::Error for FreesoundApiError {}

#[derive(Deserialize)]
pub(super) struct SearchBody {
    count: u64,
    next: Option<String>,
    previous: Option<String>,
    results: Vec<SoundBody>,
}

#[derive(Deserialize)]
struct SoundBody {
    id: u64,
    name: String,
    username: String,
    license: String,
    previews: PreviewBody,
}

#[derive(Deserialize)]
struct PreviewBody {
    #[serde(rename = "preview-hq-mp3")]
    hq_mp3: Option<String>,
    #[serde(rename = "preview-lq-mp3")]
    lq_mp3: Option<String>,
    #[serde(rename = "preview-hq-ogg")]
    _hq_ogg: Option<String>,
    #[serde(rename = "preview-lq-ogg")]
    _lq_ogg: Option<String>,
}

impl SearchBody {
    pub(super) fn into_public(
        self,
        page: u32,
        page_size: u8,
    ) -> Result<FreesoundSearchResponse, FreesoundApiError> {
        let sounds = self
            .results
            .into_iter()
            .map(SoundBody::into_public)
            .collect::<Result<_, _>>()?;
        Ok(FreesoundSearchResponse {
            page,
            page_size,
            total_count: self.count,
            has_previous: self.previous.is_some(),
            has_next: self.next.is_some(),
            sounds,
        })
    }
}

impl SoundBody {
    fn into_public(self) -> Result<FreesoundSound, FreesoundApiError> {
        let preview_url = self
            .previews
            .hq_mp3
            .or(self.previews.lq_mp3)
            .ok_or(FreesoundApiError::Response)?;
        let url = preview_url
            .parse::<Url>()
            .map_err(|_| FreesoundApiError::Response)?;
        if !is_preview_url(&url) {
            return Err(FreesoundApiError::Response);
        }
        let license_url = self.license.replacen(
            "http://creativecommons.org/",
            "https://creativecommons.org/",
            1,
        );
        let license = license_url
            .parse::<Url>()
            .map_err(|_| FreesoundApiError::Response)?;
        if !is_license_url(&license) {
            return Err(FreesoundApiError::Response);
        }
        Ok(FreesoundSound {
            id: self.id,
            name: self.name,
            uploader: self.username,
            license: license_label(&license_url).to_owned(),
            license_url,
            page_url: format!("https://freesound.org/s/{}/", self.id),
            preview_url,
        })
    }
}

fn license_label(license_url: &str) -> &str {
    match license_url {
        "https://creativecommons.org/publicdomain/zero/1.0/" => "CC0",
        "https://creativecommons.org/licenses/by/3.0/" => "CC BY 3.0",
        "https://creativecommons.org/licenses/by/4.0/" => "CC BY 4.0",
        "https://creativecommons.org/licenses/by-nc/3.0/" => "CC BY-NC 3.0",
        "https://creativecommons.org/licenses/by-nc/4.0/" => "CC BY-NC 4.0",
        "https://creativecommons.org/licenses/by-nc-nd/3.0/" => "CC BY-NC-ND 3.0",
        "https://creativecommons.org/licenses/by-nc-sa/3.0/" => "CC BY-NC-SA 3.0",
        _ => license_url,
    }
}
