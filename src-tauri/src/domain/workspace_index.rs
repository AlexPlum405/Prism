use serde::{Deserialize, Serialize};
use std::cmp::Ordering;
use std::collections::{HashMap, HashSet};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering as AtomicOrdering};
use std::sync::Arc;
use std::sync::{Mutex, OnceLock};
use std::time::{SystemTime, UNIX_EPOCH};

use super::error::{PrismCommandError, PrismResult};
use super::path::{canonicalize_existing_path, ensure_directory, path_to_string};
use super::workspace_ignore::is_ignored_workspace_directory;

const MARKDOWN_EXTENSIONS: &[&str] = &["md", "markdown"];
const TEXT_DOCUMENT_EXTENSIONS: &[&str] = &[
    "txt", "text", "sql", "json", "jsonc", "yaml", "yml", "toml", "xml", "csv", "tsv", "log",
    "ini", "conf", "env",
];
const DOCUMENT_EXTENSIONS: &[&str] = &[
    "md", "markdown", "txt", "text", "sql", "json", "jsonc", "yaml", "yml", "toml", "xml", "csv",
    "tsv", "log", "ini", "conf", "env",
];
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

#[derive(Debug, Clone, PartialEq)]
pub struct WorkspaceIndexBuildProgress {
    pub message: String,
    pub parsed_files: usize,
    pub progress: f64,
    pub scanned_files: usize,
    pub stage: String,
    pub total_files: usize,
}

pub type WorkspaceIndexProgressReporter =
    Arc<dyn Fn(WorkspaceIndexBuildProgress) + Send + Sync + 'static>;

#[derive(Clone, Default)]
pub struct WorkspaceIndexBuildOptions {
    pub cancel_requested: Option<Arc<AtomicBool>>,
    pub progress_reporter: Option<WorkspaceIndexProgressReporter>,
}

#[derive(Debug, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum WorkspaceIndexQueryMode {
    QuickOpen,
    FullText,
}

#[derive(Debug, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct QueryWorkspaceIndexInput {
    pub root_path: String,
    pub query: String,
    pub limit: usize,
    pub mode: WorkspaceIndexQueryMode,
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
    pub profile: String,
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

#[derive(Debug, Serialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceIndexSearchResultDto {
    pub document: WorkspaceIndexedDocumentDto,
    #[serde(rename = "match")]
    pub match_kind: String,
    pub score: i64,
    pub snippet: String,
}

#[derive(Debug, Serialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RelationGraphNodeDto {
    pub active: bool,
    pub backlink_count: usize,
    pub depth: usize,
    pub id: String,
    pub link_count: usize,
    pub path: String,
    pub relative_path: String,
    pub title: String,
}

#[derive(Debug, Serialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RelationGraphEdgeDto {
    pub id: String,
    pub source: String,
    pub target: String,
}

#[derive(Debug, Serialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct RelationGraphDto {
    pub edges: Vec<RelationGraphEdgeDto>,
    pub nodes: Vec<RelationGraphNodeDto>,
}

#[derive(Debug, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum RelationGraphScopeDto {
    Current,
    Workspace,
}

#[derive(Debug, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct BuildRelationGraphInput {
    pub current_path: Option<String>,
    pub depth: usize,
    pub limit: usize,
    pub query: Option<String>,
    pub scope: RelationGraphScopeDto,
}

#[derive(Debug, Deserialize, Clone, Copy, PartialEq)]
#[serde(rename_all = "camelCase")]
pub enum WorkspaceLinkTargetModeDto {
    Markdown,
    Wiki,
}

#[derive(Debug, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct QueryWorkspaceLinkTargetsInput {
    pub current_path: Option<String>,
    pub limit: usize,
    pub mode: WorkspaceLinkTargetModeDto,
    pub query: String,
}

