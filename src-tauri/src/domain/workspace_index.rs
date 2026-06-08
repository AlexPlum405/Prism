use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};
use std::time::{SystemTime, UNIX_EPOCH};

use super::error::{PrismCommandError, PrismResult};
use super::path::{canonicalize_existing_path, ensure_directory, path_to_string};

const MARKDOWN_EXTENSIONS: &[&str] = &["md", "markdown", "txt"];
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct CurrentDocumentOverride {
    pub path: String,
    pub content: String,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RecentFileDto {
    pub path: String,
    pub name: Option<String>,
    pub last_opened: f64,
}

#[derive(Debug, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct BuildWorkspaceIndexInput {
    pub root_path: String,
    pub current_document_override: Option<CurrentDocumentOverride>,
    pub recent_files: Vec<RecentFileDto>,
}

#[derive(Debug, Serialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct HeadingDto {
    pub level: u8,
    pub line: usize,
    pub slug: String,
    pub title: String,
}

#[derive(Debug, Serialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct LinkDto {
    pub column: usize,
    pub kind: String,
    pub label: String,
    pub line: usize,
    pub resolved_path: Option<String>,
    pub target: String,
}

#[derive(Debug, Serialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct FrontMatterDto {
    pub author: String,
    pub date: String,
    pub description: String,
    pub error: Option<String>,
    pub export_raw: String,
    pub has_front_matter: bool,
    pub status: String,
    pub tags: Vec<String>,
    pub title: String,
}

#[derive(Debug, Serialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceIndexedDocumentDto {
    pub content: String,
    pub front_matter: FrontMatterDto,
    pub has_content: bool,
    pub headings: Vec<HeadingDto>,
    pub last_opened: Option<f64>,
    pub links: Vec<LinkDto>,
    pub modified_at: Option<f64>,
    pub name: String,
    pub path: String,
    pub recent_rank: Option<usize>,
    pub relative_path: String,
    pub size: Option<u64>,
    pub title: String,
}

#[derive(Debug, Serialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct BacklinkDto {
    pub column: usize,
    pub excerpt: String,
    pub line: usize,
    pub path: String,
    pub title: String,
}

#[derive(Debug, Serialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceIndexDto {
    pub backlinks_by_path: HashMap<String, Vec<BacklinkDto>>,
    pub documents: Vec<WorkspaceIndexedDocumentDto>,
    pub generated_at: u64,
    pub recent_documents: Vec<WorkspaceIndexedDocumentDto>,
    pub root_path: String,
}

#[derive(Debug, Clone)]
struct WorkspaceFile {
    path: PathBuf,
    name: String,
    relative_path: String,
    size: Option<u64>,
    modified_at: Option<f64>,
}

#[derive(Debug, Clone)]
struct ParsedDocument {
    body: String,
    front_matter: FrontMatterDto,
    front_matter_line_offset: usize,
}

#[derive(Debug, Clone)]
struct CachedIndexedDocument {
    document: WorkspaceIndexedDocumentDto,
    modified_at: Option<f64>,
    size: Option<u64>,
}

#[derive(Debug, Default)]
struct WorkspaceIndexCache {
    documents_by_path: HashMap<String, CachedIndexedDocument>,
}

static WORKSPACE_INDEX_CACHE: OnceLock<Mutex<HashMap<String, WorkspaceIndexCache>>> =
    OnceLock::new();

fn workspace_index_cache() -> &'static Mutex<HashMap<String, WorkspaceIndexCache>> {
    WORKSPACE_INDEX_CACHE.get_or_init(|| Mutex::new(HashMap::new()))
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis().min(u128::from(u64::MAX)) as u64)
        .unwrap_or(0)
}

fn metadata_time_ms(time: std::io::Result<std::time::SystemTime>) -> Option<f64> {
    time.ok()
        .and_then(|value| value.duration_since(UNIX_EPOCH).ok())
        .map(|duration| duration.as_millis() as f64)
}

fn normalize_path(path: &str) -> String {
    path.replace('\\', "/").trim_end_matches('/').to_lowercase()
}

fn strip_markdown_extension(value: &str) -> String {
    for extension in MARKDOWN_EXTENSIONS {
        let suffix = format!(".{extension}");
        if value.to_lowercase().ends_with(&suffix) {
            return value[..value.len() - suffix.len()].to_string();
        }
    }
    value.to_string()
}

