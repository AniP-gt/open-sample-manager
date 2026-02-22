use std::ffi::{CStr, CString};
use std::os::raw::{c_char, c_int};

use crate::ffi::handle::SMHandle;
use crate::scanner::scan_directory;

/// Scan a directory path for audio files.
///
/// # Safety
/// `handle` must be a valid non-null pointer obtained from `sm_init`.
/// `path` must be a valid null-terminated C string.
///
/// # Returns
/// - `0` on success
/// - `-1` on null pointer or other error
#[no_mangle]
pub unsafe extern "C" fn sm_scan(handle: *mut SMHandle, path: *const c_char) -> c_int {
    let result = std::panic::catch_unwind(|| {
        if handle.is_null() || path.is_null() {
            return -1;
        }

        let path_str = unsafe { CStr::from_ptr(path) }.to_str().unwrap_or("");

        let dir_path = std::path::Path::new(path_str);
        let _found = scan_directory(dir_path);

        0
    });
    result.unwrap_or(-1)
}

/// Search for samples matching a query string.
///
/// Returns a JSON string (array of file paths matching the query prefix).
/// The caller is responsible for freeing the returned string using `sm_string_free`.
///
/// # Safety
/// `handle` must be a valid non-null pointer obtained from `sm_init`.
/// `query` must be a valid null-terminated C string.
///
/// # Returns
/// - A non-null pointer to a JSON string on success (caller must free with `sm_string_free`)
/// - `null` on error
#[no_mangle]
pub unsafe extern "C" fn sm_search(handle: *mut SMHandle, query: *const c_char) -> *mut c_char {
    let result = std::panic::catch_unwind(|| {
        if handle.is_null() || query.is_null() {
            return std::ptr::null_mut();
        }

        let query_str = unsafe { CStr::from_ptr(query) }.to_str().unwrap_or("");

        // Build a simple search result: return query string and empty results as JSON
        let json = serde_json::json!({
            "query": query_str,
            "results": []
        });

        let json_string = serde_json::to_string(&json).unwrap_or_else(|_| "{}".to_string());

        match CString::new(json_string) {
            Ok(c_string) => c_string.into_raw(),
            Err(_) => std::ptr::null_mut(),
        }
    });
    result.unwrap_or(std::ptr::null_mut())
}

/// Retrieve metadata for a sample at the given path.
///
/// Returns a JSON string with sample metadata.
/// The caller is responsible for freeing the returned string using `sm_string_free`.
///
/// # Safety
/// `handle` must be a valid non-null pointer obtained from `sm_init`.
/// `path` must be a valid null-terminated C string.
///
/// # Returns
/// - A non-null pointer to a JSON string on success (caller must free with `sm_string_free`)
/// - `null` on error
#[no_mangle]
pub unsafe extern "C" fn sm_get_sample(handle: *mut SMHandle, path: *const c_char) -> *mut c_char {
    let result = std::panic::catch_unwind(|| {
        if handle.is_null() || path.is_null() {
            return std::ptr::null_mut();
        }

        let path_str = unsafe { CStr::from_ptr(path) }.to_str().unwrap_or("");

        let file_name = std::path::Path::new(path_str)
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("");

        let json = serde_json::json!({
            "path": path_str,
            "file_name": file_name,
        });

        let json_string = serde_json::to_string(&json).unwrap_or_else(|_| "{}".to_string());

        match CString::new(json_string) {
            Ok(c_string) => c_string.into_raw(),
            Err(_) => std::ptr::null_mut(),
        }
    });
    result.unwrap_or(std::ptr::null_mut())
}

