use serde::{Deserialize, Serialize};
use tauri::{LogicalPosition, LogicalSize};
use thiserror::Error;

const MAX_EMBEDDED_DIMENSION: f64 = 4096.0;

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ProviderBounds {
    pub(crate) x: f64,
    pub(crate) y: f64,
    pub(crate) width: f64,
    pub(crate) height: f64,
}

#[derive(Debug, Error, PartialEq, Eq)]
pub(crate) enum ProviderBoundsError {
    #[error("provider bounds must be finite, nonnegative, and have positive dimensions")]
    Invalid,
    #[error("provider bounds exceed the embedded browser limit")]
    TooLarge,
    #[error("provider bounds must fit inside the main window")]
    OutsideMainWindow,
}

impl ProviderBounds {
    pub(crate) fn validate_shape(self) -> Result<Self, ProviderBoundsError> {
        if ![self.x, self.y, self.width, self.height]
            .into_iter()
            .all(f64::is_finite)
            || self.x < 0.0
            || self.y < 0.0
            || self.width <= 0.0
            || self.height <= 0.0
        {
            return Err(ProviderBoundsError::Invalid);
        }
        if self.width > MAX_EMBEDDED_DIMENSION || self.height > MAX_EMBEDDED_DIMENSION {
            return Err(ProviderBoundsError::TooLarge);
        }
        Ok(self)
    }

    pub(crate) fn validate_in(
        self,
        main_size: LogicalSize<f64>,
    ) -> Result<Self, ProviderBoundsError> {
        self.validate_shape()?;
        if self.x + self.width > main_size.width || self.y + self.height > main_size.height {
            return Err(ProviderBoundsError::OutsideMainWindow);
        }
        Ok(self)
    }

    pub(crate) fn position(self) -> LogicalPosition<f64> {
        LogicalPosition::new(self.x, self.y)
    }

    pub(crate) fn size(self) -> LogicalSize<f64> {
        LogicalSize::new(self.width, self.height)
    }
}

#[cfg(test)]
mod tests {
    use super::{ProviderBounds, ProviderBoundsError};
    use tauri::LogicalSize;

    const MAIN_SIZE: LogicalSize<f64> = LogicalSize::new(1200.0, 800.0);

    #[test]
    fn accepts_contained_finite_bounds() {
        let bounds = ProviderBounds {
            x: 10.0,
            y: 20.0,
            width: 800.0,
            height: 600.0,
        };

        assert_eq!(bounds.validate_in(MAIN_SIZE), Ok(bounds));
    }

    #[test]
    fn rejects_non_finite_negative_or_empty_bounds() {
        let invalid_bounds = [
            ProviderBounds {
                x: f64::NAN,
                y: 0.0,
                width: 1.0,
                height: 1.0,
            },
            ProviderBounds {
                x: -1.0,
                y: 0.0,
                width: 1.0,
                height: 1.0,
            },
            ProviderBounds {
                x: 0.0,
                y: 0.0,
                width: 0.0,
                height: 1.0,
            },
        ];

        for bounds in invalid_bounds {
            assert_eq!(
                bounds.validate_in(MAIN_SIZE),
                Err(ProviderBoundsError::Invalid)
            );
        }
    }

    #[test]
    fn rejects_oversized_or_uncontained_bounds() {
        let oversized = ProviderBounds {
            x: 0.0,
            y: 0.0,
            width: 4097.0,
            height: 1.0,
        };
        let outside = ProviderBounds {
            x: 1000.0,
            y: 0.0,
            width: 300.0,
            height: 1.0,
        };

        assert_eq!(
            oversized.validate_in(MAIN_SIZE),
            Err(ProviderBoundsError::TooLarge)
        );
        assert_eq!(
            outside.validate_in(MAIN_SIZE),
            Err(ProviderBoundsError::OutsideMainWindow)
        );
    }
}
