use std::sync::atomic::{AtomicBool, Ordering};

use crate::manager::SampleManager;

/// Opaque C-compatible handle for Open Sample Manager instances.
///
/// This is a zero-sized marker type for FFI safety. The actual handle
/// data is stored as a heap-allocated `SMHandleInner` and accessed via raw pointers.
#[repr(C)]
pub struct SMHandle {
    _private: [u8; 0],
}

pub(crate) struct SMHandleInner {
    pub(crate) manager: SampleManager,
    freed: AtomicBool,
}

impl SMHandleInner {
    fn new(manager: SampleManager) -> Self {
        SMHandleInner {
            manager,
            freed: AtomicBool::new(false),
        }
    }

    /// Mark as freed. Returns `true` if this is the first call (safe to drop),
    /// `false` if already freed (double-free detected).
    pub(crate) fn mark_freed(&self) -> bool {
        self.freed
            .compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire)
            .is_ok()
    }
}

/// Recover a reference to the inner handle from a raw `SMHandle` pointer.
///
/// # Safety
/// `handle` must be a valid, non-null pointer created by `sm_init` that has
/// not yet been freed.
pub(crate) unsafe fn inner_ref<'a>(handle: *mut SMHandle) -> &'a SMHandleInner {
    unsafe { &*(handle.cast::<SMHandleInner>()) }
}

/// Initialize a new Open Sample Manager handle.
///
/// Allocates and initializes a new manager instance with an in-memory database.
/// The handle must be freed later using `sm_free()` to avoid memory leaks.
///
/// # Returns
/// A non-null opaque handle pointer, or null on allocation failure.
///
/// # Panics
/// Returns null instead of panicking, making it safe to call from C code.
#[no_mangle]
pub extern "C" fn sm_init() -> *mut SMHandle {
    let result = std::panic::catch_unwind(|| {
        let Ok(manager) = SampleManager::new(None) else {
            return std::ptr::null_mut();
        };
        let inner = Box::new(SMHandleInner::new(manager));
        Box::into_raw(inner).cast::<SMHandle>()
    });
    result.unwrap_or(std::ptr::null_mut())
}

/// Free an Open Sample Manager handle.
///
/// Deallocates the manager instance and invalidates the handle.
/// It is safe to pass null or a handle created by `sm_init()`.
/// Double-free is detected and safely ignored.
///
/// # Arguments
/// * `handle` - Handle to free (can be null)
///
/// # Safety
/// Do not call this with a handle from other sources.
#[no_mangle]
pub unsafe extern "C" fn sm_free(handle: *mut SMHandle) {
    if handle.is_null() {
        return;
    }
    let _ = std::panic::catch_unwind(|| {
        // SAFETY: non-null pointer created by sm_init via Box::into_raw.
        // Check the AtomicBool flag before dropping to prevent double-free.
        let inner_ptr = handle.cast::<SMHandleInner>();
        let inner_ref = unsafe { &*inner_ptr };
        if inner_ref.mark_freed() {
            // First free — safe to drop.
            unsafe {
                drop(Box::from_raw(inner_ptr));
            }
        }
        // else: double-free detected — silently ignore.
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sm_init_returns_non_null() {
        let handle = sm_init();
        assert!(
            !handle.is_null(),
            "sm_init() must return a non-null pointer"
        );

        unsafe { sm_free(handle) };
    }

    #[test]
    fn sm_free_accepts_null() {
        unsafe { sm_free(std::ptr::null_mut()) };
    }

    #[test]
    fn handle_lifecycle_roundtrip() {
        let handle = sm_init();
        assert!(!handle.is_null());

        unsafe { sm_free(handle) };
    }

    #[test]
    fn multiple_independent_handles() {
        let h1 = sm_init();
        let h2 = sm_init();
        assert!(!h1.is_null());
        assert!(!h2.is_null());
        assert_ne!(h1, h2, "each call to sm_init must return a unique pointer");
        unsafe { sm_free(h1) };
        unsafe { sm_free(h2) };
    }

    #[test]
    fn double_free_flag_detected() {
        let inner = SMHandleInner::new(SampleManager::new(None).expect("create manager"));
        assert!(inner.mark_freed(), "first mark_freed should return true");
        assert!(
            !inner.mark_freed(),
            "second mark_freed should return false (double-free detected)"
        );
    }
}
