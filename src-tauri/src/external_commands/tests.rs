use std::sync::{mpsc, Arc, Barrier, Mutex};
use std::thread;
use std::time::Duration;

use super::{NackOutcome, UiCommand, UiCommandQueue, UiCommandQueueError};

#[test]
fn queue_claims_pending_commands_without_loss_in_fifo_order() {
    // Given: commands accepted before any renderer listener exists.
    let queue = UiCommandQueue::with_capacity(3);
    queue
        .enqueue(UiCommand::ShowSamples {
            sample_ids: vec![1, 2],
            selected_id: Some(2),
        })
        .expect("first command should fit");
    queue
        .enqueue(UiCommand::PreviewSample { sample_id: 2 })
        .expect("second command should fit");

    // When: the renderer claims the pending work.
    let first_claim = queue.claim();

    // Then: FIFO order is retained in command-ID envelopes.
    assert_eq!(
        first_claim
            .iter()
            .map(|lease| lease.command.clone())
            .collect::<Vec<_>>(),
        vec![
            UiCommand::ShowSamples {
                sample_ids: vec![1, 2],
                selected_id: Some(2),
            },
            UiCommand::PreviewSample { sample_id: 2 },
        ]
    );
}

#[test]
fn queue_acknowledges_active_lease_and_releases_capacity() {
    // Given: a full queue with one claimed lease.
    let queue = UiCommandQueue::with_capacity(1);
    queue
        .enqueue(UiCommand::PreviewSample { sample_id: 2 })
        .expect("command should fit");
    let lease = queue.claim().pop().expect("command should be leased");

    // When: the renderer acknowledges the active lease.
    assert!(queue.acknowledge(lease.id));

    // Then: the lease is removed and capacity is available for the next command.
    assert!(!queue.acknowledge(lease.id));
    queue
        .enqueue(UiCommand::CollectionsChanged)
        .expect("acknowledgement should release capacity");
}

#[test]
fn queue_re_presents_an_in_flight_lease_when_acknowledgement_is_lost() {
    // Given: a command executed by a renderer whose acknowledgement response was lost.
    let queue = UiCommandQueue::with_capacity(1);
    queue
        .enqueue(UiCommand::PreviewSample { sample_id: 7 })
        .expect("command should fit");
    let first_claim = queue.claim();

    // When: the renderer reloads and claims work before it can retry the acknowledgement.
    let re_presented_claim = queue.claim();

    // Then: the same lease is safely re-presented so the renderer can idempotently acknowledge it.
    assert_eq!(first_claim.len(), 1);
    assert_eq!(re_presented_claim, first_claim);
    assert_eq!(
        re_presented_claim[0].command,
        UiCommand::PreviewSample { sample_id: 7 }
    );
}

#[test]
fn queue_rejects_overflow_without_losing_pending_or_in_flight_entries() {
    // Given: a queue filled with accepted commands.
    let queue = UiCommandQueue::with_capacity(2);
    queue
        .enqueue(UiCommand::PreviewSample { sample_id: 1 })
        .expect("first command should fit");
    queue
        .enqueue(UiCommand::CollectionsChanged)
        .expect("second command should fit");

    // When: a producer attempts one command too many.
    let error = queue.enqueue(UiCommand::PreviewSample { sample_id: 2 });

    // Then: the typed rejection is 503-mappable and accepted entries remain.
    assert_eq!(
        error,
        Err(UiCommandQueueError::QueueFull {
            size: 2,
            capacity: 2,
        })
    );
    let leases = queue.claim();
    assert_eq!(leases.len(), 2);
    assert_eq!(leases[0].command, UiCommand::PreviewSample { sample_id: 1 });
    assert_eq!(leases[1].command, UiCommand::CollectionsChanged);
}

