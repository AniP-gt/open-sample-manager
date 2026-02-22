#[repr(C)]
pub struct SMHandle {
    _private: [u8; 0],
}

struct SMHandleInner {
    _pad: u8,
}

impl SMHandleInner {
    fn new() -> Self {
        SMHandleInner { _pad: 0 }
    }
}

#[no_mangle]
pub extern "C" fn sm_init() -> *mut SMHandle {
    let result = std::panic::catch_unwind(|| {
        let inner = Box::new(SMHandleInner::new());
        Box::into_raw(inner) as *mut SMHandle
    });
    result.unwrap_or(std::ptr::null_mut())
}

#[no_mangle]
pub extern "C" fn sm_free(handle: *mut SMHandle) {
    if handle.is_null() {
        return;
    }
    let _ = std::panic::catch_unwind(|| {
        // SAFETY: non-null pointer created by sm_init via Box::into_raw.
        unsafe {
            drop(Box::from_raw(handle as *mut SMHandleInner));
        }
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

        sm_free(handle);
    }

    #[test]
    fn sm_free_accepts_null() {

        sm_free(std::ptr::null_mut());
    }

    #[test]
    fn handle_lifecycle_roundtrip() {
        let handle = sm_init();
        assert!(!handle.is_null());

        sm_free(handle);
    }

    #[test]
    fn multiple_independent_handles() {
        let h1 = sm_init();
        let h2 = sm_init();
        assert!(!h1.is_null());
        assert!(!h2.is_null());
        assert_ne!(h1, h2, "each call to sm_init must return a unique pointer");
        sm_free(h1);
        sm_free(h2);
    }
}
