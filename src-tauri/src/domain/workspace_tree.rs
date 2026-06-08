use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

use super::error::{PrismCommandError, PrismResult};
use super::path::{canonicalize_existing_path, ensure_directory, path_to_string};

const DEFAULT_MAX_DEPTH: usize = 8;
const PREVIEW_MAX_CHARS: usize = 100;
#[derive(Debug, Deserialize, Clone, Copy)]
#[serde(rename_all = "camelCase")]
pub struct LoadWorkspaceTreeOptions {
    pub max_depth: Option<usize>,
    pub include_preview: Option<bool>,
}

#[derive(Debug, Serialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct FileNodeDto {
    pub path: String,
    pub name: String,
    pub kind: String,
    pub children: Option<Vec<FileNodeDto>>,
    pub preview: Option<String>,
    pub size: Option<u64>,
    pub created_at: Option<f64>,
    pub modified_at: Option<f64>,
}

fn metadata_time_ms(time: std::io::Result<std::time::SystemTime>) -> Option<f64> {
    time.ok()
        .and_then(|value| value.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_millis() as f64)
}

fn is_supported_markdown_path(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| {
            matches!(
                extension.to_ascii_lowercase().as_str(),
                "md" | "markdown" | "txt"
            )
        })
        .unwrap_or(false)
}

fn is_invalid_workspace_root(path: &Path) -> bool {
    if path.parent().is_none() {
        return true;
    }

    #[cfg(target_os = "macos")]
    {
        [
            "/System",
            "/Library",
            "/Applications",
            "/bin",
            "/sbin",
            "/usr",
            "/private",
        ]
        .iter()
        .any(|prefix| path == Path::new(prefix))
    }

    #[cfg(target_os = "windows")]
    {
        let path_text = path.to_string_lossy().to_ascii_lowercase();
        path.parent().and_then(|parent| parent.parent()).is_none()
            || path_text.contains("\\windows")
            || path_text.contains("\\program files")
            || path_text.contains("\\program files (x86)")
    }

    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        [
            "/bin", "/boot", "/dev", "/etc", "/lib", "/proc", "/root", "/run", "/sbin", "/sys",
            "/usr",
        ]
        .iter()
        .any(|prefix| path == Path::new(prefix))
    }
}

fn strip_frontmatter(content: &str) -> &str {
    if !content.starts_with("---") {
        return content;
    }

    if let Some(end) = content[3..].find("\n---") {
        return &content[end + 7..];
    }

    content
}

fn strip_html_tags(line: &str) -> String {
    let mut output = String::new();
    let mut in_tag = false;

    for ch in line.chars() {
        match ch {
            '<' => in_tag = true,
            '>' => in_tag = false,
            _ if !in_tag => output.push(ch),
            _ => {}
        }
    }

    output
}

fn strip_markdown_links(line: &str) -> String {
    let chars: Vec<char> = line.chars().collect();
    let mut output = String::new();
    let mut i = 0;

    while i < chars.len() {
        if chars[i] == '!' && chars.get(i + 1) == Some(&'[') {
            if let Some(close) = chars[i + 2..].iter().position(|ch| *ch == ')') {
                i += close + 3;
                continue;
            }
        }

        if chars[i] == '[' {
            if let Some(close_label) = chars[i + 1..].iter().position(|ch| *ch == ']') {
                let close_label = i + 1 + close_label;
                if chars.get(close_label + 1) == Some(&'(') {
                    if let Some(close_target) =
                        chars[close_label + 2..].iter().position(|ch| *ch == ')')
                    {
                        output.extend(chars[i + 1..close_label].iter());
                        i = close_label + close_target + 3;
                        continue;
                    }
                }
            }
        }

        output.push(chars[i]);
        i += 1;
    }

    output
}

fn clean_preview_line(line: &str) -> String {
    let mut text = line.trim().to_string();
    while text.starts_with('#') {
        text.remove(0);
    }
    text = text
        .trim_start_matches(|ch: char| ch == '-' || ch == '*' || ch == '+' || ch.is_whitespace())
        .trim_start_matches(|ch: char| ch.is_ascii_digit() || ch == '.')
        .trim_start_matches('>')
        .trim()
        .to_string();
    text = strip_markdown_links(&text);
    text = strip_html_tags(&text);
    text.chars()
        .filter(|ch| !matches!(ch, '*' | '_' | '~' | '`' | '$'))
        .collect::<String>()
        .trim()
        .to_string()
}