#[test]
fn wake_failure_does_not_discard_an_accepted_command() {
    // Given: a renderer wake attempt that fails before a listener is ready.
    let queue = UiCommandQueue::with_capacity(1);

    // When: the producer accepts a command and the wake notification fails.
    let wake_result = queue
        .enqueue_with_wake(UiCommand::PreviewSample { sample_id: 99 }, || {
            Err::<(), &'static str>("listener not ready")
        })
        .expect("wake failure must not reject an accepted command");

    // Then: the queue remains the source of truth for a later claim.
    assert!(!wake_result);
    assert_eq!(
        queue.claim()[0].command,
        UiCommand::PreviewSample { sample_id: 99 }
    );
}

#[test]
fn queue_nacks_a_lost_lease_to_the_front_of_fifo_order() {
    // Given: a claimed command followed by another pending command.
    let queue = UiCommandQueue::with_capacity(2);
    queue
        .enqueue(UiCommand::PreviewSample { sample_id: 9 })
        .expect("first command should fit");
    queue
        .enqueue(UiCommand::CollectionsChanged)
        .expect("second command should fit");
    let first_claim = queue.claim();
    let lost_id = first_claim[0].id;
    assert!(queue.acknowledge(first_claim[1].id));

    // When: the renderer reports the first lease recoverably.
    assert_eq!(queue.nack(lost_id), NackOutcome::Requeued);
    let retry = queue.claim();

    // Then: the lost command returns at the front of the pending FIFO sequence.
    assert_eq!(retry[0].command, UiCommand::PreviewSample { sample_id: 9 });
}

#[test]
fn queue_discards_a_nacked_lease_after_the_retry_budget_is_exhausted() {
    // Given: one claimed command.
    let queue = UiCommandQueue::with_capacity(1);
    queue
        .enqueue(UiCommand::PreviewSample { sample_id: 9 })
        .expect("command should fit");
    let mut retry_id = queue.claim()[0].id;

    // When: the renderer nacks it through the bounded retry budget.
    for _ in 0..super::UI_COMMAND_MAX_RETRIES {
        assert_eq!(queue.nack(retry_id), NackOutcome::Requeued);
        retry_id = queue.claim()[0].id;
    }

    // Then: the next nack terminally discards the exhausted lease.
    assert_eq!(queue.nack(retry_id), NackOutcome::Discarded);
    assert!(queue.claim().is_empty());
}

#[test]
fn queue_serializes_leases_with_stable_ids_and_flattened_commands() {
    // Given: one accepted preview command.
    let queue = UiCommandQueue::with_capacity(1);
    queue
        .enqueue(UiCommand::PreviewSample { sample_id: 12 })
        .expect("command should fit");

    // When: the renderer claims and serializes the lease over Tauri IPC.
    let lease = queue.claim().pop().expect("one lease should be available");
    let value = serde_json::to_value(lease).expect("lease should serialize");

    // Then: React receives an ID alongside the existing tagged command contract.
    assert_eq!(value["id"], 0);
    assert_eq!(value["type"], "PreviewSample");
    assert_eq!(value["sample_id"], 12);
}

#[test]
fn enqueue_after_add_work_completes_while_show_holds_the_manager_guard() {
    assert_add_work_completes_while_read_action_holds_manager(UiCommand::ShowSamples {
        sample_ids: vec![1],
        selected_id: Some(1),
    });
}

#[test]
fn enqueue_after_add_work_completes_while_preview_holds_the_manager_guard() {
    assert_add_work_completes_while_read_action_holds_manager(UiCommand::PreviewSample {
        sample_id: 1,
    });
}

