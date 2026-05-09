# CORE FFI

**Generated:** 2026-05-09T22:22:11+0900
**Commit:** a14778f

## OVERVIEW
C ABI boundary for future plugin/native consumers. Owns opaque manager handles, null-safe calls, JSON string returns, and explicit string/handle frees.

## WHERE TO LOOK
| Task | Location | Notes |
|---|---|---|
| Opaque handle type | `handle.rs` | `SMHandle`, `SMHandleInner`, `inner_ref` |
| Init/free | `handle.rs` | `sm_init`, `sm_free`, atomic double-free flag |
| C functions | `functions.rs` | `sm_scan`, `sm_search`, `sm_get_sample`, `sm_string_free` |
| Exports | `mod.rs` | Module boundary |

## CONVENTIONS
- All raw-pointer dereference lives here and is wrapped in small unsafe blocks.
- Every exported function catches unwinds and returns C-safe sentinel values.
- Null handles/strings return `-1` or null, not panic.
- Returned JSON strings are allocated with `CString::into_raw`; callers must use `sm_string_free`.
- `sm_free` may accept null or handles from `sm_init`; it must not accept foreign pointers.

## ANTI-PATTERNS
- Do not expose borrowed Rust memory across FFI.
- Do not make C callers free Rust strings with `free()` or another allocator.
- Do not remove double-free detection from `SMHandleInner`.
- Do not call `inner_ref` before null validation.
- Do not add unsafe code to non-FFI core modules to serve FFI convenience.

## COMMANDS
```bash
cargo test -p open-sample-manager-core ffi
```

## NOTES
- `sm_scan` returns success for nonexistent directories because core scanning returns an empty result, not an error.
- `sm_search` returns a JSON object with query/results; `sm_get_sample` returns row JSON or `{ found: false }` shape.