fn is_supported_markdown_path(path: &Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| {
            MARKDOWN_EXTENSIONS
                .iter()
                .any(|allowed| extension.eq_ignore_ascii_case(allowed))
        })
        .unwrap_or(false)
}

fn relative_path(path: &Path, root: &Path) -> String {
    path.strip_prefix(root)
        .map(path_to_string)
        .unwrap_or_else(|_| path_to_string(path))
        .replace('\\', "/")
}

fn collect_workspace_files(
    root: &Path,
    dir: &Path,
    out: &mut Vec<WorkspaceFile>,
) -> PrismResult<()> {
    let entries = fs::read_dir(dir).map_err(|error| {
        PrismCommandError::new(
            "permission_denied",
            format!("Failed to read workspace: {error}"),
        )
        .with_path(path_to_string(dir))
        .with_stage("build_workspace_index")
    })?;

    for entry in entries.flatten() {
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        let Ok(file_type) = entry.file_type() else {
            continue;
        };
        if file_type.is_dir() {
            collect_workspace_files(root, &path, out)?;
            continue;
        }
        if !file_type.is_file() || !is_supported_markdown_path(&path) {
            continue;
        }

        let metadata = fs::metadata(&path).ok();
        out.push(WorkspaceFile {
            relative_path: relative_path(&path, root),
            name,
            path,
            size: metadata.as_ref().map(fs::Metadata::len),
            modified_at: metadata
                .as_ref()
                .and_then(|metadata| metadata_time_ms(metadata.modified())),
        });
    }

    Ok(())
}

fn split_csv(value: &str) -> Vec<String> {
    value
        .split(',')
        .map(str::trim)
        .filter(|item| !item.is_empty())
        .map(str::to_string)
        .collect()
}

fn parse_front_matter(content: &str) -> ParsedDocument {
    let mut front_matter = FrontMatterDto {
        author: String::new(),
        date: String::new(),
        description: String::new(),
        error: None,
        export_raw: String::new(),
        has_front_matter: false,
        status: String::new(),
        tags: Vec::new(),
        title: String::new(),
    };

    if !content.starts_with("---") {
        return ParsedDocument {
            body: content.to_string(),
            front_matter,
            front_matter_line_offset: 0,
        };
    }

    let Some(end) = content[3..].find("\n---") else {
        front_matter.error = Some("Front matter closing delimiter not found".to_string());
        return ParsedDocument {
            body: content.to_string(),
            front_matter,
            front_matter_line_offset: 0,
        };
    };

    let raw = &content[4..end + 3];
    front_matter.export_raw = raw.to_string();
    front_matter.has_front_matter = true;

    for line in raw.lines() {
        let Some((key, value)) = line.split_once(':') else {
            continue;
        };
        let value = value.trim().trim_matches('"').trim_matches('\'');
        match key.trim() {
            "author" => front_matter.author = value.to_string(),
            "date" => front_matter.date = value.to_string(),
            "description" => front_matter.description = value.to_string(),
            "status" => front_matter.status = value.to_string(),
            "tags" => front_matter.tags = split_csv(value.trim_matches(['[', ']'])),
            "title" => front_matter.title = value.to_string(),
            _ => {}
        }
    }

    let body_start = end + 7;
    ParsedDocument {
        body: content[body_start..].to_string(),
        front_matter,
        front_matter_line_offset: content[..body_start].lines().count(),
    }
}

fn heading_slug(title: &str) -> String {
    let mut slug = String::new();
    let mut last_dash = false;
    for ch in title.to_lowercase().chars() {
        if ch.is_alphanumeric() {
            slug.push(ch);
            last_dash = false;
        } else if !last_dash {
            slug.push('-');
            last_dash = true;
        }
    }
    slug.trim_matches('-').to_string()
}

fn strip_inline_code(value: &str) -> String {
    value.replace('`', "")
}

fn parse_headings(body: &str, line_offset: usize) -> Vec<HeadingDto> {
    body.lines()
        .enumerate()
        .filter_map(|(index, line)| {
            let trimmed = line.trim_end_matches('#').trim();
            let level = trimmed.chars().take_while(|ch| *ch == '#').count();
            if !(1..=6).contains(&level) {
                return None;
            }
            if !trimmed.chars().nth(level).is_some_and(char::is_whitespace) {
                return None;
            }
            let title = strip_inline_code(trimmed[level..].trim());
            let slug = heading_slug(&title);
            if title.is_empty() || slug.is_empty() {
                return None;
            }
            Some(HeadingDto {
                level: level as u8,
                line: line_offset + index + 1,
                slug,
                title,
            })
        })
        .collect()
}