pub fn extract_preview(content: &str) -> String {
    let content = strip_frontmatter(content);
    let mut lines = Vec::new();
    let mut in_code_or_math_block = false;

    for raw_line in content.lines() {
        let line = raw_line.trim();
        if line.starts_with("```") || line.starts_with("$$") {
            in_code_or_math_block = !in_code_or_math_block;
            continue;
        }
        if in_code_or_math_block || line.is_empty() {
            continue;
        }
        if line.starts_with('|') && line.ends_with('|') {
            continue;
        }

        let cleaned = clean_preview_line(line);
        if !cleaned.is_empty() {
            lines.push(cleaned);
        }
    }

    lines.join(" ").chars().take(PREVIEW_MAX_CHARS).collect()
}

fn build_file_node(path: PathBuf, include_preview: bool) -> FileNodeDto {
    let metadata = fs::metadata(&path).ok();
    let preview = if include_preview {
        fs::read_to_string(&path)
            .ok()
            .map(|content| extract_preview(&content))
            .unwrap_or_default()
    } else {
        String::new()
    };

    FileNodeDto {
        path: path_to_string(&path),
        name: path
            .file_name()
            .and_then(|name| name.to_str())
            .unwrap_or_default()
            .to_string(),
        kind: "file".to_string(),
        children: None,
        preview: Some(preview),
        size: metadata.as_ref().map(fs::Metadata::len),
        created_at: metadata
            .as_ref()
            .and_then(|value| metadata_time_ms(value.created())),
        modified_at: metadata
            .as_ref()
            .and_then(|value| metadata_time_ms(value.modified())),
    }
}

fn read_folder_children(
    folder_path: &Path,
    depth: usize,
    max_depth: usize,
    include_preview: bool,
) -> PrismResult<Vec<FileNodeDto>> {
    if depth >= max_depth {
        return Ok(Vec::new());
    }

    let mut entries = Vec::new();
    for entry in fs::read_dir(folder_path).map_err(|error| {
        PrismCommandError::new(
            "permission_denied",
            format!("Failed to read workspace: {error}"),
        )
        .with_path(path_to_string(folder_path))
        .with_stage("load_workspace_tree")
    })? {
        let Ok(entry) = entry else {
            continue;
        };
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        let Ok(file_type) = entry.file_type() else {
            continue;
        };

        if file_type.is_dir() {
            entries.push((name, path, true));
        } else if file_type.is_file() && is_supported_markdown_path(&path) {
            entries.push((name, path, false));
        }
    }

    entries.sort_by(|a, b| match (a.2, b.2) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => a.0.cmp(&b.0),
    });

    let mut nodes = Vec::new();
    for (name, path, is_dir) in entries {
        if is_dir {
            let children = read_folder_children(&path, depth + 1, max_depth, include_preview)?;
            if children.is_empty() {
                continue;
            }
            nodes.push(FileNodeDto {
                path: path_to_string(&path),
                name,
                kind: "directory".to_string(),
                children: Some(children),
                preview: None,
                size: None,
                created_at: None,
                modified_at: None,
            });
        } else {
            nodes.push(build_file_node(path, include_preview));
        }
    }

    Ok(nodes)
}

