include!("src/command_manifest.rs");

macro_rules! command_names {
    ($($command:ident),* $(,)?) => { &[$(stringify!($command)),*] };
}

fn main() {
    tauri_build::try_build(
        tauri_build::Attributes::new()
            .app_manifest(tauri_build::AppManifest::new().commands(app_commands!(command_names))),
    )
    .expect("failed to build Tauri application manifest");
}