fn line_column_from_index(content: &str, index: usize) -> (usize, usize) {
    let prefix = &content[..index.min(content.len())];
    let line = prefix.bytes().filter(|byte| *byte == b'\n').count() + 1;
    let column = prefix.rsplit('\n').next().unwrap_or("").chars().count() + 1;
    (line, column)
}

fn parse_markdown_links(content: &str) -> Vec<LinkDto> {
    let chars: Vec<char> = content.chars().collect();
    let mut links = Vec::new();
    let mut i = 0;
    let mut byte_index = 0;

    while i < chars.len() {
        let start_byte = byte_index;
        let is_image = chars[i] == '!' && chars.get(i + 1) == Some(&'[');
        let link_start = if is_image { i + 1 } else { i };
        if chars.get(link_start) == Some(&'[') {
            if let Some(close_label_offset) =
                chars[link_start + 1..].iter().position(|ch| *ch == ']')
            {
                let close_label = link_start + 1 + close_label_offset;
                if !is_image && chars.get(close_label + 1) == Some(&'(') {
                    if let Some(close_target_offset) =
                        chars[close_label + 2..].iter().position(|ch| *ch == ')')
                    {
                        let close_target = close_label + 2 + close_target_offset;
                        let target: String = chars[close_label + 2..close_target].iter().collect();
                        let label: String = chars[link_start + 1..close_label].iter().collect();
                        if !target.trim().is_empty() {
                            let (line, column) = line_column_from_index(content, start_byte);
                            links.push(LinkDto {
                                column,
                                kind: "markdown".to_string(),
                                label: if label.trim().is_empty() {
                                    target.trim().to_string()
                                } else {
                                    label.trim().to_string()
                                },
                                line,
                                resolved_path: None,
                                target: target.trim().to_string(),
                            });
                        }
                        while i <= close_target {
                            byte_index += chars[i].len_utf8();
                            i += 1;
                        }
                        continue;
                    }
                }
            }
        }
        byte_index += chars[i].len_utf8();
        i += 1;
    }

    links
}

fn parse_wiki_links(content: &str) -> Vec<LinkDto> {
    let mut links = Vec::new();
    let bytes = content.as_bytes();
    let mut i = 0;

    while i + 3 < bytes.len() {
        if &bytes[i..i + 2] != b"[[" {
            i += 1;
            continue;
        }
        let Some(end) = content[i + 2..].find("]]") else {
            break;
        };
        let raw = &content[i + 2..i + 2 + end];
        let mut parts = raw.split('|');
        let target = parts
            .next()
            .unwrap_or("")
            .split('#')
            .next()
            .unwrap_or("")
            .trim();
        let label = parts.next().unwrap_or(target).trim();
        if !target.is_empty() {
            let (line, column) = line_column_from_index(content, i);
            links.push(LinkDto {
                column,
                kind: "wiki".to_string(),
                label: if label.is_empty() { target } else { label }.to_string(),
                line,
                resolved_path: None,
                target: target.to_string(),
            });
        }
        i += end + 4;
    }

    links
}

fn parse_links(content: &str) -> Vec<LinkDto> {
    let mut links = parse_markdown_links(content);
    links.extend(parse_wiki_links(content));
    links.sort_by(|a, b| a.line.cmp(&b.line).then(a.column.cmp(&b.column)));
    links
}

fn strip_target_metadata(target: &str) -> &str {
    target
        .split('#')
        .next()
        .unwrap_or("")
        .split('?')
        .next()
        .unwrap_or("")
        .trim()
}

fn is_external_target(target: &str) -> bool {
    target.starts_with("//") || target.contains("://")
}

fn normalize_path_parts(path: &str) -> String {
    let absolute = path.starts_with('/');
    let mut parts = Vec::new();
    for part in path.replace('\\', "/").split('/') {
        if part.is_empty() || part == "." {
            continue;
        }
        if part == ".." {
            parts.pop();
        } else {
            parts.push(part.to_string());
        }
    }
    if absolute {
        format!("/{}", parts.join("/"))
    } else {
        parts.join("/")
    }
}

