mod manifest;
mod service;

pub use service::start_local_api_with_manager_and_wake_default;
pub use service::{LocalApiDataDirectory, LocalApiRuntime};
