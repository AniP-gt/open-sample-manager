use std::collections::{BTreeMap, VecDeque};
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};

pub const UI_COMMAND_QUEUE_CAPACITY: usize = 64;
pub const UI_COMMAND_WAKE_EVENT: &str = "osm:ui-command-queue:wake";
pub const UI_COMMAND_MAX_RETRIES: u8 = 3;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(tag = "type")]
pub enum UiCommand {
    ShowSamples {
        sample_ids: Vec<i64>,
        selected_id: Option<i64>,
    },
    PreviewSample {
        sample_id: i64,
    },
    CollectionsChanged,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq, PartialOrd, Ord, Hash)]
#[serde(transparent)]
pub struct UiCommandId(u64);

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct UiCommandLease {
    pub id: UiCommandId,
    #[serde(flatten)]
    pub command: UiCommand,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum NackOutcome {
    Requeued,
    Discarded,
    Unknown,
}

#[derive(Debug)]
struct QueuedUiCommand {
    id: UiCommandId,
    command: UiCommand,
    retries: u8,
}

#[derive(Debug)]
struct UiCommandQueueState {
    pending: VecDeque<QueuedUiCommand>,
    in_flight: BTreeMap<UiCommandId, QueuedUiCommand>,
    reserved: usize,
    next_id: u64,
}

#[derive(Debug, PartialEq, Eq)]
pub enum UiCommandQueueError {
    QueueFull { size: usize, capacity: usize },
}

pub enum EnqueueAfterError<E> {
    Queue(UiCommandQueueError),
    Operation(E),
}

impl std::fmt::Display for UiCommandQueueError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::QueueFull { size, capacity } => {
                write!(
                    f,
                    "ui command queue full (size={size}, capacity={capacity})"
                )
            }
        }
    }
}

pub struct UiCommandQueue {
    state: Mutex<UiCommandQueueState>,
    capacity: usize,
}

struct UiCommandReservation<'queue> {
    queue: &'queue UiCommandQueue,
    active: bool,
}

impl UiCommandQueue {
    pub fn with_capacity(capacity: usize) -> Self {
        Self {
            state: Mutex::new(UiCommandQueueState {
                pending: VecDeque::with_capacity(capacity),
                in_flight: BTreeMap::new(),
                reserved: 0,
                next_id: 0,
            }),
            capacity,
        }
    }

    pub fn enqueue(&self, command: UiCommand) -> Result<(), UiCommandQueueError> {
        self.reserve()?.commit(command);
        Ok(())
    }

    #[cfg(test)]
    pub fn enqueue_with_wake<F, E>(
        &self,
        command: UiCommand,
        wake_listener: F,
    ) -> Result<bool, UiCommandQueueError>
    where
        F: FnOnce() -> Result<(), E>,
    {
        self.enqueue(command)?;
        Ok(wake_listener().is_ok())
    }

    pub fn enqueue_after<T, E, F>(
        &self,
        command: UiCommand,
        operation: F,
    ) -> Result<T, EnqueueAfterError<E>>
    where
        F: FnOnce() -> Result<T, E>,
    {
        let reservation = self.reserve().map_err(EnqueueAfterError::Queue)?;
        let result = operation().map_err(EnqueueAfterError::Operation)?;
        reservation.commit(command);
        Ok(result)
    }

    fn reserve(&self) -> Result<UiCommandReservation<'_>, UiCommandQueueError> {
        let mut state = self.state.lock().expect("ui command queue mutex poisoned");
        let size = state.pending.len() + state.in_flight.len() + state.reserved;
        if size >= self.capacity {
            return Err(UiCommandQueueError::QueueFull {
                size,
                capacity: self.capacity,
            });
        }

        state.reserved += 1;
        Ok(UiCommandReservation {
            queue: self,
            active: true,
        })
    }

    fn cancel_reservation(&self) {
        let mut state = self.state.lock().expect("ui command queue mutex poisoned");
        debug_assert!(state.reserved > 0);
        state.reserved -= 1;
    }

    fn commit_reservation(&self, command: UiCommand) {
        let mut state = self.state.lock().expect("ui command queue mutex poisoned");
        debug_assert!(state.reserved > 0);
        state.reserved -= 1;
        let id = UiCommandId(state.next_id);
        state.next_id = state.next_id.wrapping_add(1);
        state.pending.push_back(QueuedUiCommand {
            id,
            command,
            retries: 0,
        });
    }

    pub fn claim(&self) -> Vec<UiCommandLease> {
        let mut state = self.state.lock().expect("ui command queue mutex poisoned");
        while let Some(entry) = state.pending.pop_front() {
            state.in_flight.insert(entry.id, entry);
        }
        state
            .in_flight
            .values()
            .map(|entry| UiCommandLease {
                id: entry.id,
                command: entry.command.clone(),
            })
            .collect()
    }

    pub fn acknowledge(&self, id: UiCommandId) -> bool {
        self.state
            .lock()
            .expect("ui command queue mutex poisoned")
            .in_flight
            .remove(&id)
            .is_some()
    }

    pub fn nack(&self, id: UiCommandId) -> NackOutcome {
        let mut state = self.state.lock().expect("ui command queue mutex poisoned");
        let Some(mut entry) = state.in_flight.remove(&id) else {
            return NackOutcome::Unknown;
        };
        if entry.retries >= UI_COMMAND_MAX_RETRIES {
            return NackOutcome::Discarded;
        }

        entry.retries += 1;
        state.pending.push_front(entry);
        NackOutcome::Requeued
    }
}

impl UiCommandReservation<'_> {
    fn commit(mut self, command: UiCommand) {
        self.queue.commit_reservation(command);
        self.active = false;
    }
}

impl Drop for UiCommandReservation<'_> {
    fn drop(&mut self) {
        if self.active {
            self.queue.cancel_reservation();
        }
    }
}

pub fn emit_ui_command_wake(app: &AppHandle) -> bool {
    app.emit(UI_COMMAND_WAKE_EVENT, ()).is_ok()
}

#[cfg(test)]
#[path = "external_commands/tests.rs"]
mod tests;
