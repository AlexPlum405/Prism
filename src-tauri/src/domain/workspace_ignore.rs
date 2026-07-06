use std::path::Path;

const IGNORED_WORKSPACE_DIRECTORY_NAMES: &[&str] = &[
    ".cache",
    ".git",
    ".gradle",
    ".hg",
    ".idea",
    ".mypy_cache",
    ".next",
    ".nuxt",
    ".parcel-cache",
    ".pytest_cache",
    ".ruff_cache",
    ".svelte-kit",
    ".svn",
    ".turbo",
    ".venv",
    "__pycache__",
    "build",
    "coverage",
    "dist",
    "node_modules",
    "target",
    "venv",
];

pub fn is_ignored_workspace_directory_name(name: &str) -> bool {
    IGNORED_WORKSPACE_DIRECTORY_NAMES
        .iter()
        .any(|ignored| ignored.eq_ignore_ascii_case(name))
}

pub fn is_ignored_workspace_directory(path: &Path) -> bool {
    path.file_name()
        .and_then(|name| name.to_str())
        .map(is_ignored_workspace_directory_name)
        .unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn recognizes_common_generated_workspace_directories() {
        assert!(is_ignored_workspace_directory(Path::new("node_modules")));
        assert!(is_ignored_workspace_directory(Path::new(
            "src-tauri/target"
        )));
        assert!(is_ignored_workspace_directory(Path::new(".git")));
        assert!(is_ignored_workspace_directory(Path::new(".next")));
        assert!(!is_ignored_workspace_directory(Path::new("docs")));
        assert!(!is_ignored_workspace_directory(Path::new(".agents")));
    }
}
