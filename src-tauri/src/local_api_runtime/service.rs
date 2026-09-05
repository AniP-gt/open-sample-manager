use rand::RngCore;
use std::io;
#[cfg(test)]
use std::path::Path;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::async_runtime::JoinHandle;
use tokio::net::TcpListener;
use tokio::sync::oneshot;

use open_sample_manager_core::SampleManager;

use crate::external_commands::UiCommandQueue;

use super::manifest::default_local_api_manifest_path;
use super::manifest::{
    cleanup_manifest_after_listener_bind, new_manifest, remove_manifest_if_owned,
    write_manifest_atomically, LocalApiLifecycleError,
};
#[cfg(test)]
use crate::http_api::build_router;
use crate::http_api::router::UiCommandWakeCallback;
use crate::http_api::{
    router::build_router_with_manager_and_queue_with_wake_callback, LOCALHOST_API_HOST,
};

const SHUTDOWN_WAIT: Duration = Duration::from_secs(2);

#[derive(Debug, Clone)]
pub struct LocalApiDataDirectory(PathBuf);

impl LocalApiDataDirectory {
    pub fn new(path: PathBuf) -> Self {
        Self(path)
    }

    fn manifest_path(&self) -> PathBuf {
        default_local_api_manifest_path(&self.0)
    }
}

#[derive(Debug)]
pub struct LocalApiRuntime {
    instance_id: String,
    manifest_path: PathBuf,
    pid: u32,
    shutdown_sender: Option<oneshot::Sender<()>>,
    server_task: Option<JoinHandle<()>>,
}

impl LocalApiRuntime {
    pub fn shutdown(&mut self) {
        if let Some(sender) = self.shutdown_sender.take() {
            let _ = sender.send(());
        }

        if let Some(mut task) = self.server_task.take() {
            tauri::async_runtime::block_on(async {
                if tokio::time::timeout(SHUTDOWN_WAIT, &mut task)
                    .await
                    .is_err()
                {
                    task.abort();
                    let _ = task.await;
                    eprintln!("warning: localhost API did not shut down gracefully");
                }
            });
        }

        if let Err(error) =
            remove_manifest_if_owned(&self.manifest_path, self.pid, &self.instance_id)
        {
            eprintln!("warning: localhost API manifest cleanup skipped: {error}");
        }
    }

    #[cfg(test)]
    pub fn manifest_path(&self) -> &Path {
        &self.manifest_path
    }
}

impl Drop for LocalApiRuntime {
    fn drop(&mut self) {
        self.shutdown();
    }
}

pub fn start_local_api_with_manager_and_wake_default(
    app_data_dir: LocalApiDataDirectory,
    manager: Arc<Mutex<SampleManager>>,
    ui_commands: Arc<UiCommandQueue>,
    wake_callback: UiCommandWakeCallback,
) -> Result<LocalApiRuntime, LocalApiLifecycleError> {
    start_local_api_with_manager_and_wake(
        app_data_dir,
        manager,
        ui_commands,
        wake_callback,
        bind_local_api_listener,
    )
}

pub fn start_local_api_with_manager_and_wake<Bind>(
    app_data_dir: LocalApiDataDirectory,
    manager: Arc<Mutex<SampleManager>>,
    ui_commands: Arc<UiCommandQueue>,
    wake_callback: UiCommandWakeCallback,
    bind: Bind,
) -> Result<LocalApiRuntime, LocalApiLifecycleError>
where
    Bind: FnOnce() -> io::Result<std::net::TcpListener>,
{
    start_local_api_with_router(app_data_dir, bind, move |token| {
        build_router_with_manager_and_queue_with_wake_callback(
            token,
            Arc::clone(&manager),
            Arc::clone(&ui_commands),
            Arc::clone(&wake_callback),
        )
    })
}

#[cfg(test)]
pub(crate) fn start_local_api_with<Bind>(
    app_data_dir: LocalApiDataDirectory,
    bind: Bind,
) -> Result<LocalApiRuntime, LocalApiLifecycleError>
where
    Bind: FnOnce() -> io::Result<std::net::TcpListener>,
{
    start_local_api_with_router(app_data_dir, bind, build_router)
}

#[cfg(test)]
pub(crate) fn start_local_api_with_manager<Bind>(
    app_data_dir: LocalApiDataDirectory,
    manager: Arc<Mutex<SampleManager>>,
    ui_commands: Arc<UiCommandQueue>,
    bind: Bind,
) -> Result<LocalApiRuntime, LocalApiLifecycleError>
where
    Bind: FnOnce() -> io::Result<std::net::TcpListener>,
{
    start_local_api_with_manager_and_wake(
        app_data_dir,
        manager,
        ui_commands,
        std::sync::Arc::new(|| false),
        bind,
    )
}

fn start_local_api_with_router<Bind, BuildRouter>(
    app_data_dir: LocalApiDataDirectory,
    bind: Bind,
    build_router: BuildRouter,
) -> Result<LocalApiRuntime, LocalApiLifecycleError>
where
    Bind: FnOnce() -> io::Result<std::net::TcpListener>,
    BuildRouter: FnOnce(String) -> axum::Router,
{
    let listener = bind().map_err(LocalApiLifecycleError::Bind)?;
    listener
        .set_nonblocking(true)
        .map_err(LocalApiLifecycleError::Bind)?;

    let manifest_path = app_data_dir.manifest_path();
    cleanup_manifest_after_listener_bind(&manifest_path)?;

    let listener = tauri::async_runtime::block_on(async { TcpListener::from_std(listener) })
        .map_err(LocalApiLifecycleError::Bind)?;
    let token = generate_token();
    let instance_id = generate_instance_id();
    let manifest = new_manifest(token.clone(), instance_id.clone());
    write_manifest_atomically(&manifest, &manifest_path)?;

    let router = build_router(token);
    let (shutdown_sender, shutdown_receiver) = oneshot::channel();
    let server_task = tauri::async_runtime::spawn(async move {
        let shutdown = async move {
            let _ = shutdown_receiver.await;
        };
        if let Err(error) = axum::serve(listener, router)
            .with_graceful_shutdown(shutdown)
            .await
        {
            eprintln!("warning: localhost API server stopped: {error}");
        }
    });

    Ok(LocalApiRuntime {
        instance_id,
        manifest_path,
        pid: std::process::id(),
        shutdown_sender: Some(shutdown_sender),
        server_task: Some(server_task),
    })
}

pub(crate) fn bind_local_api_listener() -> io::Result<std::net::TcpListener> {
    std::net::TcpListener::bind(LOCALHOST_API_HOST)
}

fn generate_token() -> String {
    encode_hex(random_bytes::<32>())
}

fn generate_instance_id() -> String {
    encode_hex(random_bytes::<16>())
}

fn random_bytes<const SIZE: usize>() -> [u8; SIZE] {
    let mut bytes = [0u8; SIZE];
    rand::rngs::OsRng.fill_bytes(&mut bytes);
    bytes
}

fn encode_hex(bytes: impl AsRef<[u8]>) -> String {
    bytes
        .as_ref()
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect()
}

#[cfg(test)]
#[path = "service/tests.rs"]
mod tests;
