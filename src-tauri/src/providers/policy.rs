use thiserror::Error;

mod identity;
mod url_policy;

pub(crate) use identity::ProviderId;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum ProviderBrowserSurface {
    Embedded,
    Window,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct ProviderCloseFailure {
    provider: ProviderId,
    surface: ProviderBrowserSurface,
}

impl ProviderCloseFailure {
    pub(crate) const fn new(provider: ProviderId, surface: ProviderBrowserSurface) -> Self {
        Self { provider, surface }
    }
}

#[derive(Debug, Error, PartialEq, Eq)]
pub(crate) enum ProviderPolicyError {
    #[error("provider URL is not an approved HTTPS endpoint")]
    UnapprovedUrl,
    #[error("provider browser bounds are invalid")]
    InvalidBounds,
    #[error("the requested provider browser surface is unavailable")]
    SurfaceUnavailable,
    #[error("embedded provider browser bounds are required")]
    MissingEmbeddedBounds,
    #[error("failed to close one or more provider browser surfaces: {0:?}")]
    CloseAllFailed(Vec<ProviderCloseFailure>),
}

#[cfg(test)]
#[path = "policy_tests.rs"]
mod tests;
