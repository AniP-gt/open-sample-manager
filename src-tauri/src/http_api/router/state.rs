use open_sample_manager_core::{SampleManager, SimilarityError};
use std::sync::{Arc, Mutex};

use crate::external_commands::UiCommandQueue;

use super::UiCommandWakeCallback;

pub(crate) enum ReadHandlerFailure {
    ManagerUnavailable,
    OperationFailed,
}

pub(crate) enum SimilarityTaskFailure {
    ManagerUnavailable,
    Similarity(SimilarityError),
}

pub(crate) enum ActionTaskFailure {
    ManagerUnavailable,
    NotFound,
    OperationFailed,
    QueueFull,
}

#[derive(Clone)]
pub struct ReadHandlerState {
    pub(crate) manager: Arc<Mutex<SampleManager>>,
    pub(crate) ui_commands: Arc<UiCommandQueue>,
    pub(crate) wake_callback: UiCommandWakeCallback,
}

impl ReadHandlerState {
    pub(crate) fn new_with_wake_callback(
        manager: Arc<Mutex<SampleManager>>,
        ui_commands: Arc<UiCommandQueue>,
        wake_callback: UiCommandWakeCallback,
    ) -> Self {
        Self {
            manager,
            ui_commands,
            wake_callback,
        }
    }
}
