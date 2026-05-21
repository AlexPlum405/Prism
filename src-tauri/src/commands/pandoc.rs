use serde::Serialize;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::{SystemTime, UNIX_EPOCH};

use crate::{canonicalize_existing_path, first_non_empty_line};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PandocDetectionResult {
    path: String,
    detected: bool,
    version: String,
    last_checked_at: u64,
    last_error: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PandocCitationHtmlResult {
    html: String,
    warnings: String,
}

fn timestamp_millis() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis().min(u128::from(u64::MAX)) as u64)
        .unwrap_or(0)
}

fn bounded_lossy_text(text: &[u8], max_chars: usize) -> String {
    String::from_utf8_lossy(text)
        .trim()
        .chars()
        .take(max_chars)
        .collect()
}

#[tauri::command]
pub fn detect_pandoc(path: Option<String>) -> PandocDetectionResult {
    let requested_path = path.unwrap_or_default().trim().to_string();
    let executable = if requested_path.is_empty() {
        "pandoc".to_string()
    } else {
        requested_path.clone()
    };
    let checked_at = timestamp_millis();

    match Command::new(&executable).arg("--version").output() {
        Ok(output) if output.status.success() => {
            let version = first_non_empty_line(&output.stdout);
            PandocDetectionResult {
                path: requested_path,
                detected: true,
                version,
                last_checked_at: checked_at,
                last_error: String::new(),
            }
        }
        Ok(output) => {
            let stderr = first_non_empty_line(&output.stderr);
            PandocDetectionResult {
                path: requested_path,
                detected: false,
                version: String::new(),
                last_checked_at: checked_at,
                last_error: if stderr.is_empty() {
                    format!("Pandoc --version exited with status: {}", output.status)
                } else {
                    stderr
                },
            }
        }
        Err(err) => PandocDetectionResult {
            path: requested_path,
            detected: false,
            version: String::new(),
            last_checked_at: checked_at,
            last_error: format!("Failed to run pandoc: {err}"),
        },
    }
}

fn has_extension(path: &Path, allowed_extensions: &[&str]) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| {
            let normalized = extension.to_ascii_lowercase();
            allowed_extensions
                .iter()
                .any(|allowed| normalized == allowed.trim_start_matches('.'))
        })
        .unwrap_or(false)
}

fn canonicalize_supported_file(
    path: &str,
    label: &str,
    allowed_extensions: &[&str],
) -> Result<PathBuf, String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err(format!("{label} path cannot be empty"));
    }
    let file_path = canonicalize_existing_path(trimmed)?;
    if !file_path.is_file() {
        return Err(format!("{label} path is not a file"));
    }
    if !has_extension(&file_path, allowed_extensions) {
        return Err(format!(
            "{label} file type is unsupported; supported types: {}",
            allowed_extensions.join(" / ")
        ));
    }
    Ok(file_path)
}

fn build_pandoc_citation_html_args(
    bibliography_path: &Path,
    csl_style_path: Option<&Path>,
) -> Vec<String> {
    let mut args = vec![
        "--from".to_string(),
        "markdown+tex_math_dollars+tex_math_single_backslash".to_string(),
        "--to".to_string(),
        "html".to_string(),
        "--citeproc".to_string(),
        "--bibliography".to_string(),
        bibliography_path.to_string_lossy().to_string(),
        "--metadata".to_string(),
        "link-citations=true".to_string(),
        "--wrap=none".to_string(),
    ];

    if let Some(csl_path) = csl_style_path {
        args.push("--csl".to_string());
        args.push(csl_path.to_string_lossy().to_string());
    }

    args
}

#[tauri::command]
pub fn render_citations_with_pandoc(
    path: Option<String>,
    markdown: String,
    bibliography_path: String,
    csl_style_path: Option<String>,
) -> Result<PandocCitationHtmlResult, String> {
    let requested_path = path.unwrap_or_default().trim().to_string();
    let executable = if requested_path.is_empty() {
        "pandoc".to_string()
    } else {
        requested_path
    };
    let bibliography = canonicalize_supported_file(
        &bibliography_path,
        "Bibliography",
        &["bib", "bibtex", "json"],
    )?;
    let csl = match csl_style_path
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        Some(path) => Some(canonicalize_supported_file(path, "CSL style", &["csl"])?),
        None => None,
    };
    let args = build_pandoc_citation_html_args(&bibliography, csl.as_deref());

    let mut child = Command::new(&executable)
        .args(&args)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|err| format!("Failed to run pandoc: {err}"))?;

    if let Some(mut stdin) = child.stdin.take() {
        stdin
            .write_all(markdown.as_bytes())
            .map_err(|err| format!("Failed to write pandoc input: {err}"))?;
    } else {
        return Err("Failed to open pandoc input stream".to_string());
    }

    let output = child
        .wait_with_output()
        .map_err(|err| format!("Failed to read pandoc output: {err}"))?;

    if !output.status.success() {
        let stderr = first_non_empty_line(&output.stderr);
        return Err(if stderr.is_empty() {
            format!("Pandoc citeproc exited with status: {}", output.status)
        } else {
            stderr
        });
    }

    Ok(PandocCitationHtmlResult {
        html: String::from_utf8_lossy(&output.stdout).to_string(),
        warnings: bounded_lossy_text(&output.stderr, 4000),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn temp_file(name: &str, contents: &str) -> PathBuf {
        let mut path = std::env::temp_dir();
        path.push(format!(
            "prism-pandoc-test-{}-{}-{}",
            std::process::id(),
            timestamp_millis(),
            name
        ));
        fs::write(&path, contents).expect("write temp file");
        path
    }

    #[test]
    fn builds_pandoc_citation_html_args_with_csl() {
        let bibliography = PathBuf::from("/tmp/library.bib");
        let csl = PathBuf::from("/tmp/chinese-gb7714.csl");

        let args = build_pandoc_citation_html_args(&bibliography, Some(&csl));

        assert_eq!(args[0], "--from");
        assert!(args.contains(&"--citeproc".to_string()));
        assert!(args.contains(&"--bibliography".to_string()));
        assert!(args.contains(&"/tmp/library.bib".to_string()));
        assert!(args.contains(&"--csl".to_string()));
        assert!(args.contains(&"/tmp/chinese-gb7714.csl".to_string()));
        assert!(args.contains(&"--wrap=none".to_string()));
    }

    #[test]
    fn validates_supported_citation_files() {
        let bibliography = temp_file("library.bib", "@book{doe2024,title={Demo}}");
        let csl = temp_file("style.csl", "<style></style>");

        assert!(canonicalize_supported_file(
            bibliography.to_str().unwrap(),
            "Bibliography",
            &["bib", "bibtex", "json"],
        )
        .is_ok());
        assert!(canonicalize_supported_file(csl.to_str().unwrap(), "CSL style", &["csl"]).is_ok());

        let _ = fs::remove_file(bibliography);
        let _ = fs::remove_file(csl);
    }

    #[test]
    fn rejects_unsupported_citation_file_extension() {
        let bibliography = temp_file("library.txt", "plain text");
        let error = canonicalize_supported_file(
            bibliography.to_str().unwrap(),
            "Bibliography",
            &["bib", "bibtex", "json"],
        )
        .expect_err("txt should be rejected");

        assert!(error.contains("Bibliography file type is unsupported"));
        let _ = fs::remove_file(bibliography);
    }
}
