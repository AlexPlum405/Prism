use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};

use super::error::{PrismCommandError, PrismResult};
use super::path::path_to_string;

#[derive(Debug, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ResolveResourceInput {
    pub document_path: Option<String>,
    pub raw_src: String,
}

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ResourceRefDto {
    pub raw_src: String,
    pub resolved_path: Option<String>,
    pub kind: String,
    pub mime_type: Option<String>,
    pub exists: bool,
}

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ResourceBytesDto {
    pub bytes: Vec<u8>,
    pub mime_type: String,
    pub path: String,
}

#[derive(Debug, Deserialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PreflightExportInput {
    pub content: String,
    pub document_path: Option<String>,
}

#[derive(Debug, Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ExportResourceDiagnosticDto {
    pub column: usize,
    pub kind: String,
    pub line: usize,
    pub resolved_path: Option<String>,
    pub target: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct MarkdownImageRef {
    column: usize,
    line: usize,
    target: String,
}

fn strip_url_decorations(value: &str) -> &str {
    let hash_index = value.find('#');
    let query_index = value.find('?');
    match (hash_index, query_index) {
        (Some(hash), Some(query)) => &value[..hash.min(query)],
        (Some(hash), None) => &value[..hash],
        (None, Some(query)) => &value[..query],
        (None, None) => value,
    }
}

fn percent_decode(value: &str) -> String {
    let bytes = value.as_bytes();
    let mut output = Vec::with_capacity(bytes.len());
    let mut index = 0;

    while index < bytes.len() {
        if bytes[index] == b'%' && index + 2 < bytes.len() {
            let hex = &value[index + 1..index + 3];
            if let Ok(decoded) = u8::from_str_radix(hex, 16) {
                output.push(decoded);
                index += 3;
                continue;
            }
        }
        output.push(bytes[index]);
        index += 1;
    }

    String::from_utf8(output).unwrap_or_else(|_| value.to_string())
}

fn is_windows_absolute_path(value: &str) -> bool {
    let bytes = value.as_bytes();
    bytes.len() >= 3
        && bytes[0].is_ascii_alphabetic()
        && bytes[1] == b':'
        && (bytes[2] == b'/' || bytes[2] == b'\\')
}

fn has_url_scheme(value: &str) -> bool {
    let Some(colon_index) = value.find(':') else {
        return false;
    };
    let scheme = &value[..colon_index];
    let mut chars = scheme.chars();
    let Some(first) = chars.next() else {
        return false;
    };
    first.is_ascii_alphabetic()
        && chars.all(|char| char.is_ascii_alphanumeric() || matches!(char, '+' | '.' | '-'))
}

fn is_external_resource(value: &str) -> bool {
    value.starts_with("//")
        || value
            .get(..7)
            .map(|prefix| prefix.eq_ignore_ascii_case("http://"))
            .unwrap_or(false)
        || value
            .get(..8)
            .map(|prefix| prefix.eq_ignore_ascii_case("https://"))
            .unwrap_or(false)
        || value
            .get(..5)
            .map(|prefix| prefix.eq_ignore_ascii_case("data:"))
            .unwrap_or(false)
        || value
            .get(..5)
            .map(|prefix| prefix.eq_ignore_ascii_case("blob:"))
            .unwrap_or(false)
}

fn file_url_to_path(value: &str) -> Option<PathBuf> {
    if !value
        .get(..7)
        .map(|prefix| prefix.eq_ignore_ascii_case("file://"))
        .unwrap_or(false)
    {
        return None;
    }

    let mut path = percent_decode(&value[7..]);
    if path.starts_with("localhost/") {
        path = path["localhost".len()..].to_string();
    }
    if path.starts_with('/') && path.len() >= 4 && is_windows_absolute_path(&path[1..]) {
        path = path[1..].to_string();
    }
    Some(PathBuf::from(path))
}

fn mime_type_for_path(path: &Path) -> &'static str {
    match path
        .extension()
        .and_then(|extension| extension.to_str())
        .map(str::to_ascii_lowercase)
        .as_deref()
    {
        Some("svg") => "image/svg+xml",
        Some("png") => "image/png",
        Some("jpg") | Some("jpeg") => "image/jpeg",
        Some("gif") => "image/gif",
        Some("bmp") => "image/bmp",
        Some("webp") => "image/webp",
        Some("avif") => "image/avif",
        _ => "application/octet-stream",
    }
}

