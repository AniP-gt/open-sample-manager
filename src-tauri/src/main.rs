// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use open_sample_manager_core::{healthcheck, SampleSummary};

#[tauri::command]
fn get_health_status() -> String {
    healthcheck().to_string()
}

#[tauri::command]
fn get_sample_summaries() -> Vec<SampleSummary> {
    vec![
        SampleSummary {
            file_name: "kick_808.wav".to_string(),
            duration_seconds: 0.5,
        },
        SampleSummary {
            file_name: "snare_01.wav".to_string(),
            duration_seconds: 0.3,
        },
    ]
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            get_health_status,
            get_sample_summaries
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
