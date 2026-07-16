pub mod auth;
pub mod contracts;
pub mod errors;
pub mod requests;
pub mod responses;
pub mod router;
pub mod validation;

pub(crate) use crate::external_commands;

pub use router::{build_router_with_manager_and_queue, LOCALHOST_API_HOST};

#[cfg(test)]
pub use router::build_router;

#[cfg(test)]
mod tests;