fn resolve_path(raw_src: &str, document_path: Option<&str>) -> ResourceRefDto {
    let stripped = strip_url_decorations(raw_src.trim());
    if stripped.is_empty() || stripped.starts_with('#') || stripped.starts_with('?') {
        return ResourceRefDto {
            raw_src: raw_src.to_string(),
            resolved_path: None,
            kind: "empty".to_string(),
            mime_type: None,
            exists: false,
        };
    }

    if is_external_resource(stripped) {
        return ResourceRefDto {
            raw_src: raw_src.to_string(),
            resolved_path: None,
            kind: "external_url".to_string(),
            mime_type: None,
            exists: false,
        };
    }

    if has_url_scheme(stripped) && !stripped.to_ascii_lowercase().starts_with("file://") {
        return ResourceRefDto {
            raw_src: raw_src.to_string(),
            resolved_path: None,
            kind: "unsupported_protocol".to_string(),
            mime_type: None,
            exists: false,
        };
    }

    let resolved = if let Some(path) = file_url_to_path(stripped) {
        Some(path)
    } else if stripped.starts_with('/') || is_windows_absolute_path(stripped) {
        Some(PathBuf::from(percent_decode(stripped)))
    } else {
        document_path
            .and_then(|path| Path::new(path).parent().map(Path::to_path_buf))
            .map(|parent| parent.join(percent_decode(stripped)))
    };

    let Some(path) = resolved else {
        return ResourceRefDto {
            raw_src: raw_src.to_string(),
            resolved_path: None,
            kind: "unresolved_relative".to_string(),
            mime_type: None,
            exists: false,
        };
    };

    let exists = path.exists();
    ResourceRefDto {
        raw_src: raw_src.to_string(),
        resolved_path: Some(path_to_string(&path)),
        kind: "local_file".to_string(),
        mime_type: Some(mime_type_for_path(&path).to_string()),
        exists,
    }
}

pub fn resolve_export_resource(input: ResolveResourceInput) -> PrismResult<ResourceRefDto> {
    Ok(resolve_path(&input.raw_src, input.document_path.as_deref()))
}

pub fn read_export_resource(input: ResolveResourceInput) -> PrismResult<ResourceBytesDto> {
    let resource = resolve_path(&input.raw_src, input.document_path.as_deref());
    let Some(path) = resource.resolved_path.clone() else {
        return Err(PrismCommandError::new(
            "export_resource_unresolved",
            "Export resource could not be resolved",
        )
        .with_stage("read_export_resource")
        .with_path(input.raw_src));
    };

    if resource.kind != "local_file" {
        return Err(PrismCommandError::new(
            "export_resource_external",
            "External export resources are not read locally",
        )
        .with_stage("read_export_resource")
        .with_path(input.raw_src));
    }

    if !resource.exists {
        return Err(PrismCommandError::new(
            "export_resource_missing",
            "Export resource does not exist",
        )
        .with_stage("read_export_resource")
        .with_path(path));
    }

    let bytes = fs::read(&path).map_err(|error| {
        let code = if error.kind() == std::io::ErrorKind::PermissionDenied {
            "permission_denied"
        } else {
            "export_resource_read_failed"
        };
        PrismCommandError::new(code, format!("Failed to read export resource: {error}"))
            .with_stage("read_export_resource")
            .with_path(path.clone())
    })?;

    Ok(ResourceBytesDto {
        bytes,
        mime_type: resource
            .mime_type
            .unwrap_or_else(|| "application/octet-stream".to_string()),
        path,
    })
}

fn extract_target(raw_target: &str) -> String {
    let trimmed = raw_target.trim();
    if trimmed.starts_with('<') && trimmed.contains('>') {
        return trimmed[1..trimmed.find('>').unwrap_or(trimmed.len())].to_string();
    }
    trimmed
        .split_whitespace()
        .next()
        .unwrap_or_default()
        .to_string()
}