fn resolve_markdown_link(
    source_path: &str,
    target: &str,
    documents: &[WorkspaceIndexedDocumentDto],
) -> Option<String> {
    let target = strip_target_metadata(target);
    if target.is_empty() || is_external_target(&target) {
        return None;
    }
    let source_dir = Path::new(source_path)
        .parent()
        .map(path_to_string)
        .unwrap_or_default();
    let resolved = if target.starts_with('/') {
        normalize_path_parts(target)
    } else {
        normalize_path_parts(&path_to_string(&Path::new(&source_dir).join(target)))
    };
    let mut candidates = vec![resolved.clone()];
    if !MARKDOWN_EXTENSIONS
        .iter()
        .any(|extension| resolved.to_lowercase().ends_with(&format!(".{extension}")))
    {
        candidates.push(format!("{resolved}.md"));
        candidates.push(format!("{resolved}.markdown"));
    }

    documents
        .iter()
        .find(|document| {
            candidates
                .iter()
                .any(|candidate| normalize_path(&document.path) == normalize_path(candidate))
        })
        .map(|document| document.path.clone())
}

fn wiki_aliases(document: &WorkspaceIndexedDocumentDto) -> Vec<String> {
    vec![
        document.relative_path.clone(),
        strip_markdown_extension(&document.relative_path),
        document.title.clone(),
        document.name.clone(),
        strip_markdown_extension(&document.name),
    ]
    .into_iter()
    .filter(|value| !value.is_empty())
    .map(|value| normalize_path(&normalize_path_parts(&value)))
    .collect()
}

fn resolve_wiki_link(target: &str, documents: &[WorkspaceIndexedDocumentDto]) -> Option<String> {
    let target = strip_markdown_extension(strip_target_metadata(target));
    if target.is_empty() || is_external_target(&target) {
        return None;
    }
    let normalized_target = normalize_path(&normalize_path_parts(&target));
    documents
        .iter()
        .find(|document| wiki_aliases(document).contains(&normalized_target))
        .map(|document| document.path.clone())
}

fn excerpt_for_line(content: &str, line: usize) -> String {
    content
        .lines()
        .nth(line.saturating_sub(1))
        .unwrap_or("")
        .trim()
        .chars()
        .take(160)
        .collect()
}

fn build_document(
    file: &WorkspaceFile,
    content: String,
    recent: Option<(f64, usize)>,
) -> WorkspaceIndexedDocumentDto {
    let parsed = parse_front_matter(&content);
    let headings = parse_headings(&parsed.body, parsed.front_matter_line_offset);
    let title = if parsed.front_matter.title.is_empty() {
        headings
            .first()
            .map(|heading| heading.title.clone())
            .unwrap_or_else(|| strip_markdown_extension(&file.name))
    } else {
        parsed.front_matter.title.clone()
    };

    WorkspaceIndexedDocumentDto {
        content,
        front_matter: parsed.front_matter,
        has_content: true,
        headings,
        last_opened: recent.map(|item| item.0),
        links: parse_links(&parsed.body),
        modified_at: file.modified_at,
        name: file.name.clone(),
        path: path_to_string(&file.path),
        recent_rank: recent.map(|item| item.1),
        relative_path: file.relative_path.clone(),
        size: file.size,
        title,
    }
}

fn has_stable_metadata(file: &WorkspaceFile) -> bool {
    file.modified_at.is_some() || file.size.is_some()
}

fn cached_document_matches(file: &WorkspaceFile, cached: &CachedIndexedDocument) -> bool {
    has_stable_metadata(file)
        && cached.modified_at == file.modified_at
        && cached.size == file.size
}

fn apply_recent_to_document(
    mut document: WorkspaceIndexedDocumentDto,
    recent: Option<(f64, usize)>,
) -> WorkspaceIndexedDocumentDto {
    document.last_opened = recent.map(|item| item.0);
    document.recent_rank = recent.map(|item| item.1);
    document
}

