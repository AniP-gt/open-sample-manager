mod credential;
mod policy;
mod preview;
mod response;
mod search;

pub(crate) use credential::{
    credential_path, credential_status, delete_credential, read_credential, save_credential,
    CredentialStatus, FreesoundApiKey, FreesoundCredentialError,
};
pub(crate) use preview::fetch_preview;
pub(crate) use response::{FreesoundApiError, FreesoundSearchResponse};
pub(crate) use search::{api_error_for_status, search};

#[cfg(test)]
mod tests;
