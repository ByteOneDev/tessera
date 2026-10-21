//! Lecture et écriture de fichiers pour le front. La conversion projet ↔ disque est faite côté TypeScript (AD-5) :
//! ici on se contente d'écrire et de lire des fichiers relatifs à un dossier racine, en refusant les chemins qui en sortent.

use base64::Engine;
use base64::engine::general_purpose::STANDARD as B64;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Component, Path, PathBuf};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OutFile {
    pub path: String,
    #[serde(default)]
    pub content: Option<String>,
    /// Contenu binaire encodé en base64.
    #[serde(default)]
    pub base64: Option<String>,
    #[serde(default)]
    pub executable: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InFile {
    pub path: String,
    pub base64: String,
}

/// Joint un chemin relatif à la racine, en refusant `..`, les chemins absolus et les préfixes de lecteur.
pub fn safe_join(root: &Path, rel: &str) -> Result<PathBuf, String> {
    let rel_path = Path::new(rel);
    if rel.is_empty() || rel_path.components().any(|c| !matches!(c, Component::Normal(_))) {
        return Err(format!("Chemin refusé : « {rel} »"));
    }
    Ok(root.join(rel_path))
}

pub fn write_files(root: &Path, files: &[OutFile]) -> Result<(), String> {
    for f in files {
        let target = safe_join(root, &f.path)?;
        if let Some(parent) = target.parent() {
            fs::create_dir_all(parent).map_err(|e| format!("Impossible de créer {} : {e}", parent.display()))?;
        }
        let bytes = match (&f.content, &f.base64) {
            (_, Some(b)) => B64.decode(b).map_err(|e| format!("Base64 invalide pour {} : {e}", f.path))?,
            (Some(c), None) => c.clone().into_bytes(),
            (None, None) => Vec::new(),
        };
        fs::write(&target, bytes).map_err(|e| format!("Impossible d'écrire {} : {e}", target.display()))?;
        #[cfg(unix)]
        if f.executable {
            use std::os::unix::fs::PermissionsExt;
            fs::set_permissions(&target, fs::Permissions::from_mode(0o755)).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

/// Liste récursivement les fichiers d'un dossier (chemins relatifs avec `/`).
pub fn list_files(root: &Path, dir: &Path, out: &mut Vec<PathBuf>) -> Result<(), String> {
    if !dir.exists() {
        return Ok(());
    }
    for entry in fs::read_dir(dir).map_err(|e| e.to_string())? {
        let path = entry.map_err(|e| e.to_string())?.path();
        if path.is_dir() {
            list_files(root, &path, out)?;
        } else if let Ok(rel) = path.strip_prefix(root) {
            out.push(rel.to_path_buf());
        }
    }
    Ok(())
}

pub fn rel_string(p: &Path) -> String {
    p.components()
        .map(|c| c.as_os_str().to_string_lossy().into_owned())
        .collect::<Vec<_>>()
        .join("/")
}

pub fn read_dir_base64(root: &Path, sub: &str) -> Result<Vec<InFile>, String> {
    let mut paths = Vec::new();
    list_files(root, &safe_join(root, sub)?, &mut paths)?;
    paths
        .into_iter()
        .map(|p| {
            let bytes = fs::read(root.join(&p)).map_err(|e| e.to_string())?;
            Ok(InFile { path: rel_string(&p), base64: B64.encode(bytes) })
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn refuse_les_chemins_qui_sortent() {
        let root = Path::new("/tmp/racine");
        assert!(safe_join(root, "../x").is_err());
        assert!(safe_join(root, "/etc/passwd").is_err());
        assert!(safe_join(root, "a/../../b").is_err());
        assert!(safe_join(root, "").is_err());
        assert_eq!(safe_join(root, "assets/a.png").unwrap(), root.join("assets/a.png"));
    }
}
