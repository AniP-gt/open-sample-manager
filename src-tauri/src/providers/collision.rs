use std::ffi::OsStr;

use unicode_normalization::UnicodeNormalization;

pub(crate) fn portable_name_key(name: &OsStr) -> String {
    name.to_string_lossy()
        .nfkc()
        .collect::<String>()
        .to_lowercase()
}
