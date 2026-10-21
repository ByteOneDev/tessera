//! Trouve un JDK 21, ou télécharge Temurin 21 (Adoptium) dans le dossier de données de l'application (AD-7).

use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

const JAVA_MAJOR: &str = "21";

fn java_bin(home: &Path) -> PathBuf {
    home.join("bin")
        .join(if cfg!(windows) { "java.exe" } else { "java" })
}

/// Vérifie qu'un JAVA_HOME contient bien un Java 21.
fn is_java21(home: &Path) -> bool {
    let Ok(out) = Command::new(java_bin(home)).arg("-version").output() else {
        return false;
    };
    let text = String::from_utf8_lossy(&out.stderr);
    text.contains(&format!("version \"{JAVA_MAJOR}"))
        || text.contains(&format!("version \"{JAVA_MAJOR}."))
}

fn system_candidates() -> Vec<PathBuf> {
    let mut c = Vec::new();
    if let Ok(h) = std::env::var("JAVA_HOME") {
        c.push(PathBuf::from(h));
    }
    if cfg!(target_os = "macos") {
        if let Ok(out) = Command::new("/usr/libexec/java_home")
            .args(["-v", JAVA_MAJOR])
            .output()
            && out.status.success()
        {
            c.push(PathBuf::from(String::from_utf8_lossy(&out.stdout).trim()));
        }
        for prefix in ["/opt/homebrew", "/usr/local"] {
            c.push(PathBuf::from(format!(
                "{prefix}/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home"
            )));
        }
    }
    c
}

/// Cherche un JDK 21 déjà téléchargé par Tessera (archive décompressée dans `jdk_root`).
fn find_downloaded(jdk_root: &Path) -> Option<PathBuf> {
    for entry in fs::read_dir(jdk_root).ok()?.flatten() {
        let p = entry.path();
        for home in [p.join("Contents").join("Home"), p.clone()] {
            if java_bin(&home).exists() && is_java21(&home) {
                return Some(home);
            }
        }
    }
    None
}

fn adoptium_url() -> Result<String, String> {
    let os = match std::env::consts::OS {
        "macos" => "mac",
        "windows" => "windows",
        "linux" => "linux",
        other => return Err(format!("Système non pris en charge : {other}")),
    };
    let arch = match std::env::consts::ARCH {
        "aarch64" => "aarch64",
        "x86_64" => "x64",
        other => return Err(format!("Architecture non prise en charge : {other}")),
    };
    Ok(format!(
        "https://api.adoptium.net/v3/binary/latest/{JAVA_MAJOR}/ga/{os}/{arch}/jdk/hotspot/normal/eclipse"
    ))
}

fn download_temurin(jdk_root: &Path, log: &dyn Fn(String)) -> Result<PathBuf, String> {
    let url = adoptium_url()?;
    log(format!(
        "[Tessera] Téléchargement de Java {JAVA_MAJOR} (Temurin) : {url}"
    ));
    let bytes = reqwest::blocking::Client::builder()
        .user_agent("Tessera")
        .build()
        .and_then(|c| c.get(&url).send())
        .and_then(|r| r.error_for_status())
        .and_then(|r| r.bytes())
        .map_err(|e| format!("Téléchargement de Java impossible : {e}"))?;
    log(format!(
        "[Tessera] {} Mo reçus, décompression…",
        bytes.len() / 1_000_000
    ));
    let tmp = jdk_root.join(".download");
    let _ = fs::remove_dir_all(&tmp);
    fs::create_dir_all(&tmp).map_err(|e| e.to_string())?;
    if cfg!(windows) {
        zip::ZipArchive::new(std::io::Cursor::new(bytes))
            .and_then(|mut z| z.extract(&tmp))
            .map_err(|e| format!("Archive Java invalide : {e}"))?;
    } else {
        tar::Archive::new(flate2::read::GzDecoder::new(std::io::Cursor::new(bytes)))
            .unpack(&tmp)
            .map_err(|e| format!("Archive Java invalide : {e}"))?;
    }
    for entry in fs::read_dir(&tmp).map_err(|e| e.to_string())?.flatten() {
        let dest = jdk_root.join(entry.file_name());
        let _ = fs::remove_dir_all(&dest);
        fs::rename(entry.path(), &dest).map_err(|e| e.to_string())?;
    }
    let _ = fs::remove_dir_all(&tmp);
    find_downloaded(jdk_root)
        .ok_or_else(|| "Java téléchargé mais introuvable après décompression.".into())
}

/// Renvoie un JAVA_HOME en Java 21 : système d'abord, puis cache Tessera, puis téléchargement.
pub fn ensure_jdk(jdk_root: &Path, log: &dyn Fn(String)) -> Result<PathBuf, String> {
    if let Some(home) = system_candidates().into_iter().find(|h| is_java21(h)) {
        log(format!(
            "[Tessera] Java {JAVA_MAJOR} trouvé : {}",
            home.display()
        ));
        return Ok(home);
    }
    fs::create_dir_all(jdk_root).map_err(|e| e.to_string())?;
    if let Some(home) = find_downloaded(jdk_root) {
        log(format!(
            "[Tessera] Java {JAVA_MAJOR} (cache Tessera) : {}",
            home.display()
        ));
        return Ok(home);
    }
    download_temurin(jdk_root, log)
}