#[derive(Debug, Serialize, Clone, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceLinkTargetDto {
    pub detail: String,
    pub kind: String,
    pub label: String,
    pub target: String,
    pub title: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct RawRelationEdge {
    source_key: String,
    target_key: String,
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

#[derive(Debug, Clone, PartialEq)]
struct WorkspaceFileSignature {
    modified_at: Option<f64>,
    path: String,
    size: Option<u64>,
}

#[derive(Debug, Default)]
struct WorkspaceIndexCache {
    base_index: Option<WorkspaceIndexDto>,
    base_index_signature: Vec<WorkspaceFileSignature>,
    documents_by_path: HashMap<String, CachedIndexedDocument>,
}

#[derive(Debug)]
struct WorkspaceDocumentsBuild {
    base_index_snapshot: Option<WorkspaceIndexDto>,
    can_reuse_base_index: bool,
    documents: Vec<WorkspaceIndexedDocumentDto>,
    manifest: Vec<WorkspaceFileSignature>,
    root: PathBuf,
    root_key: String,
    scanned_files: usize,
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

fn workspace_index_cancelled_error(stage: &str) -> PrismCommandError {
    PrismCommandError::new(
        "workspace_index_cancelled",
        "Workspace index build was cancelled",
    )
    .with_stage(stage)
}

fn is_workspace_index_cancelled(options: &WorkspaceIndexBuildOptions) -> bool {
    options
        .cancel_requested
        .as_ref()
        .map(|cancel_requested| cancel_requested.load(AtomicOrdering::Relaxed))
        .unwrap_or(false)
}

fn check_workspace_index_cancelled(
    options: &WorkspaceIndexBuildOptions,
    stage: &str,
) -> PrismResult<()> {
    if is_workspace_index_cancelled(options) {
        Err(workspace_index_cancelled_error(stage))
    } else {
        Ok(())
    }
}

fn report_workspace_index_progress(
    options: &WorkspaceIndexBuildOptions,
    stage: &str,
    message: impl Into<String>,
    progress: f64,
    scanned_files: usize,
    parsed_files: usize,
    total_files: usize,
) {
    let Some(reporter) = options.progress_reporter.as_ref() else {
        return;
    };

    reporter(WorkspaceIndexBuildProgress {
        message: message.into(),
        parsed_files,
        progress: progress.clamp(0.0, 0.99),
        scanned_files,
        stage: stage.to_string(),
        total_files,
    });
}

fn should_report_workspace_index_count(count: usize, total: usize) -> bool {
    count == 1 || count % 20 == 0 || (total > 0 && count == total)
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

fn strip_document_extension(value: &str) -> String {
    for extension in DOCUMENT_EXTENSIONS {
        let suffix = format!(".{extension}");
        if value.to_lowercase().ends_with(&suffix) {
            return value[..value.len() - suffix.len()].to_string();
        }
    }
    value.to_string()
}

fn extension_for_path(path: &Path) -> Option<String> {
    let name = path.file_name()?.to_string_lossy();
    let (_, extension) = name.rsplit_once('.')?;
    if extension.is_empty() {
        None
    } else {
        Some(extension.to_ascii_lowercase())
    }
}

fn document_profile_for_path(path: &Path) -> Option<&'static str> {
    let extension = extension_for_path(path)?;
    if MARKDOWN_EXTENSIONS
        .iter()
        .any(|allowed| extension.eq_ignore_ascii_case(allowed))
    {
        return Some("markdown");
    }
    if TEXT_DOCUMENT_EXTENSIONS
        .iter()
        .any(|allowed| extension.eq_ignore_ascii_case(allowed))
    {
        return Some("text");
    }
    None
}

fn is_supported_document_path(path: &Path) -> bool {
    document_profile_for_path(path).is_some()
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
    stage: &str,
    options: &WorkspaceIndexBuildOptions,
    scanned_files: &mut usize,
) -> PrismResult<()> {
    check_workspace_index_cancelled(options, stage)?;

    let entries = fs::read_dir(dir).map_err(|error| {
        PrismCommandError::new(
            "permission_denied",
            format!("Failed to read workspace: {error}"),
        )
        .with_path(path_to_string(dir))
        .with_stage(stage)
    })?;

    for entry in entries.flatten() {
        check_workspace_index_cancelled(options, stage)?;
        let path = entry.path();
        let name = entry.file_name().to_string_lossy().to_string();
        let Ok(file_type) = entry.file_type() else {
            continue;
        };
        if file_type.is_dir() {
            if is_ignored_workspace_directory(&path) {
                continue;
            }
            collect_workspace_files(root, &path, out, stage, options, scanned_files)?;
            continue;
        }
        if !file_type.is_file() || !is_supported_document_path(&path) {
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
        *scanned_files += 1;
        if should_report_workspace_index_count(*scanned_files, 0) {
            let progress = 0.05 + ((*scanned_files as f64).min(250.0) / 250.0) * 0.20;
            report_workspace_index_progress(
                options,
                "scan",
                format!("Scanning workspace files ({})", *scanned_files),
                progress,
                *scanned_files,
                0,
                0,
            );
        }
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

fn hex_value(byte: u8) -> Option<u8> {
    match byte {
        b'0'..=b'9' => Some(byte - b'0'),
        b'a'..=b'f' => Some(byte - b'a' + 10),
        b'A'..=b'F' => Some(byte - b'A' + 10),
        _ => None,
    }
}

fn percent_decode_target_path(target: &str) -> Option<String> {
    let bytes = target.as_bytes();
    let mut decoded = Vec::with_capacity(bytes.len());
    let mut index = 0;
    let mut changed = false;

    while index < bytes.len() {
        if bytes[index] == b'%' {
            let Some(high) = bytes.get(index + 1).and_then(|byte| hex_value(*byte)) else {
                return None;
            };
            let Some(low) = bytes.get(index + 2).and_then(|byte| hex_value(*byte)) else {
                return None;
            };
            decoded.push((high << 4) | low);
            index += 3;
            changed = true;
        } else {
            decoded.push(bytes[index]);
            index += 1;
        }
    }

    if changed {
        String::from_utf8(decoded).ok()
    } else {
        None
    }
}

fn target_path_variants(target: &str) -> Vec<String> {
    let stripped = strip_target_metadata(target);
    if stripped.is_empty() {
        return Vec::new();
    }

    let mut variants = vec![stripped.to_string()];
    if let Some(decoded) = percent_decode_target_path(stripped) {
        if decoded != stripped {
            variants.push(decoded);
        }
    }
    variants
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
    let stripped = strip_target_metadata(target);
    if stripped.is_empty() || is_external_target(stripped) {
        return None;
    }
    let source_dir = Path::new(source_path)
        .parent()
        .map(path_to_string)
        .unwrap_or_default();
    let mut candidates = Vec::new();
    for target in target_path_variants(target) {
        let resolved = if target.starts_with('/') {
            normalize_path_parts(&target)
        } else {
            normalize_path_parts(&path_to_string(&Path::new(&source_dir).join(&target)))
        };
        candidates.push(resolved.clone());
        if !MARKDOWN_EXTENSIONS
            .iter()
            .any(|extension| resolved.to_lowercase().ends_with(&format!(".{extension}")))
        {
            candidates.push(format!("{resolved}.md"));
            candidates.push(format!("{resolved}.markdown"));
        }
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
    let stripped = strip_target_metadata(target);
    if stripped.is_empty() || is_external_target(stripped) {
        return None;
    }
    let normalized_targets = target_path_variants(target)
        .into_iter()
        .map(|target| strip_markdown_extension(&target))
        .map(|target| normalize_path(&normalize_path_parts(&target)))
        .collect::<Vec<_>>();
    documents
        .iter()
        .find(|document| {
            let aliases = wiki_aliases(document);
            normalized_targets
                .iter()
                .any(|target| aliases.contains(target))
        })
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

fn empty_front_matter() -> FrontMatterDto {
    FrontMatterDto {
        author: String::new(),
        date: String::new(),
        description: String::new(),
        error: None,
        export_raw: String::new(),
        has_front_matter: false,
        status: String::new(),
        tags: Vec::new(),
        title: String::new(),
    }
}

fn build_document(
    file: &WorkspaceFile,
    content: String,
    recent: Option<(f64, usize)>,
) -> WorkspaceIndexedDocumentDto {
    let profile = document_profile_for_path(&file.path).unwrap_or("markdown");
    let (front_matter, headings, links, title) = if profile == "markdown" {
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
        (
            parsed.front_matter,
            headings,
            parse_links(&parsed.body),
            title,
        )
    } else {
        (
            empty_front_matter(),
            Vec::new(),
            Vec::new(),
            strip_document_extension(&file.name),
        )
    };

    WorkspaceIndexedDocumentDto {
        content,
        front_matter,
        has_content: true,
        headings,
        last_opened: recent.map(|item| item.0),
        links,
        modified_at: file.modified_at,
        name: file.name.clone(),
        path: path_to_string(&file.path),
        profile: profile.to_string(),
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
    has_stable_metadata(file) && cached.modified_at == file.modified_at && cached.size == file.size
}

fn apply_recent_to_document(
    mut document: WorkspaceIndexedDocumentDto,
    recent: Option<(f64, usize)>,
) -> WorkspaceIndexedDocumentDto {
    document.last_opened = recent.map(|item| item.0);
    document.recent_rank = recent.map(|item| item.1);
    document
}

fn recent_documents_from_documents(
    documents: &[WorkspaceIndexedDocumentDto],
) -> Vec<WorkspaceIndexedDocumentDto> {
    let mut recent_documents: Vec<WorkspaceIndexedDocumentDto> = documents
        .iter()
        .filter(|document| document.recent_rank.is_some())
        .cloned()
        .collect();
    recent_documents.sort_by_key(|document| document.recent_rank.unwrap_or(usize::MAX));
    recent_documents
}

fn workspace_manifest(files: &[WorkspaceFile]) -> Vec<WorkspaceFileSignature> {
    files
        .iter()
        .map(|file| WorkspaceFileSignature {
            modified_at: file.modified_at,
            path: normalize_path(&path_to_string(&file.path)),
            size: file.size,
        })
        .collect()
}

fn get_base_index_snapshot(
    root_key: &str,
    manifest: &[WorkspaceFileSignature],
) -> Option<WorkspaceIndexDto> {
    let cache_mutex = workspace_index_cache();
    let cache_by_root = cache_mutex.lock().ok()?;
    let workspace_cache = cache_by_root.get(root_key)?;
    if workspace_cache.base_index_signature == manifest {
        return workspace_cache.base_index.clone().map(|mut index| {
            index.generated_at = now_ms();
            index
        });
    }
    None
}

fn store_base_index_snapshot(
    root_key: String,
    manifest: Vec<WorkspaceFileSignature>,
    index: WorkspaceIndexDto,
) {
    let cache_mutex = workspace_index_cache();
    let mut cache_by_root = cache_mutex
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    let workspace_cache = cache_by_root.entry(root_key.clone()).or_default();
    workspace_cache.base_index_signature = manifest;
    workspace_cache.base_index = Some(index);
}

fn build_workspace_documents(
    input: BuildWorkspaceIndexInput,
    stage: &str,
    options: &WorkspaceIndexBuildOptions,
    allow_base_index_snapshot: bool,
) -> PrismResult<WorkspaceDocumentsBuild> {
    check_workspace_index_cancelled(options, stage)?;
    report_workspace_index_progress(
        options,
        "prepare",
        "Preparing workspace index",
        0.02,
        0,
        0,
        0,
    );

    let can_reuse_base_index =
        input.current_document_override.is_none() && input.recent_files.is_empty();
    let root = canonicalize_existing_path(&input.root_path, stage)?;
    ensure_directory(&root, stage)?;

    let recent_by_path: HashMap<String, (f64, usize)> = input
        .recent_files
        .iter()
        .enumerate()
        .map(|(index, file)| {
            let path = canonicalize_existing_path(&file.path, stage)
                .map(|path| path_to_string(&path))
                .unwrap_or_else(|_| file.path.clone());
            (normalize_path(&path), (file.last_opened, index))
        })
        .collect();

    let override_by_path = input.current_document_override.as_ref().map(|document| {
        let path = canonicalize_existing_path(&document.path, stage)
            .map(|path| path_to_string(&path))
            .unwrap_or_else(|_| document.path.clone());
        (normalize_path(&path), document.content.clone())
    });

    let mut files = Vec::new();
    let mut scanned_files = 0usize;
    report_workspace_index_progress(options, "scan", "Scanning workspace files", 0.05, 0, 0, 0);
    collect_workspace_files(&root, &root, &mut files, stage, options, &mut scanned_files)?;
    files.sort_by(|a, b| a.relative_path.cmp(&b.relative_path));
    let manifest = workspace_manifest(&files);

    let root_key = normalize_path(&path_to_string(&root));
    report_workspace_index_progress(
        options,
        "scan",
        format!("Found {} supported documents", files.len()),
        0.30,
        scanned_files,
        0,
        files.len(),
    );
    check_workspace_index_cancelled(options, stage)?;

    if allow_base_index_snapshot && can_reuse_base_index {
        if let Some(index) = get_base_index_snapshot(&root_key, &manifest) {
            report_workspace_index_progress(
                options,
                "cached",
                "Reusing workspace index snapshot",
                0.90,
                scanned_files,
                0,
                files.len(),
            );
            return Ok(WorkspaceDocumentsBuild {
                base_index_snapshot: Some(index),
                can_reuse_base_index,
                documents: Vec::new(),
                manifest,
                root,
                root_key,
                scanned_files,
            });
        }
    }

    let cache_mutex = workspace_index_cache();
    let mut cache_by_root = cache_mutex
        .lock()
        .unwrap_or_else(|poisoned| poisoned.into_inner());
    let workspace_cache = cache_by_root.entry(root_key.clone()).or_default();
    let mut active_cache_keys = HashSet::new();

    report_workspace_index_progress(
        options,
        "parse",
        "Building document index",
        0.32,
        scanned_files,
        0,
        files.len(),
    );
    let mut documents: Vec<WorkspaceIndexedDocumentDto> = Vec::with_capacity(files.len());
    let total_files = files.len();
    let mut parsed_files = 0usize;
    for file in &files {
        check_workspace_index_cancelled(options, stage)?;
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
        parsed_files += 1;
        if should_report_workspace_index_count(parsed_files, total_files) {
            let progress = if total_files == 0 {
                0.75
            } else {
                0.32 + (parsed_files as f64 / total_files as f64) * 0.43
            };
            report_workspace_index_progress(
                options,
                "parse",
                format!("Building document index ({parsed_files}/{total_files})"),
                progress,
                scanned_files,
                parsed_files,
                total_files,
            );
        }
    }

    workspace_cache
        .documents_by_path
        .retain(|key, _| active_cache_keys.contains(key));
    drop(cache_by_root);
    report_workspace_index_progress(
        options,
        "parse",
        "Document index is ready",
        0.75,
        scanned_files,
        parsed_files,
        total_files,
    );
    check_workspace_index_cancelled(options, stage)?;

    Ok(WorkspaceDocumentsBuild {
        base_index_snapshot: None,
        can_reuse_base_index,
        documents,
        manifest,
        root,
        root_key,
        scanned_files,
    })
}

pub fn build_workspace_index(input: BuildWorkspaceIndexInput) -> PrismResult<WorkspaceIndexDto> {
    build_workspace_index_with_options(input, WorkspaceIndexBuildOptions::default())
}

pub fn build_workspace_index_with_options(
    input: BuildWorkspaceIndexInput,
    options: WorkspaceIndexBuildOptions,
) -> PrismResult<WorkspaceIndexDto> {
    let build = build_workspace_documents(input, "build_workspace_index", &options, true)?;
    if let Some(index) = build.base_index_snapshot {
        return Ok(index);
    }

    let WorkspaceDocumentsBuild {
        base_index_snapshot: _,
        can_reuse_base_index,
        mut documents,
        manifest,
        root,
        root_key,
        scanned_files,
    } = build;

    let total_files = documents.len();
    report_workspace_index_progress(
        &options,
        "resolve",
        "Resolving workspace links",
        0.80,
        scanned_files,
        total_files,
        total_files,
    );
    check_workspace_index_cancelled(&options, "build_workspace_index")?;

    let document_paths: Vec<String> = documents
        .iter()
        .map(|document| document.path.clone())
        .collect();
    let resolved_documents = documents.clone();
    let markdown_documents = resolved_documents
        .iter()
        .filter(|document| document.profile == "markdown")
        .cloned()
        .collect::<Vec<_>>();
    for (index, document) in documents.iter_mut().enumerate() {
        check_workspace_index_cancelled(&options, "build_workspace_index")?;
        if document.profile != "markdown" {
            document.links.clear();
            continue;
        }
        for link in document.links.iter_mut() {
            link.resolved_path = if link.kind == "wiki" {
                resolve_wiki_link(&link.target, &markdown_documents)
            } else {
                resolve_markdown_link(&document_paths[index], &link.target, &markdown_documents)
            };
        }
    }

    report_workspace_index_progress(
        &options,
        "backlinks",
        "Building workspace backlinks",
        0.88,
        scanned_files,
        total_files,
        total_files,
    );
    check_workspace_index_cancelled(&options, "build_workspace_index")?;

    let mut backlinks_by_path: HashMap<String, Vec<BacklinkDto>> = HashMap::new();
    for document in &documents {
        check_workspace_index_cancelled(&options, "build_workspace_index")?;
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

    report_workspace_index_progress(
        &options,
        "finalize",
        "Finalizing workspace index",
        0.94,
        scanned_files,
        total_files,
        total_files,
    );
    check_workspace_index_cancelled(&options, "build_workspace_index")?;

    let recent_documents = recent_documents_from_documents(&documents);

    let index = WorkspaceIndexDto {
        backlinks_by_path,
        documents,
        generated_at: now_ms(),
        recent_documents,
        root_path: path_to_string(&root),
    };

    if can_reuse_base_index {
        store_base_index_snapshot(root_key, manifest, index.clone());
    }

    Ok(index)
}

fn dirname_for_link_target(path: &str) -> String {
    let normalized = path.replace('\\', "/");
    let Some((dir, _)) = normalized.rsplit_once('/') else {
        return String::new();
    };
    if dir.is_empty() {
        "/".to_string()
    } else {
        dir.to_string()
    }
}

fn path_segments(value: &str) -> Vec<String> {
    normalize_path_parts(value)
        .split('/')
        .filter(|part| !part.is_empty())
        .map(str::to_string)
        .collect()
}

fn relative_path_between(from_dir: &str, to_path: &str) -> String {
    let mut from_parts = path_segments(from_dir);
    let mut to_parts = path_segments(to_path);
    while !from_parts.is_empty()
        && !to_parts.is_empty()
        && from_parts[0].eq_ignore_ascii_case(&to_parts[0])
    {
        from_parts.remove(0);
        to_parts.remove(0);
    }
    format!("{}{}", "../".repeat(from_parts.len()), to_parts.join("/"))
}

fn link_target_for_document(
    document: &WorkspaceIndexedDocumentDto,
    current_path: Option<&str>,
) -> String {
    current_path
        .map(dirname_for_link_target)
        .filter(|current_dir| !current_dir.is_empty())
        .map(|current_dir| relative_path_between(&current_dir, &document.path))
        .filter(|target| !target.is_empty())
        .unwrap_or_else(|| document.relative_path.clone())
}

fn link_target_matches_query(target: &WorkspaceLinkTargetDto, query: &str) -> bool {
    query.is_empty()
        || target.label.to_lowercase().contains(query)
        || target.detail.to_lowercase().contains(query)
        || target.target.to_lowercase().contains(query)
        || target.title.to_lowercase().contains(query)
}

fn push_link_target(
    targets: &mut Vec<WorkspaceLinkTargetDto>,
    target: WorkspaceLinkTargetDto,
    query: &str,
    limit: usize,
) {
    if targets.len() >= limit || !link_target_matches_query(&target, query) {
        return;
    }
    targets.push(target);
}

pub fn query_workspace_link_targets(
    index: &WorkspaceIndexDto,
    input: QueryWorkspaceLinkTargetsInput,
) -> Vec<WorkspaceLinkTargetDto> {
    let limit = if input.limit == 0 { 80 } else { input.limit };
    let query = input.query.trim().to_lowercase();
    let current_path = input.current_path.as_deref();
    let mut targets = Vec::new();

    for document in &index.documents {
        if document.profile != "markdown" {
            continue;
        }
        let target = link_target_for_document(document, current_path);
        match input.mode {
            WorkspaceLinkTargetModeDto::Markdown => {
                push_link_target(
                    &mut targets,
                    WorkspaceLinkTargetDto {
                        detail: document.name.clone(),
                        kind: "file".to_string(),
                        label: target.clone(),
                        target,
                        title: document.title.clone(),
                    },
                    &query,
                    limit,
                );
            }
            WorkspaceLinkTargetModeDto::Wiki => {
                let path_label = strip_markdown_extension(&document.relative_path);
                let title = document.title.trim();
                let title = if title.is_empty() {
                    strip_markdown_extension(&document.name)
                } else {
                    title.to_string()
                };

                push_link_target(
                    &mut targets,
                    WorkspaceLinkTargetDto {
                        detail: document.title.clone(),
                        kind: "file".to_string(),
                        label: path_label.clone(),
                        target: target.clone(),
                        title: title.clone(),
                    },
                    &query,
                    limit,
                );

                if normalize_path(&title) != normalize_path(&path_label) {
                    push_link_target(
                        &mut targets,
                        WorkspaceLinkTargetDto {
                            detail: document.relative_path.clone(),
                            kind: "file".to_string(),
                            label: title.clone(),
                            target: target.clone(),
                            title: title.clone(),
                        },
                        &query,
                        limit,
                    );
                }

                for heading in &document.headings {
                    if heading.title.is_empty() || heading.slug.is_empty() {
                        continue;
                    }
                    push_link_target(
                        &mut targets,
                        WorkspaceLinkTargetDto {
                            detail: format!("{}#{}", document.relative_path, heading.slug),
                            kind: "keyword".to_string(),
                            label: heading.title.clone(),
                            target: format!("{}#{}", target, heading.slug),
                            title: heading.title.clone(),
                        },
                        &query,
                        limit,
                    );
                }
            }
        }
    }

    targets
}

fn compare_relative_path(
    a: &WorkspaceIndexedDocumentDto,
    b: &WorkspaceIndexedDocumentDto,
) -> Ordering {
    normalize_path(&a.relative_path).cmp(&normalize_path(&b.relative_path))
}

fn recent_boost(document: &WorkspaceIndexedDocumentDto) -> i64 {
    document
        .recent_rank
        .map(|rank| 1_i64.max(12 - rank as i64))
        .unwrap_or(0)
}

fn content_snippet(content: &str, normalized_content: &str, normalized_query: &str) -> String {
    let Some(byte_index) = normalized_content.find(normalized_query) else {
        return String::new();
    };
    let match_start = normalized_content[..byte_index].chars().count();
    let match_len = normalized_query.chars().count();
    let chars = content.chars().collect::<Vec<_>>();
    let start = match_start.saturating_sub(48);
    let end = (match_start + match_len + 80).min(chars.len());
    chars[start..end]
        .iter()
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

fn search_result(
    document: &WorkspaceIndexedDocumentDto,
    match_kind: &str,
    score: i64,
    snippet: String,
) -> WorkspaceIndexSearchResultDto {
    WorkspaceIndexSearchResultDto {
        document: document.clone(),
        match_kind: match_kind.to_string(),
        score,
        snippet,
    }
}

fn rank_document_for_query(
    document: &WorkspaceIndexedDocumentDto,
    normalized_query: &str,
    mode: &WorkspaceIndexQueryMode,
) -> Option<WorkspaceIndexSearchResultDto> {
    let title = document.title.to_lowercase();
    let name = document.name.to_lowercase();
    let relative_path = document.relative_path.to_lowercase();
    let heading = document
        .headings
        .iter()
        .find(|item| item.title.to_lowercase().contains(normalized_query));
    let boost = recent_boost(document);
    let detail_snippet = match mode {
        WorkspaceIndexQueryMode::QuickOpen => document.relative_path.clone(),
        WorkspaceIndexQueryMode::FullText => document.title.clone(),
    };
    let name_snippet = match mode {
        WorkspaceIndexQueryMode::QuickOpen => document.relative_path.clone(),
        WorkspaceIndexQueryMode::FullText => document.name.clone(),
    };

    if title == normalized_query {
        return Some(search_result(
            document,
            "title",
            120 + boost,
            detail_snippet,
        ));
    }
    if name == normalized_query {
        return Some(search_result(document, "name", 110 + boost, name_snippet));
    }
    if title.contains(normalized_query) {
        return Some(search_result(document, "title", 90 + boost, detail_snippet));
    }
    if name.contains(normalized_query) {
        return Some(search_result(document, "name", 80 + boost, name_snippet));
    }
    if relative_path.contains(normalized_query) {
        return Some(search_result(
            document,
            "path",
            55 + boost,
            document.relative_path.clone(),
        ));
    }
    if let Some(heading) = heading {
        return Some(search_result(
            document,
            "heading",
            45 + boost,
            heading.title.clone(),
        ));
    }
    if mode == &WorkspaceIndexQueryMode::FullText {
        let content = document.content.to_lowercase();
        if content.contains(normalized_query) {
            return Some(search_result(
                document,
                "content",
                25 + boost,
                content_snippet(&document.content, &content, normalized_query),
            ));
        }
    }

    None
}

fn empty_workspace_query_results(
    documents: &[WorkspaceIndexedDocumentDto],
    limit: usize,
    mode: &WorkspaceIndexQueryMode,
) -> Vec<WorkspaceIndexSearchResultDto> {
    let recent_documents = recent_documents_from_documents(documents);
    match mode {
        WorkspaceIndexQueryMode::FullText => recent_documents
            .iter()
            .take(limit)
            .map(|document| search_result(document, "name", 1, document.relative_path.clone()))
            .collect(),
        WorkspaceIndexQueryMode::QuickOpen => {
            let recent_paths = recent_documents
                .iter()
                .map(|document| normalize_path(&document.path))
                .collect::<HashSet<_>>();
            let mut rest = documents
                .iter()
                .filter(|document| !recent_paths.contains(&normalize_path(&document.path)))
                .cloned()
                .collect::<Vec<_>>();
            rest.sort_by(|a, b| {
                b.modified_at
                    .unwrap_or(0.0)
                    .partial_cmp(&a.modified_at.unwrap_or(0.0))
                    .unwrap_or(Ordering::Equal)
                    .then_with(|| compare_relative_path(a, b))
            });

            recent_documents
                .iter()
                .chain(rest.iter())
                .take(limit)
                .map(|document| {
                    let score = document
                        .recent_rank
                        .map(|rank| 20 - rank as i64)
                        .unwrap_or(1);
                    search_result(document, "name", score, document.relative_path.clone())
                })
                .collect()
        }
    }
}

fn query_workspace_documents(
    documents: &[WorkspaceIndexedDocumentDto],
    query: &str,
    limit: usize,
    mode: &WorkspaceIndexQueryMode,
) -> Vec<WorkspaceIndexSearchResultDto> {
    if limit == 0 {
        return Vec::new();
    }

    let normalized_query = query.trim().to_lowercase();
    if normalized_query.is_empty() {
        return empty_workspace_query_results(documents, limit, mode);
    }

    let mut results = documents
        .iter()
        .filter_map(|document| rank_document_for_query(document, &normalized_query, mode))
        .collect::<Vec<_>>();
    results.sort_by(|a, b| {
        b.score
            .cmp(&a.score)
            .then_with(|| compare_relative_path(&a.document, &b.document))
    });
    results.truncate(limit);
    results
}

pub fn query_workspace_index(
    input: QueryWorkspaceIndexInput,
) -> PrismResult<Vec<WorkspaceIndexSearchResultDto>> {
    let QueryWorkspaceIndexInput {
        root_path,
        query,
        limit,
        mode,
        current_document_override,
        recent_files,
    } = input;
    let build = build_workspace_documents(
        BuildWorkspaceIndexInput {
            root_path,
            current_document_override,
            recent_files,
        },
        "query_workspace_index",
        &WorkspaceIndexBuildOptions::default(),
        false,
    )?;

    Ok(query_workspace_documents(
        &build.documents,
        &query,
        limit,
        &mode,
    ))
}

pub fn get_workspace_index_backlinks(index: &WorkspaceIndexDto, path: &str) -> Vec<BacklinkDto> {
    index
        .backlinks_by_path
        .get(&normalize_path(path))
        .cloned()
        .unwrap_or_default()
}

fn normalize_relation_query(value: Option<&str>) -> String {
    value.unwrap_or_default().trim().to_lowercase()
}

fn document_matches_relation_query(document: &WorkspaceIndexedDocumentDto, query: &str) -> bool {
    if query.is_empty() {
        return true;
    }

    document.title.to_lowercase().contains(query)
        || document.name.to_lowercase().contains(query)
        || document.relative_path.to_lowercase().contains(query)
        || document
            .headings
            .iter()
            .any(|heading| heading.title.to_lowercase().contains(query))
}

fn collect_relation_edges(index: &WorkspaceIndexDto) -> Vec<RawRelationEdge> {
    let document_keys = index
        .documents
        .iter()
        .filter(|document| document.profile == "markdown")
        .map(|document| normalize_path(&document.path))
        .collect::<HashSet<_>>();
    let mut edges = Vec::new();

    for document in &index.documents {
        if document.profile != "markdown" {
            continue;
        }
        let source_key = normalize_path(&document.path);
        for link in &document.links {
            let Some(resolved_path) = link.resolved_path.as_ref() else {
                continue;
            };
            let target_key = normalize_path(resolved_path);
            if source_key == target_key || !document_keys.contains(&target_key) {
                continue;
            }
            edges.push(RawRelationEdge {
                source_key: source_key.clone(),
                target_key,
            });
        }
    }

    edges
}

fn relation_adjacency(
    edges: &[RawRelationEdge],
) -> (
    HashMap<String, HashSet<String>>,
    HashMap<String, HashSet<String>>,
) {
    let mut outgoing: HashMap<String, HashSet<String>> = HashMap::new();
    let mut incoming: HashMap<String, HashSet<String>> = HashMap::new();

    for edge in edges {
        outgoing
            .entry(edge.source_key.clone())
            .or_default()
            .insert(edge.target_key.clone());
        incoming
            .entry(edge.target_key.clone())
            .or_default()
            .insert(edge.source_key.clone());
    }

    (outgoing, incoming)
}

fn collect_current_relation_keys(
    current_key: &str,
    depth: usize,
    outgoing: &HashMap<String, HashSet<String>>,
    incoming: &HashMap<String, HashSet<String>>,
) -> HashMap<String, usize> {
    let mut depths = HashMap::from([(current_key.to_string(), 0)]);
    let mut frontier = HashSet::from([current_key.to_string()]);
    let max_depth = depth.clamp(1, 2);

    for current_depth in 1..=max_depth {
        let mut next = HashSet::new();
        for key in &frontier {
            let mut neighbors = HashSet::new();
            neighbors.extend(outgoing.get(key).cloned().unwrap_or_default());
            neighbors.extend(incoming.get(key).cloned().unwrap_or_default());
            for neighbor in neighbors {
                if !depths.contains_key(&neighbor) {
                    depths.insert(neighbor.clone(), current_depth);
                    next.insert(neighbor);
                }
            }
        }
        frontier = next;
    }

    depths
}

pub fn build_relation_graph(
    index: &WorkspaceIndexDto,
    input: BuildRelationGraphInput,
) -> RelationGraphDto {
    let normalized_query = normalize_relation_query(input.query.as_deref());
    let current_key = input
        .current_path
        .as_deref()
        .map(normalize_path)
        .unwrap_or_default();
    let raw_edges = collect_relation_edges(index);
    let (outgoing, incoming) = relation_adjacency(&raw_edges);
    let document_by_key = index
        .documents
        .iter()
        .filter(|document| document.profile == "markdown")
        .map(|document| (normalize_path(&document.path), document))
        .collect::<HashMap<_, _>>();
    let current_document_exists =
        !current_key.is_empty() && document_by_key.contains_key(&current_key);
    let depth_by_key = if input.scope == RelationGraphScopeDto::Current && current_document_exists {
        collect_current_relation_keys(&current_key, input.depth, &outgoing, &incoming)
    } else {
        index
            .documents
            .iter()
            .filter(|document| document.profile == "markdown")
            .map(|document| (normalize_path(&document.path), 0))
            .collect::<HashMap<_, _>>()
    };
    let selected_keys = depth_by_key.keys().cloned().collect::<HashSet<_>>();
    let mut filtered_documents = index
        .documents
        .iter()
        .filter(|document| document.profile == "markdown")
        .filter(|document| selected_keys.contains(&normalize_path(&document.path)))
        .filter(|document| document_matches_relation_query(document, &normalized_query))
        .collect::<Vec<_>>();
    filtered_documents.sort_by(|a, b| {
        let a_key = normalize_path(&a.path);
        let b_key = normalize_path(&b.path);
        (if a_key == current_key { -1 } else { 0 })
            .cmp(&(if b_key == current_key { -1 } else { 0 }))
            .then_with(|| {
                depth_by_key
                    .get(&a_key)
                    .unwrap_or(&0)
                    .cmp(depth_by_key.get(&b_key).unwrap_or(&0))
            })
            .then_with(|| compare_relative_path(a, b))
    });
    let limit = if input.limit == 0 { 80 } else { input.limit };
    filtered_documents.truncate(limit);

    let visible_keys = filtered_documents
        .iter()
        .map(|document| normalize_path(&document.path))
        .collect::<HashSet<_>>();
    let nodes = filtered_documents
        .iter()
        .map(|document| {
            let key = normalize_path(&document.path);
            RelationGraphNodeDto {
                active: key == current_key,
                backlink_count: incoming.get(&key).map(HashSet::len).unwrap_or(0),
                depth: *depth_by_key.get(&key).unwrap_or(&0),
                id: key,
                link_count: outgoing
                    .get(&normalize_path(&document.path))
                    .map(HashSet::len)
                    .unwrap_or(0),
                path: document.path.clone(),
                relative_path: document.relative_path.clone(),
                title: document.title.clone(),
            }
        })
        .collect::<Vec<_>>();

    let mut edge_ids = HashSet::new();
    let mut edges = Vec::new();
    for edge in raw_edges {
        if !visible_keys.contains(&edge.source_key) || !visible_keys.contains(&edge.target_key) {
            continue;
        }
        let id = format!("{}->{}", edge.source_key, edge.target_key);
        if !edge_ids.insert(id.clone()) {
            continue;
        }
        edges.push(RelationGraphEdgeDto {
            id,
            source: edge.source_key,
            target: edge.target_key,
        });
    }

    RelationGraphDto { edges, nodes }
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
    fn indexes_supported_documents_inside_agent_dirs_and_skips_generated_dirs() {
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
        fs::create_dir_all(root.join("dist")).expect("create dist");
        fs::write(root.join("dist").join("bundle.md"), "# Dist Notes").expect("write dist");
        fs::create_dir_all(root.join("node_modules")).expect("create node_modules");
        fs::write(
            root.join("node_modules").join("notes.md"),
            "# Dependency Notes",
        )
        .expect("write node_modules");
        fs::create_dir_all(root.join("src-tauri").join("target")).expect("create target");
        fs::write(
            root.join("src-tauri").join("target").join("artifact.md"),
            "# Target Notes",
        )
        .expect("write target");
        fs::write(root.join("settings.json"), "{\"needle\": true}").expect("write json");
        fs::write(root.join(".env"), "TOKEN=local").expect("write env");
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
                ".claude/README.md",
                ".codex/agents/oec-dev.md",
                ".env",
                "settings.json",
            ]
        );
        for ignored_path in [
            ".cache/cached.md",
            ".git/notes.md",
            ".idea/notes.md",
            ".venv/notes.md",
            "dist/bundle.md",
            "node_modules/notes.md",
            "src-tauri/target/artifact.md",
        ] {
            assert!(
                !relative_paths.contains(&ignored_path),
                "expected generated path to be skipped: {ignored_path}"
            );
        }
        assert_eq!(
            index
                .documents
                .iter()
                .find(|document| document.relative_path == "settings.json")
                .expect("settings")
                .profile,
            "text"
        );

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn queries_workspace_index_for_quick_open_and_full_text() {
        let root = temp_dir("query");
        fs::create_dir_all(root.join("docs")).expect("create docs");
        let guide = root.join("docs").join("guide.md");
        let api = root.join("docs").join("api.md");
        let query = root.join("docs").join("query.sql");
        fs::write(&guide, "# Guide\n\nneedle target content").expect("write guide");
        fs::write(&api, "# API Reference\n\ninvoke contract").expect("write api");
        fs::write(&query, "select * from orders where status = 'needle';").expect("write sql");

        let quick_results = query_workspace_index(QueryWorkspaceIndexInput {
            root_path: path_to_string(&root),
            query: "api".to_string(),
            limit: 10,
            mode: WorkspaceIndexQueryMode::QuickOpen,
            current_document_override: None,
            recent_files: vec![RecentFileDto {
                path: path_to_string(&guide),
                name: None,
                last_opened: 300.0,
            }],
        })
        .expect("query quick open");

        assert_eq!(quick_results[0].match_kind, "title");
        assert_eq!(quick_results[0].document.relative_path, "docs/api.md");
        assert_eq!(quick_results[0].snippet, "docs/api.md");

        let empty_quick_results = query_workspace_index(QueryWorkspaceIndexInput {
            root_path: path_to_string(&root),
            query: String::new(),
            limit: 10,
            mode: WorkspaceIndexQueryMode::QuickOpen,
            current_document_override: None,
            recent_files: vec![RecentFileDto {
                path: path_to_string(&guide),
                name: None,
                last_opened: 300.0,
            }],
        })
        .expect("empty quick open");
        assert_eq!(
            empty_quick_results[0].document.relative_path,
            "docs/guide.md"
        );

        let full_text_results = query_workspace_index(QueryWorkspaceIndexInput {
            root_path: path_to_string(&root),
            query: "needle".to_string(),
            limit: 10,
            mode: WorkspaceIndexQueryMode::FullText,
            current_document_override: None,
            recent_files: vec![],
        })
        .expect("query full text");

        assert_eq!(full_text_results[0].match_kind, "content");
        assert_eq!(
            full_text_results
                .iter()
                .map(|result| result.document.relative_path.as_str())
                .collect::<Vec<_>>(),
            ["docs/guide.md", "docs/query.sql"]
        );
        assert!(full_text_results[0].snippet.contains("needle"));
        assert_eq!(full_text_results[1].document.profile, "text");

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn workspace_query_uses_current_document_override() {
        let root = temp_dir("query-override");
        let current = root.join("current.md");
        fs::write(&current, "# Disk title").expect("write current");

        let results = query_workspace_index(QueryWorkspaceIndexInput {
            root_path: path_to_string(&root),
            query: "Unsaved".to_string(),
            limit: 10,
            mode: WorkspaceIndexQueryMode::FullText,
            current_document_override: Some(CurrentDocumentOverride {
                path: path_to_string(&current),
                content: "# Unsaved title\n\nfresh body".to_string(),
            }),
            recent_files: vec![],
        })
        .expect("query with override");

        assert_eq!(results[0].match_kind, "title");
        assert_eq!(results[0].document.title, "Unsaved title");

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn queries_backlinks_and_relation_graph_from_index() {
        let root = temp_dir("relation");
        fs::create_dir_all(root.join("docs")).expect("create docs");
        let alpha = root.join("docs").join("alpha.md");
        let beta = root.join("docs").join("beta.md");
        let gamma = root.join("docs").join("gamma.md");
        let query = root.join("docs").join("query.sql");
        fs::write(&alpha, "---\ntitle: Alpha\n---\n[Beta](beta.md)").expect("write alpha");
        fs::write(&beta, "# Beta\n[[gamma]]").expect("write beta");
        fs::write(&gamma, "# Gamma").expect("write gamma");
        fs::write(&query, "select '[[gamma]]';").expect("write sql");

        let index = build_workspace_index(BuildWorkspaceIndexInput {
            root_path: path_to_string(&root),
            current_document_override: None,
            recent_files: vec![],
        })
        .expect("build index");
        let beta_path = path_to_string(&beta.canonicalize().expect("canonical beta"));
        let backlinks = get_workspace_index_backlinks(&index, &beta_path);

        assert_eq!(backlinks.len(), 1);
        assert_eq!(backlinks[0].title, "Alpha");

        let graph = build_relation_graph(
            &index,
            BuildRelationGraphInput {
                current_path: Some(beta_path),
                depth: 1,
                limit: 80,
                query: None,
                scope: RelationGraphScopeDto::Current,
            },
        );

        assert_eq!(
            graph
                .nodes
                .iter()
                .map(|node| node.relative_path.as_str())
                .collect::<Vec<_>>(),
            ["docs/beta.md", "docs/alpha.md", "docs/gamma.md"]
        );
        assert!(!graph
            .nodes
            .iter()
            .any(|node| node.relative_path == "docs/query.sql"));
        assert_eq!(
            graph
                .edges
                .iter()
                .map(|edge| edge.id.as_str())
                .collect::<Vec<_>>(),
            [
                normalize_path(&format!(
                    "{}->{}",
                    path_to_string(&alpha.canonicalize().expect("canonical alpha")),
                    path_to_string(&beta.canonicalize().expect("canonical beta"))
                )),
                normalize_path(&format!(
                    "{}->{}",
                    path_to_string(&beta.canonicalize().expect("canonical beta")),
                    path_to_string(&gamma.canonicalize().expect("canonical gamma"))
                )),
            ]
        );

        let filtered = build_relation_graph(
            &index,
            BuildRelationGraphInput {
                current_path: None,
                depth: 1,
                limit: 80,
                query: Some("Gamma".to_string()),
                scope: RelationGraphScopeDto::Workspace,
            },
        );
        assert_eq!(filtered.nodes[0].relative_path, "docs/gamma.md");
        assert!(filtered.edges.is_empty());

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn resolves_url_encoded_markdown_links_in_relation_graph() {
        let root = temp_dir("encoded-relation");
        let current = root.join("Prism UI Audit.md");
        let linked = root.join("Linked Note.md");
        fs::write(
            &current,
            "# Prism UI Audit\n\nThis links to [Linked Note](Linked%20Note.md).",
        )
        .expect("write current");
        fs::write(&linked, "# Linked Note").expect("write linked");

        let index = build_workspace_index(BuildWorkspaceIndexInput {
            root_path: path_to_string(&root),
            current_document_override: None,
            recent_files: vec![],
        })
        .expect("build index");
        let current_path = path_to_string(&current.canonicalize().expect("canonical current"));
        let linked_path = path_to_string(&linked.canonicalize().expect("canonical linked"));
        let current_document = index
            .documents
            .iter()
            .find(|document| document.path == current_path)
            .expect("current document");

        assert_eq!(current_document.links[0].target, "Linked%20Note.md");
        assert_eq!(
            current_document.links[0].resolved_path,
            Some(linked_path.clone())
        );
        assert_eq!(
            get_workspace_index_backlinks(&index, &linked_path)[0].path,
            current_path
        );

        let graph = build_relation_graph(
            &index,
            BuildRelationGraphInput {
                current_path: Some(current_path.clone()),
                depth: 1,
                limit: 80,
                query: None,
                scope: RelationGraphScopeDto::Current,
            },
        );

        assert_eq!(
            graph
                .nodes
                .iter()
                .map(|node| node.relative_path.as_str())
                .collect::<Vec<_>>(),
            ["Prism UI Audit.md", "Linked Note.md"]
        );
        assert_eq!(
            graph
                .edges
                .iter()
                .map(|edge| edge.id.as_str())
                .collect::<Vec<_>>(),
            [normalize_path(&format!("{current_path}->{linked_path}"))]
        );

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn queries_workspace_link_targets_for_markdown_and_wiki_completion() {
        let root = temp_dir("link-targets");
        fs::create_dir_all(root.join("docs")).expect("create docs");
        let current = root.join("docs").join("current.md");
        let guide = root.join("docs").join("guide.md");
        let readme = root.join("README.md");
        fs::write(&current, "# Current").expect("write current");
        fs::write(&guide, "---\ntitle: 入门指南\n---\n# 安装步骤\n正文").expect("write guide");
        fs::write(&readme, "# Readme").expect("write readme");

        let index = build_workspace_index(BuildWorkspaceIndexInput {
            root_path: path_to_string(&root),
            current_document_override: None,
            recent_files: vec![],
        })
        .expect("build index");
        let current_path = path_to_string(&current.canonicalize().expect("canonical current"));

        let wiki_targets = query_workspace_link_targets(
            &index,
            QueryWorkspaceLinkTargetsInput {
                current_path: Some(current_path.clone()),
                limit: 10,
                mode: WorkspaceLinkTargetModeDto::Wiki,
                query: "安装".to_string(),
            },
        );
        assert_eq!(
            wiki_targets[0],
            WorkspaceLinkTargetDto {
                detail: "docs/guide.md#安装步骤".to_string(),
                kind: "keyword".to_string(),
                label: "安装步骤".to_string(),
                target: "guide.md#安装步骤".to_string(),
                title: "安装步骤".to_string(),
            }
        );

        let markdown_targets = query_workspace_link_targets(
            &index,
            QueryWorkspaceLinkTargetsInput {
                current_path: Some(current_path),
                limit: 10,
                mode: WorkspaceLinkTargetModeDto::Markdown,
                query: "README".to_string(),
            },
        );
        assert_eq!(markdown_targets[0].label, "../README.md");
        assert_eq!(markdown_targets[0].target, "../README.md");

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn build_workspace_index_reports_fine_grained_progress() {
        let root = temp_dir("progress");
        let first = root.join("first.md");
        let second = root.join("second.md");
        fs::write(&first, "# First\n\n[Second](second.md)").expect("write first");
        fs::write(&second, "# Second").expect("write second");
        let events = Arc::new(Mutex::new(Vec::<WorkspaceIndexBuildProgress>::new()));
        let events_for_reporter = events.clone();

        let index = build_workspace_index_with_options(
            BuildWorkspaceIndexInput {
                root_path: path_to_string(&root),
                current_document_override: None,
                recent_files: vec![],
            },
            WorkspaceIndexBuildOptions {
                cancel_requested: None,
                progress_reporter: Some(Arc::new(move |progress| {
                    events_for_reporter
                        .lock()
                        .expect("lock progress events")
                        .push(progress);
                })),
            },
        )
        .expect("build index");

        assert_eq!(index.documents.len(), 2);
        let stages = events
            .lock()
            .expect("lock progress events")
            .iter()
            .map(|event| event.stage.clone())
            .collect::<Vec<_>>();
        assert!(stages.contains(&"scan".to_string()));
        assert!(stages.contains(&"parse".to_string()));
        assert!(stages.contains(&"resolve".to_string()));
        assert!(stages.contains(&"backlinks".to_string()));
        assert!(stages.contains(&"finalize".to_string()));

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn build_workspace_index_aborts_when_cancel_requested() {
        let root = temp_dir("cancel");
        fs::write(root.join("note.md"), "# Note").expect("write note");
        let cancel_requested = Arc::new(AtomicBool::new(true));

        let error = build_workspace_index_with_options(
            BuildWorkspaceIndexInput {
                root_path: path_to_string(&root),
                current_document_override: None,
                recent_files: vec![],
            },
            WorkspaceIndexBuildOptions {
                cancel_requested: Some(cancel_requested),
                progress_reporter: None,
            },
        )
        .expect_err("cancelled build should fail");

        assert_eq!(error.code, "workspace_index_cancelled");

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn reuses_base_index_snapshot_until_manifest_changes() {
        let root = temp_dir("base-snapshot");
        let note = root.join("note.md");
        fs::write(&note, "# Original").expect("write note");
        let root_key = normalize_path(&path_to_string(
            &root.canonicalize().expect("canonical root"),
        ));

        let first = build_workspace_index(BuildWorkspaceIndexInput {
            root_path: path_to_string(&root),
            current_document_override: None,
            recent_files: vec![],
        })
        .expect("first build");
        assert_eq!(first.documents[0].title, "Original");

        {
            let mut cache_by_root = workspace_index_cache()
                .lock()
                .expect("lock workspace index cache");
            let workspace_cache = cache_by_root.get_mut(&root_key).expect("workspace cache");
            let note_key = normalize_path(&path_to_string(
                &note.canonicalize().expect("canonical note"),
            ));
            workspace_cache
                .documents_by_path
                .get_mut(&note_key)
                .expect("cached note")
                .document
                .title = "Poisoned document cache".to_string();
        }

        let events = Arc::new(Mutex::new(Vec::<WorkspaceIndexBuildProgress>::new()));
        let events_for_reporter = events.clone();
        let second = build_workspace_index_with_options(
            BuildWorkspaceIndexInput {
                root_path: path_to_string(&root),
                current_document_override: None,
                recent_files: vec![],
            },
            WorkspaceIndexBuildOptions {
                cancel_requested: None,
                progress_reporter: Some(Arc::new(move |progress| {
                    events_for_reporter
                        .lock()
                        .expect("lock progress events")
                        .push(progress);
                })),
            },
        )
        .expect("second build");
        assert_eq!(second.documents[0].title, "Original");
        let stages = events
            .lock()
            .expect("lock progress events")
            .iter()
            .map(|event| event.stage.clone())
            .collect::<Vec<_>>();
        assert!(stages.contains(&"cached".to_string()));
        assert!(!stages.contains(&"parse".to_string()));

        fs::write(&note, "# Changed title with different size").expect("rewrite note");
        let changed = build_workspace_index(BuildWorkspaceIndexInput {
            root_path: path_to_string(&root),
            current_document_override: None,
            recent_files: vec![],
        })
        .expect("changed build");
        assert_eq!(
            changed.documents[0].title,
            "Changed title with different size"
        );

        let _ = fs::remove_dir_all(root);
    }
}
