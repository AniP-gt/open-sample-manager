use std::fs::File;

use tempfile::TempDir;

pub fn touch_files(dir: &TempDir, names: &[&str]) {
    for name in names {
        File::create(dir.path().join(name)).expect("create test file");
    }
}
