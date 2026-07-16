use serde::{Deserialize, Serialize};

use super::requests::ApiOperation;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ErrorCode {
    InvalidRequest,
    Unauthorized,
    Forbidden,
    NotFound,
    Duplicate,
    PayloadTooLarge,
    ServiceUnavailable,
    InternalError,
}

impl ErrorCode {
    pub const fn http_status(self) -> u16 {
        match self {
            Self::InvalidRequest => 400,
            Self::Unauthorized => 401,
            Self::Forbidden => 403,
            Self::NotFound => 404,
            Self::Duplicate => 409,
            Self::PayloadTooLarge => 413,
            Self::ServiceUnavailable => 503,
            Self::InternalError => 500,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ApiError {
    pub request_id: String,
    pub operation: ApiOperation,
    pub code: ErrorCode,
    pub message: String,
    pub details: Option<String>,
}

impl ApiError {
    pub fn invalid_request(request_id: &str, operation: ApiOperation, message: &str) -> Self {
        Self::new(request_id, operation, ErrorCode::InvalidRequest, message)
    }

    pub fn unauthorized(request_id: &str, operation: ApiOperation, message: &str) -> Self {
        Self::new(request_id, operation, ErrorCode::Unauthorized, message)
    }

    #[cfg(test)]
    pub fn forbidden(request_id: &str, operation: ApiOperation, message: &str) -> Self {
        Self::new(request_id, operation, ErrorCode::Forbidden, message)
    }

    pub fn not_found(request_id: &str, operation: ApiOperation, message: &str) -> Self {
        Self::new(request_id, operation, ErrorCode::NotFound, message)
    }

    pub fn duplicate(request_id: &str, operation: ApiOperation, message: &str) -> Self {
        Self::new(request_id, operation, ErrorCode::Duplicate, message)
    }

    pub fn payload_too_large(request_id: &str, operation: ApiOperation, message: &str) -> Self {
        Self::new(request_id, operation, ErrorCode::PayloadTooLarge, message)
    }

    pub fn service_unavailable(request_id: &str, operation: ApiOperation, message: &str) -> Self {
        Self::new(
            request_id,
            operation,
            ErrorCode::ServiceUnavailable,
            message,
        )
    }

    pub fn internal_error(request_id: &str, operation: ApiOperation, message: &str) -> Self {
        Self::new(request_id, operation, ErrorCode::InternalError, message)
    }

    pub const fn status(&self) -> u16 {
        self.code.http_status()
    }

    fn new(request_id: &str, operation: ApiOperation, code: ErrorCode, message: &str) -> Self {
        Self {
            request_id: request_id.to_owned(),
            operation,
            code,
            message: message.to_owned(),
            details: None,
        }
    }
}
