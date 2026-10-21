mod files;
mod gradle;
mod jdk;

use files::{InFile, OutFile, safe_join};
use serde::Serialize;
use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Emitter, Manager};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ProjectFiles {
    json: String,
    assets: Vec<InFile>,
}

/// Écrit un projet : `tessera.json` + `assets/` (le dossier assets est géré par Tessera et réécrit en entier).
#[tauri::command]
fn write_project(dir: String, json: String, assets: Vec<OutFile>) -> Result<(), String> {
    let root = PathBuf::from(&dir);
    fs::create_dir_all(&root).map_err(|e| format!("Impossible de créer {dir} : {e}"))?;
    let assets_dir = root.join("assets");
    let _ = fs::remove_dir_all(&assets_dir);
    files::write_files(&root, &assets)?;
    let tmp = root.join("tessera.json.tmp");
    fs::write(&tmp, json).map_err(|e| e.to_string())?;
    fs::rename(&tmp, root.join("tessera.json")).map_err(|e| e.to_string())
}

#[tauri::command]
fn read_project(dir: String) -> Result<ProjectFiles, String> {
    let root = PathBuf::from(&dir);
    let json = fs::read_to_string(root.join("tessera.json"))
        .map_err(|_| format!("Aucun fichier tessera.json dans {dir}"))?;
    let assets = files::read_dir_base64(&root, "assets")?;
    Ok(ProjectFiles { json, assets })
}

#[tauri::command]
fn default_projects_dir(app: AppHandle) -> Result<String, String> {
    let docs = app.path().document_dir().map_err(|e| e.to_string())?;
    Ok(docs.join("Tessera").to_string_lossy().into_owned())
}

#[tauri::command]
fn write_files_to(dir: String, files: Vec<OutFile>) -> Result<(), String> {
    files::write_files(&PathBuf::from(dir), &files)
}

#[tauri::command]
fn path_exists(dir: String, rel: String) -> Result<bool, String> {
    Ok(safe_join(&PathBuf::from(dir), &rel)?.exists())
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct BuildResult {
    ok: bool,
    jar_path: Option<String>,
    error: Option<String>,
}

/// Compile le mod dans `app_data_dir/builds/<modid>` et diffuse le journal sur `build://log`.
#[tauri::command]
async fn build_mod(app: AppHandle, mod_id: String, files: Vec<OutFile>) -> Result<BuildResult, String> {
    let data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let handle = app.clone();
    let result = tauri::async_runtime::spawn_blocking(move || {
        let log = |line: String| {
            let _ = handle.emit("build://log", line);
        };
        gradle::build(&data.join("builds"), &data.join("jdk"), &mod_id, &files, &log)
    })
    .await
    .map_err(|e| e.to_string())?;
    let out = match result {
        Ok(o) => BuildResult {
            ok: o.ok,
            jar_path: o.jar.map(|p| p.to_string_lossy().into_owned()),
            error: None,
        },
        Err(e) => BuildResult { ok: false, jar_path: None, error: Some(e) },
    };
    let _ = app.emit("build://done", out.clone());
    Ok(out)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle()
                    .plugin(tauri_plugin_log::Builder::default().level(log::LevelFilter::Info).build())?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            write_project,
            read_project,
            default_projects_dir,
            write_files_to,
            path_exists,
            build_mod
        ])
        .run(tauri::generate_context!())
        .expect("erreur au lancement de Tessera");
}