pub fn build_workspace_index(input: BuildWorkspaceIndexInput) -> PrismResult<WorkspaceIndexDto> {
    let root = canonicalize_existing_path(&input.root_path, "build_workspace_index")?;
    ensure_directory(&root, "build_workspace_index")?;

    let recent_by_path: HashMap<String, (f64, usize)> = input
        .recent_files
        .iter()
        .enumerate()
        .map(|(index, file)| {
            let path = canonicalize_existing_path(&file.path, "build_workspace_index")
                .map(|path| path_to_string(&path))
                .unwrap_or_else(|_| file.path.clone());
            (normalize_path(&path), (file.last_opened, index))
        })
        .collect();

    let override_by_path = input.current_document_override.as_ref().map(|document| {
        let path = canonicalize_existing_path(&document.path, "build_workspace_index")
            .map(|path| path_to_string(&path))
            .unwrap_or_else(|_| document.path.clone());
        (normalize_path(&path), document.content.clone())
    });

    let mut files = Vec::new();
    collect_workspace_files(&root, &root, &mut files)?;
    files.sort_by(|a, b| a.relative_path.cmp(&b.relative_path));

    let root_key = normalize_path(&path_to_string(&root));
    let cache_mutex = workspace_index_cache();
    let mut cache_by_root = cache_mutex.lock().unwrap_or_else(|poisoned| poisoned.into_inner());
    let workspace_cache = cache_by_root.entry(root_key).or_default();
    let mut active_cache_keys = HashSet::new();

    let mut documents: Vec<WorkspaceIndexedDocumentDto> = Vec::with_capacity(files.len());
    for file in &files {
        let key = normalize_path(&path_to_string(&file.path));
        active_cache_keys.insert(key.clone());
        let recent = recent_by_path.get(&key).copied();
        let override_content = override_by_path
            .as_ref()
            .filter(|(path, _)| path == &key)
            .map(|(_, content)| content.clone());

        let base_document = if let Some(content) = override_content {
            build_document(file, content, None)
        } else if let Some(cached) = workspace_cache
            .documents_by_path
            .get(&key)
            .filter(|cached| cached_document_matches(file, cached))
        {
            cached.document.clone()
        } else {
            let content = fs::read_to_string(&file.path).unwrap_or_default();
            let document = build_document(file, content, None);
            if has_stable_metadata(file) {
                workspace_cache.documents_by_path.insert(
                    key.clone(),
                    CachedIndexedDocument {
                        document: document.clone(),
                        modified_at: file.modified_at,
                        size: file.size,
                    },
                );
            }
            document
        };

        documents.push(apply_recent_to_document(base_document, recent));
    }

    workspace_cache
        .documents_by_path
        .retain(|key, _| active_cache_keys.contains(key));
    drop(cache_by_root);

    let document_paths: Vec<String> = documents
        .iter()
        .map(|document| document.path.clone())
        .collect();
    let resolved_documents = documents.clone();
    for (index, document) in documents.iter_mut().enumerate() {
        for link in document.links.iter_mut() {
            link.resolved_path = if link.kind == "wiki" {
                resolve_wiki_link(&link.target, &resolved_documents)
            } else {
                resolve_markdown_link(&document_paths[index], &link.target, &resolved_documents)
            };
        }
    }

    let mut backlinks_by_path: HashMap<String, Vec<BacklinkDto>> = HashMap::new();
    for document in &documents {
        for link in &document.links {
            let Some(resolved_path) = link.resolved_path.as_ref() else {
                continue;
            };
            if normalize_path(resolved_path) == normalize_path(&document.path) {
                continue;
            }
            backlinks_by_path
                .entry(normalize_path(resolved_path))
                .or_default()
                .push(BacklinkDto {
                    column: link.column,
                    excerpt: excerpt_for_line(&document.content, link.line),
                    line: link.line,
                    path: document.path.clone(),
                    title: document.title.clone(),
                });
        }
    }

    for backlinks in backlinks_by_path.values_mut() {
        backlinks.sort_by(|a, b| {
            a.title
                .cmp(&b.title)
                .then(a.line.cmp(&b.line))
                .then(a.column.cmp(&b.column))
        });
    }

    let mut recent_documents: Vec<WorkspaceIndexedDocumentDto> = documents
        .iter()
        .filter(|document| document.recent_rank.is_some())
        .cloned()
        .collect();
    recent_documents.sort_by_key(|document| document.recent_rank.unwrap_or(usize::MAX));

    Ok(WorkspaceIndexDto {
        backlinks_by_path,
        documents,
        generated_at: now_ms(),
        recent_documents,
        root_path: path_to_string(&root),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir(name: &str) -> PathBuf {
        let path = std::env::temp_dir().join(format!(
            "prism-workspace-index-{}-{}-{name}",
            std::process::id(),
            now_ms()
        ));
        fs::create_dir_all(&path).expect("create temp dir");
        path
    }

    #[test]
    fn builds_index_with_current_document_override_and_backlinks() {
        let root = temp_dir("links");
        let current = root.join("current.md");
        let other = root.join("other.md");
        fs::write(&current, "# Stale").expect("write current");
        fs::write(&other, "# Other\n\n[Current](current.md)").expect("write other");

        let index = build_workspace_index(BuildWorkspaceIndexInput {
            root_path: path_to_string(&root),
            current_document_override: Some(CurrentDocumentOverride {
                path: path_to_string(&current),
                content: "# Current\n\n[[Other]]".to_string(),
            }),
            recent_files: vec![RecentFileDto {
                path: path_to_string(&other),
                name: None,
                last_opened: 100.0,
            }],
        })
        .expect("build index");

        assert_eq!(index.documents.len(), 2);
        assert_eq!(
            index
                .documents
                .iter()
                .find(|document| document.name == "current.md")
                .expect("current")
                .title,
            "Current"
        );
        assert_eq!(index.recent_documents[0].name, "other.md");
        assert_eq!(
            index
                .backlinks_by_path
                .get(&normalize_path(&path_to_string(
                    &current.canonicalize().expect("canonical current")
                )))
                .expect("backlink")[0]
                .path,
            path_to_string(&other.canonicalize().expect("canonical other"))
        );

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn current_document_override_does_not_poison_metadata_cache() {
        let root = temp_dir("override-cache");
        let current = root.join("current.md");
        fs::write(&current, "# Disk").expect("write current");

        let disk_index = build_workspace_index(BuildWorkspaceIndexInput {
            root_path: path_to_string(&root),
            current_document_override: None,
            recent_files: vec![],
        })
        .expect("build disk index");
        assert_eq!(disk_index.documents[0].title, "Disk");

        let override_index = build_workspace_index(BuildWorkspaceIndexInput {
            root_path: path_to_string(&root),
            current_document_override: Some(CurrentDocumentOverride {
                path: path_to_string(&current),
                content: "# Unsaved".to_string(),
            }),
            recent_files: vec![],
        })
        .expect("build override index");
        assert_eq!(override_index.documents[0].title, "Unsaved");

        let cached_disk_index = build_workspace_index(BuildWorkspaceIndexInput {
            root_path: path_to_string(&root),
            current_document_override: None,
            recent_files: vec![],
        })
        .expect("build cached disk index");
        assert_eq!(cached_disk_index.documents[0].title, "Disk");

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn indexes_supported_documents_inside_dot_and_tool_directories() {
        let root = temp_dir("agent-dirs");
        fs::create_dir_all(root.join(".agents")).expect("create agents");
        fs::write(root.join(".agents").join("SKILL.md"), "# Skill").expect("write skill");
        fs::create_dir_all(root.join(".cache")).expect("create cache");
        fs::write(root.join(".cache").join("cached.md"), "# Cache").expect("write cache");
        fs::create_dir_all(root.join(".codex").join("agents")).expect("create codex agents");
        fs::write(
            root.join(".codex").join("agents").join("oec-dev.md"),
            "# Dev Agent",
        )
        .expect("write codex agent");
        fs::create_dir_all(root.join(".claude")).expect("create claude");
        fs::write(root.join(".claude").join("README.md"), "# Claude").expect("write claude");
        fs::create_dir_all(root.join(".git")).expect("create git");
        fs::write(root.join(".git").join("notes.md"), "# Git Notes").expect("write git");
        fs::create_dir_all(root.join(".idea")).expect("create idea");
        fs::write(root.join(".idea").join("notes.md"), "# Idea Notes").expect("write idea");
        fs::create_dir_all(root.join(".venv")).expect("create venv");
        fs::write(root.join(".venv").join("notes.md"), "# Venv Notes").expect("write venv");
        fs::create_dir_all(root.join("node_modules")).expect("create node_modules");
        fs::write(
            root.join("node_modules").join("notes.md"),
            "# Dependency Notes",
        )
        .expect("write node_modules");
        fs::create_dir_all(root.join("empty")).expect("create empty");
        fs::write(root.join("image.png"), "png").expect("write image");

        let index = build_workspace_index(BuildWorkspaceIndexInput {
            root_path: path_to_string(&root),
            current_document_override: None,
            recent_files: vec![],
        })
        .expect("build index");

        let relative_paths = index
            .documents
            .iter()
            .map(|document| document.relative_path.as_str())
            .collect::<Vec<_>>();

        assert_eq!(
            relative_paths,
            [
                ".agents/SKILL.md",
                ".cache/cached.md",
                ".claude/README.md",
                ".codex/agents/oec-dev.md",
                ".git/notes.md",
                ".idea/notes.md",
                ".venv/notes.md",
                "node_modules/notes.md",
            ]
        );

        let _ = fs::remove_dir_all(root);
    }
}
