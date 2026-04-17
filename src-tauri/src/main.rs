// StudyTrack — Tauri v2 macOS shell
//
// Responsibilities:
//   1. Spawn the Node.js sidecar (studytrack-server) with proper env vars
//   2. Wait for the HTTP server to be ready before showing the main window
//   3. System tray with Open / Quit items
//   4. Hide main window on close (keep server alive in tray)
//   5. On exit: run docker-compose down to kill ChromaDB + Piston containers

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::net::TcpStream;
use std::time::Duration;
use std::thread;
use std::path::PathBuf;
use std::process::Command;

use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Manager, RunEvent,
};
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::CommandEvent;

const SERVER_ADDR: &str = "127.0.0.1:3333";
const MAIN_LABEL: &str = "main";

/// Resolve ~/Library/Application Support/studytrack as the data directory.
fn data_dir() -> PathBuf {
    dirs_next::data_dir()
        .unwrap_or_else(|| PathBuf::from("/tmp"))
        .join("studytrack")
}

/// Find the bundled docker-compose.services.yml inside the .app Resources.
fn services_compose_file(app: &AppHandle) -> PathBuf {
    app.path()
        .resource_dir()
        .unwrap_or_else(|_| PathBuf::from("."))
        .join("docker-compose.services.yml")
}

/// Build the tray context menu.
fn build_tray_menu(app: &AppHandle) -> tauri::Result<Menu<tauri::Wry>> {
    let open = MenuItem::with_id(app, "open", "Open StudyTrack", true, None::<&str>)?;
    let sep  = PredefinedMenuItem::separator(app)?;
    let quit = MenuItem::with_id(app, "quit", "Quit StudyTrack",  true, None::<&str>)?;
    Menu::with_items(app, &[&open, &sep, &quit])
}

/// Focus (or un-hide) the main window.
fn show_main(app: &AppHandle) {
    if let Some(w) = app.get_webview_window(MAIN_LABEL) {
        let _ = w.show();
        let _ = w.set_focus();
    }
}

/// Poll TCP until the Node.js server is accepting connections (max ~10 s).
fn wait_for_server() {
    for _ in 0..100 {
        if TcpStream::connect_timeout(
            &SERVER_ADDR.parse().unwrap(),
            Duration::from_millis(100),
        ).is_ok() {
            return;
        }
        thread::sleep(Duration::from_millis(100));
    }
    eprintln!("[studytrack] server did not start within 10 s");
}

/// Run docker compose down synchronously (called on app exit).
fn docker_services_down(compose_file: &PathBuf) {
    eprintln!("[studytrack] stopping Docker services...");
    let status = Command::new("docker")
        .args(["compose", "-f", compose_file.to_str().unwrap_or(""), "down"])
        .status();
    match status {
        Ok(s) => eprintln!("[studytrack] docker compose down exited: {s}"),
        Err(e) => eprintln!("[studytrack] docker compose down error: {e}"),
    }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let handle = app.handle().clone();

            // ── 1. Prepare data directory ───────────────────────────────
            let data = data_dir();
            std::fs::create_dir_all(&data).ok();

            let compose_file = services_compose_file(app.handle());

            // ── 2. Spawn the Node.js sidecar ────────────────────────────
            // Pass env vars that override defaults inside the bundled server.js
            let sidecar_cmd = app
                .shell()
                .sidecar("studytrack-server")
                .expect("[studytrack] studytrack-server sidecar not found in bundle")
                .env("DATA_DIR",              data.to_str().unwrap_or(""))
                .env("MANAGE_SERVICES",       "1")
                .env("SERVICES_COMPOSE_FILE", compose_file.to_str().unwrap_or(""))
                .env("CHROMA_URL",            "http://localhost:8000")
                .env("PISTON_URL",            "http://localhost:2000")
                // Forward Anthropic credentials from the user's environment
                .env("ANTHROPIC_API_KEY",  std::env::var("ANTHROPIC_API_KEY").unwrap_or_default())
                .env("ANTHROPIC_BASE_URL", std::env::var("ANTHROPIC_BASE_URL").unwrap_or_default());

            let (mut rx, _child) = sidecar_cmd
                .spawn()
                .expect("[studytrack] failed to spawn studytrack-server sidecar");

            // Drain sidecar stdout/stderr so the pipe never blocks
            tauri::async_runtime::spawn(async move {
                while let Some(event) = rx.recv().await {
                    match event {
                        CommandEvent::Stdout(line) => print!("[server] {}", String::from_utf8_lossy(&line)),
                        CommandEvent::Stderr(line) => eprint!("[server] {}", String::from_utf8_lossy(&line)),
                        _ => {}
                    }
                }
            });

            // ── 3. Wait for server then show main window ─────────────────
            let show_handle = handle.clone();
            tauri::async_runtime::spawn_blocking(move || {
                wait_for_server();
                if let Some(w) = show_handle.get_webview_window(MAIN_LABEL) {
                    let _ = w.show();
                    let _ = w.set_focus();
                }
            });

            // ── 4. System tray ────────────────────────────────────────────
            let menu = build_tray_menu(app.handle())?;

            let _tray = TrayIconBuilder::with_id("main-tray")
                .tooltip("StudyTrack")
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event({
                    let h = handle.clone();
                    move |_tray_handle, event| match event.id().as_ref() {
                        "open" => show_main(&h),
                        "quit" => h.exit(0),
                        _ => {}
                    }
                })
                .on_tray_icon_event({
                    let h = handle.clone();
                    move |_tray, event| {
                        if let TrayIconEvent::Click {
                            button: MouseButton::Left,
                            button_state: MouseButtonState::Up,
                            ..
                        } = event {
                            show_main(&h);
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        // ── 5. Hide main window on close (keep running in tray) ──────────
        .on_window_event(|window, event| {
            if window.label() == MAIN_LABEL {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        // ── 6. On exit: stop Docker services ─────────────────────────────
        .build(tauri::generate_context!())
        .expect("error building StudyTrack")
        .run(|app, event| {
            if let RunEvent::Exit = event {
                // Resolve the compose file path from the resource dir
                if let Ok(resources) = app.path().resource_dir() {
                    let compose = resources.join("docker-compose.services.yml");
                    docker_services_down(&compose);
                }
            }
        });
}
