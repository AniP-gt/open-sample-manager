use serde::{Deserialize, Serialize};

use super::policy::{ProviderBrowserSurface, ProviderCloseFailure};
use super::{DownloadRoot, ProviderBounds, ProviderBoundsError, ProviderId, ProviderPolicyError};

#[path = "window_bounds.rs"]
mod bounds;
#[path = "window_closing.rs"]
mod closing;
#[path = "window_opening.rs"]
mod opening;
#[path = "window_script.rs"]
mod script;

pub(crate) use bounds::{
    go_back_provider_browser, go_forward_provider_browser, hide_provider_browser,
    set_provider_browser_bounds, show_provider_browser,
};
pub(crate) use closing::{close_all_provider_browsers, close_embedded_provider_browser};
pub(crate) use opening::open_provider_browser;

#[derive(Debug, Clone, Copy, Default, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub(crate) enum ProviderBrowserMode {
    Embedded,
    #[default]
    Window,
}

#[cfg(test)]
#[path = "window_tests/mod.rs"]
mod tests;