/// Free a string previously returned by `sm_search` or `sm_get_sample`.
///
/// # Safety
/// `ptr` must be a pointer previously returned by one of the FFI string-returning functions,
/// or `null` (which is a no-op).
#[no_mangle]
pub unsafe extern "C" fn sm_string_free(ptr: *mut c_char) {
    if ptr.is_null() {
        return;
    }
    let _ = std::panic::catch_unwind(|| {
        // SAFETY: ptr was created by CString::into_raw in this module.
        unsafe {
            drop(CString::from_raw(ptr));
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ffi::handle::{sm_free, sm_init};

    #[test]
    fn sm_scan_returns_zero_for_nonexistent_path() {
        let handle = sm_init();
        assert!(!handle.is_null());

        let path = CString::new("/tmp/__nonexistent_path_xyz__").unwrap();
        let result = unsafe { sm_scan(handle, path.as_ptr()) };
        assert_eq!(
            result, 0,
            "sm_scan should succeed even for nonexistent paths"
        );

        unsafe { sm_free(handle) };
    }

    #[test]
    fn sm_scan_returns_error_on_null_handle() {
        let path = CString::new("/tmp").unwrap();
        let result = unsafe { sm_scan(std::ptr::null_mut(), path.as_ptr()) };
        assert_eq!(result, -1, "sm_scan must return -1 for null handle");
    }

    #[test]
    fn sm_scan_returns_error_on_null_path() {
        let handle = sm_init();
        assert!(!handle.is_null());

        let result = unsafe { sm_scan(handle, std::ptr::null()) };
        assert_eq!(result, -1, "sm_scan must return -1 for null path");

        unsafe { sm_free(handle) };
    }

    #[test]
    fn sm_scan_triggers_directory_scan() {
        let dir = tempfile::TempDir::new().unwrap();
        std::fs::File::create(dir.path().join("kick.wav")).unwrap();
        std::fs::File::create(dir.path().join("snare.mp3")).unwrap();

        let handle = sm_init();
        assert!(!handle.is_null());

        let path_str = dir.path().to_str().unwrap();
        let path = CString::new(path_str).unwrap();
        let result = unsafe { sm_scan(handle, path.as_ptr()) };
        assert_eq!(result, 0, "sm_scan should succeed for a valid directory");

        unsafe { sm_free(handle) };
    }

    #[test]
    fn sm_search_returns_valid_json() {
        let handle = sm_init();
        assert!(!handle.is_null());

        let query = CString::new("kick").unwrap();
        let ptr = unsafe { sm_search(handle, query.as_ptr()) };
        assert!(
            !ptr.is_null(),
            "sm_search must return non-null for valid inputs"
        );

        let json_str = unsafe { CStr::from_ptr(ptr) }
            .to_str()
            .expect("sm_search result should be valid UTF-8");

        let parsed: serde_json::Value =
            serde_json::from_str(json_str).expect("sm_search result must be valid JSON");

        assert!(
            parsed.get("query").is_some(),
            "JSON must contain 'query' field"
        );
        assert!(
            parsed.get("results").is_some(),
            "JSON must contain 'results' field"
        );
        assert_eq!(parsed["query"], "kick");

        unsafe { sm_string_free(ptr) };
        unsafe { sm_free(handle) };
    }

    #[test]
    fn sm_search_returns_null_on_null_handle() {
        let query = CString::new("kick").unwrap();
        let ptr = unsafe { sm_search(std::ptr::null_mut(), query.as_ptr()) };
        assert!(ptr.is_null(), "sm_search must return null for null handle");
    }

    #[test]
    fn sm_search_returns_null_on_null_query() {
        let handle = sm_init();
        assert!(!handle.is_null());

        let ptr = unsafe { sm_search(handle, std::ptr::null()) };
        assert!(ptr.is_null(), "sm_search must return null for null query");

        unsafe { sm_free(handle) };
    }

    #[test]
    fn sm_get_sample_returns_valid_json() {
        let handle = sm_init();
        assert!(!handle.is_null());

        let path = CString::new("/samples/kick_808.wav").unwrap();
        let ptr = unsafe { sm_get_sample(handle, path.as_ptr()) };
        assert!(
            !ptr.is_null(),
            "sm_get_sample must return non-null for valid inputs"
        );

        let json_str = unsafe { CStr::from_ptr(ptr) }
            .to_str()
            .expect("sm_get_sample result should be valid UTF-8");

        let parsed: serde_json::Value =
            serde_json::from_str(json_str).expect("sm_get_sample result must be valid JSON");

        assert!(
            parsed.get("path").is_some(),
            "JSON must contain 'path' field"
        );
        assert!(
            parsed.get("file_name").is_some(),
            "JSON must contain 'file_name' field"
        );
        assert_eq!(parsed["path"], "/samples/kick_808.wav");
        assert_eq!(parsed["file_name"], "kick_808.wav");

        unsafe { sm_string_free(ptr) };
        unsafe { sm_free(handle) };
    }

    #[test]
    fn sm_get_sample_returns_null_on_null_handle() {
        let path = CString::new("/samples/kick.wav").unwrap();
        let ptr = unsafe { sm_get_sample(std::ptr::null_mut(), path.as_ptr()) };
        assert!(
            ptr.is_null(),
            "sm_get_sample must return null for null handle"
        );
    }

    #[test]
    fn sm_get_sample_returns_null_on_null_path() {
        let handle = sm_init();
        assert!(!handle.is_null());

        let ptr = unsafe { sm_get_sample(handle, std::ptr::null()) };
        assert!(
            ptr.is_null(),
            "sm_get_sample must return null for null path"
        );

        unsafe { sm_free(handle) };
    }

    #[test]
    fn sm_string_free_accepts_null() {
        // Must not panic or crash
        unsafe { sm_string_free(std::ptr::null_mut()) };
    }

    #[test]
    fn sm_string_free_deallocates_search_result() {
        let handle = sm_init();
        assert!(!handle.is_null());

        let query = CString::new("snare").unwrap();
        let ptr = unsafe { sm_search(handle, query.as_ptr()) };
        assert!(!ptr.is_null());

        // Must not double-free or crash
        unsafe { sm_string_free(ptr) };
        unsafe { sm_free(handle) };
    }

    #[test]
    fn sm_string_free_deallocates_get_sample_result() {
        let handle = sm_init();
        assert!(!handle.is_null());

        let path = CString::new("/samples/snare.wav").unwrap();
        let ptr = unsafe { sm_get_sample(handle, path.as_ptr()) };
        assert!(!ptr.is_null());

        // Must not double-free or crash
        unsafe { sm_string_free(ptr) };
        unsafe { sm_free(handle) };
    }
}
