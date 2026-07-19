use serde::Serialize;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use crate::app_state::AppState;

use super::midi_preview_transform::{cleanup_temp_midi_preview, create_preview_midi_file};
use super::CommandError;

#[derive(Debug, Clone, Serialize)]
pub struct TimidityStatus {
    pub installed: bool,
    pub install_command: String,
}

fn timidity_install_command(os: &str) -> &'static str {
    match os {
        "macos" => "brew install timidity",
        "linux" => {
            "sudo apt-get install -y timidity (Debian/Ubuntu) or sudo dnf install timidity (Fedora)"
        }
        "windows" => "choco install timidity (or enable WSL and run a Linux installer)",
        _ => "Install TiMidity++ via your distribution's package manager",
    }
}

fn find_timidity_executable() -> Result<PathBuf, CommandError> {
    if let Ok(path) = which::which("timidity") {
        return Ok(path);
    }
    let common_paths = if cfg!(target_os = "macos") {
        vec![
            PathBuf::from("/run/current-system/sw/bin/timidity"),
            PathBuf::from("/opt/homebrew/bin/timidity"),
            PathBuf::from("/usr/local/bin/timidity"),
            PathBuf::from("/opt/local/bin/timidity"),
        ]
    } else if cfg!(target_os = "linux") {
        vec![
            PathBuf::from("/usr/bin/timidity"),
            PathBuf::from("/usr/local/bin/timidity"),
            PathBuf::from("/snap/bin/timidity"),
            PathBuf::from("/opt/timidity/bin/timidity"),
        ]
    } else if cfg!(target_os = "windows") {
        vec![
            PathBuf::from("C:\\Program Files\\timidity\\timidity.exe"),
            PathBuf::from("C:\\Program Files (x86)\\timidity\\timidity.exe"),
            PathBuf::from("C:\\msys64\\mingw64\\bin\\timidity.exe"),
            PathBuf::from("C:\\chocolatey\\bin\\timidity.exe"),
        ]
    } else {
        vec![]
    };
    for base_path in common_paths {
        if base_path.exists() {
            return Ok(base_path);
        }
        if cfg!(target_os = "linux") {
            let path_string = base_path.to_string_lossy();
            if path_string.contains("$HOME") {
                if let Ok(home) = std::env::var("HOME") {
                    let expanded_path = PathBuf::from(path_string.replace("$HOME", &home));
                    if expanded_path.exists() {
                        return Ok(expanded_path);
                    }
                }
            }
        }
    }
    if std::process::Command::new("timidity")
        .arg("--version")
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status()
        .is_ok()
    {
        return Ok(PathBuf::from("timidity"));
    }
    Err(CommandError {
        code: "timidity_not_found".to_string(),
        message: "TiMidity++ is not installed or not in PATH".to_string(),
        details: Some(format!(
            "Searched common paths. Install with: {}",
            timidity_install_command(std::env::consts::OS)
        )),
    })
}

#[tauri::command]
pub fn check_timidity() -> TimidityStatus {
    TimidityStatus {
        installed: find_timidity_executable().is_ok(),
        install_command: timidity_install_command(std::env::consts::OS).to_string(),
    }
}

pub(crate) fn stop_timidity_process(pid_state: &Arc<Mutex<Option<u32>>>) {
    let Ok(mut pid_lock) = pid_state.lock() else {
        return;
    };
    if let Some(pid) = pid_lock.take() {
        let _ = std::process::Command::new("kill")
            .arg("-TERM")
            .arg(pid.to_string())
            .output();
    }
}

#[tauri::command]
pub async fn play_midi(
    path: String,
    target_bpm: Option<f64>,
    transpose_semitones: Option<i8>,
    state: tauri::State<'_, AppState>,
) -> Result<(), CommandError> {
    stop_timidity_process(&state.timidity_pid);
    cleanup_temp_midi_preview(&state.temp_midi_preview_file);
    let timidity = find_timidity_executable()?;
    let output_flag = if cfg!(target_os = "macos") {
        "-Od"
    } else {
        "-OO"
    };
    let playback_path = if target_bpm.is_some() || transpose_semitones.is_some() {
        let temp_file = create_preview_midi_file(&path, target_bpm, transpose_semitones)?;
        let temp_path = temp_file.path().to_path_buf();
        *state.temp_midi_preview_file.lock().unwrap() = Some(temp_file);
        temp_path
    } else {
        PathBuf::from(&path)
    };
    let child = std::process::Command::new(timidity)
        .arg(output_flag)
        .arg(&playback_path)
        .stdin(std::process::Stdio::null())
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .spawn()
        .map_err(|error| CommandError {
            code: "timidity_spawn_error".to_string(),
            message: format!("Failed to start TiMidity++: {error}"),
            details: None,
        })?;
    *state.timidity_pid.lock().unwrap() = Some(child.id());
    Ok(())
}

#[tauri::command]
pub fn stop_midi(state: tauri::State<'_, AppState>) -> Result<(), CommandError> {
    stop_timidity_process(&state.timidity_pid);
    cleanup_temp_midi_preview(&state.temp_midi_preview_file);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::timidity_install_command;

    #[test]
    fn macos_command_matches_brew() {
        assert_eq!(timidity_install_command("macos"), "brew install timidity");
    }
    #[test]
    fn linux_command_mentions_apt_and_dnf() {
        assert!(timidity_install_command("linux").contains("apt-get"));
        assert!(timidity_install_command("linux").contains("dnf"));
    }
    #[test]
    fn windows_command_references_choco() {
        assert!(timidity_install_command("windows").contains("choco"));
    }
    #[test]
    fn fallback_command_suggests_package_manager() {
        assert_eq!(
            timidity_install_command("solaris"),
            "Install TiMidity++ via your distribution's package manager"
        );
    }
}