fn collect_markdown_images(content: &str) -> Vec<MarkdownImageRef> {
    let mut images = Vec::new();

    for (line_index, line) in content.lines().enumerate() {
        let mut offset = 0;
        while let Some(start) = line[offset..].find("![") {
            let absolute_start = offset + start;
            let Some(label_end) = line[absolute_start + 2..].find("](") else {
                break;
            };
            let target_start = absolute_start + 2 + label_end + 2;
            let Some(target_end) = line[target_start..].find(')') else {
                break;
            };

            images.push(MarkdownImageRef {
                column: absolute_start + 1,
                line: line_index + 1,
                target: extract_target(&line[target_start..target_start + target_end]),
            });
            offset = target_start + target_end + 1;
        }
    }

    images
}

pub fn preflight_export(
    input: PreflightExportInput,
) -> PrismResult<Vec<ExportResourceDiagnosticDto>> {
    let mut diagnostics = Vec::new();

    for image in collect_markdown_images(&input.content) {
        let resource = resolve_path(&image.target, input.document_path.as_deref());
        match resource.kind.as_str() {
            "empty" => diagnostics.push(ExportResourceDiagnosticDto {
                column: image.column,
                kind: "empty-target".to_string(),
                line: image.line,
                resolved_path: None,
                target: image.target,
            }),
            "unsupported_protocol" => diagnostics.push(ExportResourceDiagnosticDto {
                column: image.column,
                kind: "unsupported-protocol".to_string(),
                line: image.line,
                resolved_path: None,
                target: image.target,
            }),
            "unresolved_relative" => diagnostics.push(ExportResourceDiagnosticDto {
                column: image.column,
                kind: "unresolved-relative".to_string(),
                line: image.line,
                resolved_path: None,
                target: image.target,
            }),
            "local_file" if !resource.exists => diagnostics.push(ExportResourceDiagnosticDto {
                column: image.column,
                kind: "missing-file".to_string(),
                line: image.line,
                resolved_path: resource.resolved_path,
                target: image.target,
            }),
            _ => {}
        }
    }

    Ok(diagnostics)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn resolve_export_resources_for_local_and_external_sources() {
        let local = resolve_export_resource(ResolveResourceInput {
            raw_src: "assets/%E5%9B%BE%20A.svg?cache=1#frag".to_string(),
            document_path: Some("/tmp/prism/page.md".to_string()),
        })
        .expect("resolve local resource");

        assert_eq!(
            local.resolved_path,
            Some("/tmp/prism/assets/图 A.svg".to_string())
        );
        assert_eq!(local.kind, "local_file");
        assert_eq!(local.mime_type, Some("image/svg+xml".to_string()));

        let remote = resolve_export_resource(ResolveResourceInput {
            raw_src: "https://example.com/image.png".to_string(),
            document_path: Some("/tmp/prism/page.md".to_string()),
        })
        .expect("resolve remote resource");

        assert_eq!(remote.kind, "external_url");
        assert_eq!(remote.resolved_path, None);
    }

    #[test]
    fn read_export_resources_returns_bytes_and_mime_type() {
        let root =
            std::env::temp_dir().join(format!("prism-export-resource-{}", std::process::id()));
        let image_path = root.join("asset.png");
        fs::create_dir_all(&root).expect("create temp dir");
        fs::write(&image_path, [1_u8, 2, 3]).expect("write image");

        let resource = read_export_resource(ResolveResourceInput {
            raw_src: "asset.png".to_string(),
            document_path: Some(path_to_string(&root.join("page.md"))),
        })
        .expect("read resource");

        assert_eq!(resource.path, path_to_string(&image_path));
        assert_eq!(resource.mime_type, "image/png");
        assert_eq!(resource.bytes, vec![1, 2, 3]);

        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn preflight_export_reports_missing_and_unresolved_images() {
        let diagnostics = preflight_export(PreflightExportInput {
            content: "![missing](assets/missing.png)\n![]()\n![bad](javascript:alert(1))"
                .to_string(),
            document_path: Some("/tmp/prism/page.md".to_string()),
        })
        .expect("preflight export");

        assert_eq!(
            diagnostics
                .iter()
                .map(|diagnostic| diagnostic.kind.as_str())
                .collect::<Vec<_>>(),
            vec!["missing-file", "empty-target", "unsupported-protocol"]
        );
    }
}
