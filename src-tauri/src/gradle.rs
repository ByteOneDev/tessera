//! Compilation d'un mod : écrit les fichiers générés par le front, puis lance le wrapper Gradle (AD-7).

use crate::files::{OutFile, list_files, rel_string, write_files};
use crate::jdk::ensure_jdk;
use std::collections::HashSet;
use std::fs;
use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

/// Supprime les fichiers de `src/` qui ne font plus partie du projet (ex. un écran supprimé).
/// `build/` et `.gradle/` sont conservés pour profiter du cache de Gradle.
fn remove_stale(dir: &Path, files: &[OutFile]) -> Result<(), String> {
    let wanted: HashSet<&str> = files.iter().map(|f| f.path.as_str()).collect();
    let src = dir.join("src");
    let mut existing = Vec::new();
    list_files(dir, &src, &mut existing)?;
    for rel in existing {
        if !wanted.contains(rel_string(&rel).as_str()) {
            let _ = fs::remove_file(dir.join(&rel));
        }
    }
    Ok(())
}

pub struct BuildOutcome {
    pub ok: bool,
    pub jar: Option<PathBuf>,
}

pub fn build(
    builds_root: &Path,
    jdk_root: &Path,
    mod_id: &str,
    files: &[OutFile],
    log: &dyn Fn(String),
) -> Result<BuildOutcome, String> {
    if mod_id.is_empty() || !mod_id.chars().all(|c| c.is_ascii_lowercase() || c.is_ascii_digit() || c == '_') {
        return Err(format!("Mod id invalide : « {mod_id} »"));
    }
    let dir = builds_root.join(mod_id);
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    remove_stale(&dir, files)?;
    write_files(&dir, files)?;
    log(format!("[Tessera] Projet écrit dans {}", dir.display()));

    let java_home = ensure_jdk(jdk_root, log)?;
    let wrapper = dir.join(if cfg!(windows) { "gradlew.bat" } else { "gradlew" });
    if !wrapper.exists() {
        return Err("Wrapper Gradle absent des fichiers du projet.".into());
    }

    let _ = fs::remove_dir_all(dir.join("build").join("libs"));
    log("[Tessera] Lancement de Gradle (le premier Build télécharge Minecraft et NeoForge, plusieurs minutes)…".into());
    let mut child = Command::new(&wrapper)
        .args(["build", "--console=plain"])
        .current_dir(&dir)
        .env("JAVA_HOME", &java_home)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Impossible de lancer Gradle : {e}"))?;

    let stderr = child.stderr.take().expect("stderr capturé");
    let (tx, rx) = std::sync::mpsc::channel::<String>();
    let tx_err = tx.clone();
    let err_thread = std::thread::spawn(move || {
        for line in BufReader::new(stderr).lines().map_while(Result::ok) {
            let _ = tx_err.send(line);
        }
    });
    let stdout = child.stdout.take().expect("stdout capturé");
    let out_thread = std::thread::spawn(move || {
        for line in BufReader::new(stdout).lines().map_while(Result::ok) {
            let _ = tx.send(line);
        }
    });
    for line in rx {
        log(line);
    }
    let _ = out_thread.join();
    let _ = err_thread.join();
    let status = child.wait().map_err(|e| e.to_string())?;

    let jar = fs::read_dir(dir.join("build").join("libs")).ok().and_then(|entries| {
        entries
            .flatten()
            .map(|e| e.path())
            .find(|p| p.extension().is_some_and(|x| x == "jar") && !p.to_string_lossy().contains("-sources"))
    });
    Ok(BuildOutcome { ok: status.success() && jar.is_some(), jar })
}
