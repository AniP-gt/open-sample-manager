use std::time::SystemTime;

pub(super) fn system_time_to_unix(st: SystemTime) -> i64 {
    st.duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs().try_into().unwrap_or(0))
        .unwrap_or(0)
}

pub(super) fn now_unix() -> i64 {
    system_time_to_unix(SystemTime::now())
}
