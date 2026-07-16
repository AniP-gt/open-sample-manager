use std::collections::HashSet;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use open_sample_manager_core::SampleManager;

use crate::external_commands::{NackOutcome, UiCommandId, UiCommandLease, UiCommandQueue};
#[cfg(test)]
use crate::external_commands::{UiCommand, UiCommandQueueError};

pub type PreparedTempRegistry = Arc<Mutex<HashSet<PathBuf>>>;

pub struct AppRuntimeState {
    pub prepared_temp_paths: PreparedTempRegistry,
    pub timidity_pid: Arc<Mutex<Option<u32>>>,
    pub temp_midi_preview_file: Arc<Mutex<Option<tempfile::NamedTempFile>>>,
}

impl AppRuntimeState {
    pub fn new(
        prepared_temp_paths: PreparedTempRegistry,
        timidity_pid: Arc<Mutex<Option<u32>>>,
        temp_midi_preview_file: Arc<Mutex<Option<tempfile::NamedTempFile>>>,
    ) -> Self {
        Self {
            prepared_temp_paths,
            timidity_pid,
            temp_midi_preview_file,
        }
    }
}

pub struct AppState {
    pub manager: Arc<Mutex<SampleManager>>,
    pub prepared_temp_paths: PreparedTempRegistry,
    pub timidity_pid: Arc<Mutex<Option<u32>>>,
    pub temp_midi_preview_file: Arc<Mutex<Option<tempfile::NamedTempFile>>>,
    ui_commands: Arc<UiCommandQueue>,
}

impl AppState {
    pub fn new(manager: SampleManager, runtime: AppRuntimeState, queue_capacity: usize) -> Self {
        Self {
            manager: Arc::new(Mutex::new(manager)),
            prepared_temp_paths: runtime.prepared_temp_paths,
            timidity_pid: runtime.timidity_pid,
            temp_midi_preview_file: runtime.temp_midi_preview_file,
            ui_commands: Arc::new(UiCommandQueue::with_capacity(queue_capacity)),
        }
    }

    pub fn with_defaults(manager: SampleManager, runtime: AppRuntimeState) -> Self {
        Self::new(
            manager,
            runtime,
            crate::external_commands::UI_COMMAND_QUEUE_CAPACITY,
        )
    }

    pub fn lock_manager(&self) -> std::sync::MutexGuard<'_, SampleManager> {
        self.manager.lock().expect("AppState mutex poisoned")
    }

    #[cfg(test)]
    pub fn enqueue_ui_command(&self, command: UiCommand) -> Result<(), UiCommandQueueError> {
        self.ui_commands.enqueue(command)
    }

    pub fn ui_command_queue(&self) -> Arc<UiCommandQueue> {
        Arc::clone(&self.ui_commands)
    }

    pub fn claim_ui_commands(&self) -> Vec<UiCommandLease> {
        self.ui_commands.claim()
    }

    pub fn acknowledge_ui_command(&self, id: UiCommandId) -> bool {
        self.ui_commands.acknowledge(id)
    }

    pub fn nack_ui_command(&self, id: UiCommandId) -> NackOutcome {
        self.ui_commands.nack(id)
    }
}

#[cfg(test)]
impl AppState {
    pub fn test_with_capacity(capacity: usize) -> Self {
        let manager =
            SampleManager::new(None).expect("in-memory manager for tests should be created");
        let runtime = AppRuntimeState::new(
            Arc::new(Mutex::new(HashSet::new())),
            Arc::new(Mutex::new(None)),
            Arc::new(Mutex::new(None)),
        );
        Self::new(manager, runtime, capacity)
    }
}

#[cfg(test)]
mod tests {
    use super::AppState;
    use crate::external_commands::UiCommand;

    #[test]
    fn app_state_preserves_manager_access() {
        let state = AppState::test_with_capacity(1);

        let samples = state
            .lock_manager()
            .list_samples_paginated(10, 0, None)
            .expect("in-memory manager remains usable through AppState");

        assert!(samples.is_empty());
    }

    #[test]
    fn app_state_claims_show_then_preview_in_order() {
        let state = AppState::test_with_capacity(2);
        state
            .enqueue_ui_command(UiCommand::ShowSamples {
                sample_ids: vec![7, 3],
                selected_id: Some(3),
            })
            .expect("show command should remain queued before renderer readiness");
        state
            .enqueue_ui_command(UiCommand::PreviewSample { sample_id: 3 })
            .expect("preview command should remain queued before renderer readiness");

        assert_eq!(
            state
                .claim_ui_commands()
                .into_iter()
                .map(|lease| lease.command)
                .collect::<Vec<_>>(),
            vec![
                UiCommand::ShowSamples {
                    sample_ids: vec![7, 3],
                    selected_id: Some(3),
                },
                UiCommand::PreviewSample { sample_id: 3 }
            ]
        );
    }
}