fn assert_add_work_completes_while_read_action_holds_manager(read_command: UiCommand) {
    // Given: an add operation and a show operation synchronized at their former lock inversion.
    let queue = Arc::new(UiCommandQueue::with_capacity(1));
    let manager = Arc::new(Mutex::new(()));
    let barrier = Arc::new(Barrier::new(2));
    let (add_done_tx, add_done_rx) = mpsc::channel();
    let (show_done_tx, show_done_rx) = mpsc::channel();

    let add_queue = Arc::clone(&queue);
    let add_manager = Arc::clone(&manager);
    let add_barrier = Arc::clone(&barrier);
    thread::spawn(move || {
        let result = add_queue.enqueue_after(UiCommand::CollectionsChanged, || {
            add_barrier.wait();
            let _manager = add_manager.lock().expect("manager lock");
            Ok::<(), ()>(())
        });
        add_done_tx.send(result).expect("send add result");
    });

    let show_queue = Arc::clone(&queue);
    let show_manager = Arc::clone(&manager);
    let show_barrier = Arc::clone(&barrier);
    thread::spawn(move || {
        let _manager = show_manager.lock().expect("manager lock");
        show_barrier.wait();
        let _ = show_queue.enqueue(read_command);
        show_done_tx.send(()).expect("send show completion");
    });

    // When: both operations acquire their first resource before attempting the second.
    let add_result = add_done_rx
        .recv_timeout(Duration::from_secs(1))
        .expect("add work must not deadlock with show");
    show_done_rx
        .recv_timeout(Duration::from_secs(1))
        .expect("show must not deadlock with add work");

    // Then: add retains its queue reservation and show observes bounded backpressure.
    assert!(add_result.is_ok());
    assert_eq!(queue.claim()[0].command, UiCommand::CollectionsChanged);
}

#[test]
fn enqueue_after_releases_reserved_capacity_when_operation_returns_error() {
    // Given: the only queue slot is reserved for a failed collection write.
    let queue = UiCommandQueue::with_capacity(1);

    // When: the operation fails before its notification is committed.
    let result = queue.enqueue_after(UiCommand::CollectionsChanged, || Err::<(), _>("failed"));

    // Then: the typed error returns and the reservation does not leak capacity.
    assert!(matches!(
        result,
        Err(super::EnqueueAfterError::Operation("failed"))
    ));
    queue
        .enqueue(UiCommand::PreviewSample { sample_id: 1 })
        .expect("failed operation must release queue capacity");
}

#[test]
fn enqueue_after_releases_reserved_capacity_when_operation_panics() {
    // Given: the only queue slot is reserved for a collection write that panics.
    let queue = UiCommandQueue::with_capacity(1);

    // When: unwinding leaves the enqueue-after operation.
    let panic = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        let _: Result<(), super::EnqueueAfterError<()>> =
            queue.enqueue_after(UiCommand::CollectionsChanged, || panic!("write panic"));
    }));

    // Then: RAII cancellation preserves the queue mutex and frees its capacity.
    assert!(panic.is_err());
    queue
        .enqueue(UiCommand::PreviewSample { sample_id: 1 })
        .expect("panicked operation must release queue capacity");
}

#[test]
fn enqueue_after_reservation_prevents_concurrent_capacity_overbooking() {
    // Given: a single-slot queue and a collection operation paused after reservation.
    let queue = Arc::new(UiCommandQueue::with_capacity(1));
    let (reserved_tx, reserved_rx) = mpsc::channel();
    let (release_tx, release_rx) = mpsc::channel();
    let operation_queue = Arc::clone(&queue);
    let operation = thread::spawn(move || {
        operation_queue.enqueue_after(UiCommand::CollectionsChanged, || {
            reserved_tx.send(()).expect("report reservation");
            release_rx.recv().expect("release reservation");
            Ok::<(), ()>(())
        })
    });
    reserved_rx
        .recv_timeout(Duration::from_secs(1))
        .expect("operation must reserve capacity");

    // When: another producer attempts to enqueue while that reservation is active.
    let overflow = queue.enqueue(UiCommand::PreviewSample { sample_id: 2 });
    release_tx.send(()).expect("release operation");
    let committed = operation.join().expect("operation thread");

    // Then: only the reserved collection notification commits and its lease remains FIFO.
    assert_eq!(
        overflow,
        Err(UiCommandQueueError::QueueFull {
            size: 1,
            capacity: 1,
        })
    );
    assert!(committed.is_ok());
    let lease = queue.claim().pop().expect("committed notification lease");
    assert_eq!(lease.command, UiCommand::CollectionsChanged);
    assert!(queue.acknowledge(lease.id));
}