pub fn load_workspace_tree(
    root_path: String,
    options: Option<LoadWorkspaceTreeOptions>,
) -> PrismResult<Vec<FileNodeDto>> {
    let root = canonicalize_existing_path(&root_path, "load_workspace_tree")?;
    ensure_directory(&root, "load_workspace_tree")?;
    if is_invalid_workspace_root(&root) {
        return Err(PrismCommandError::new(
            "invalid_workspace",
            "System directories cannot be opened as a workspace",
        )
        .with_path(path_to_string(&root))
        .with_stage("load_workspace_tree"));
    }

    let options = options.unwrap_or(LoadWorkspaceTreeOptions {
        max_depth: None,
        include_preview: None,
    });
    let max_depth = options.max_depth.unwrap_or(DEFAULT_MAX_DEPTH).max(1);
    let include_preview = options.include_preview.unwrap_or(true);
    read_folder_children(&root, 0, max_depth, include_preview)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn timestamp_millis() -> u64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|duration| duration.as_millis().min(u128::from(u64::MAX)) as u64)
            .unwrap_or(0)
    }

    fn temp_dir(name: &str) -> PathBuf {
        let path = std::env::temp_dir().join(format!(
            "prism-workspace-tree-{}-{}-{name}",
            std::process::id(),
            timestamp_millis()
        ));
        fs::create_dir_all(&path).expect("create temp dir");
        path
    }

    #[test]
    fn extract_preview_removes_markdown_noise() {
        let preview = extract_preview(
            "---\ntitle: Hidden\n---\n# Title\n\n![img](a.png)\n[Label](https://example.com)\n\n```ts\nhidden\n```",
        );

        assert_eq!(preview, "Title Label");
    }

    #[test]
    fn load_workspace_tree_returns_markdown_files_and_prunes_empty_dirs() {
        let root = temp_dir("tree");
        fs::write(root.join("root.md"), "# Root").expect("write root");
        fs::create_dir_all(root.join("docs")).expect("create docs");
        fs::write(root.join("docs").join("a.txt"), "Alpha").expect("write txt");
        fs::create_dir_all(root.join(".agents")).expect("create agents");
        fs::write(root.join(".agents").join("SKILL.md"), "# Agent Skill")
            .expect("write agent skill");
        fs::create_dir_all(root.join(".codex").join("agents")).expect("create codex agents");
        fs::write(
            root.join(".codex").join("agents").join("oec-dev.md"),
            "# Codex Agent",
        )
        .expect("write codex agent");
        fs::create_dir_all(root.join(".claude")).expect("create claude");
        fs::write(root.join(".claude").join("notes.md"), "# Claude Notes").expect("write claude");
        fs::create_dir_all(root.join(".cache")).expect("create cache");
        fs::write(root.join(".cache").join("cached.md"), "# Cache").expect("write cache");
        fs::create_dir_all(root.join(".git")).expect("create git");
        fs::write(root.join(".git").join("notes.md"), "# Git Notes").expect("write git");
        fs::create_dir_all(root.join(".idea")).expect("create idea");
        fs::write(root.join(".idea").join("notes.md"), "# Idea Notes").expect("write idea");
        fs::create_dir_all(root.join(".venv")).expect("create venv");
        fs::write(root.join(".venv").join("notes.md"), "# Venv Notes").expect("write venv");
        fs::create_dir_all(root.join("empty")).expect("create empty");
        fs::create_dir_all(root.join("node_modules")).expect("create node_modules");
        fs::write(
            root.join("node_modules").join("notes.md"),
            "# Dependency Notes",
        )
        .expect("write node_modules");
        fs::write(root.join("image.png"), "png").expect("write png");

        let tree = load_workspace_tree(path_to_string(&root), None).expect("load tree");

        assert_eq!(
            tree.iter()
                .map(|node| node.name.as_str())
                .collect::<Vec<_>>(),
            [
                ".agents",
                ".cache",
                ".claude",
                ".codex",
                ".git",
                ".idea",
                ".venv",
                "docs",
                "node_modules",
                "root.md"
            ]
        );
        assert_eq!(
            tree.iter()
                .find(|node| node.name == "docs")
                .expect("docs")
                .children
                .as_ref()
                .expect("children")[0]
                .name,
            "a.txt"
        );
        assert_eq!(
            tree.iter()
                .find(|node| node.name == ".agents")
                .expect("agents")
                .children
                .as_ref()
                .expect("children")[0]
                .name,
            "SKILL.md"
        );
        assert_eq!(
            tree.iter()
                .find(|node| node.name == ".codex")
                .expect("codex")
                .children
                .as_ref()
                .expect("children")[0]
                .name,
            "agents"
        );
        assert!(tree.iter().any(|node| node.name == ".git"));
        assert!(tree.iter().any(|node| node.name == ".cache"));
        assert!(tree.iter().any(|node| node.name == ".venv"));
        assert!(tree.iter().any(|node| node.name == "node_modules"));
        assert!(tree.iter().all(|node| node.name != "empty"));
        assert_eq!(
            tree.iter()
                .find(|node| node.name == "root.md")
                .expect("root")
                .preview
                .as_deref(),
            Some("Root")
        );

        let _ = fs::remove_dir_all(root);
    }
}
