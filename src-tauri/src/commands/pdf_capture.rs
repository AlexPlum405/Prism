use std::path::{Path, PathBuf};

use tauri::{AppHandle, Manager};

const PDF_CAPTURE_TEMP_ROOT_NAME: &str = "export-captures";

#[derive(Debug, serde::Serialize, Clone, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct PdfCaptureCapability {
    pub supported: bool,
    pub engine: String,
    pub reason: Option<String>,
}

fn pdf_capture_capability() -> PdfCaptureCapability {
    #[cfg(target_os = "macos")]
    {
        PdfCaptureCapability {
            supported: true,
            engine: "webkit_create_pdf".to_string(),
            reason: None,
        }
    }

    #[cfg(target_os = "windows")]
    {
        PdfCaptureCapability {
            supported: false,
            engine: "webview2".to_string(),
            reason: Some("webview2_pdf_capture_not_enabled".to_string()),
        }
    }

    #[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
    {
        PdfCaptureCapability {
            supported: false,
            engine: "webkitgtk".to_string(),
            reason: Some("webkitgtk_pdf_capture_not_enabled".to_string()),
        }
    }
}

fn pdf_capture_temp_root(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join(PDF_CAPTURE_TEMP_ROOT_NAME)
}

fn validate_pdf_output_path(app_data_dir: &Path, path: &str) -> Result<PathBuf, String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err("PDF output path cannot be empty".to_string());
    }
    let target_path = PathBuf::from(trimmed);
    if !target_path.is_absolute() {
        return Err("PDF output path must be absolute".to_string());
    }
    if target_path.exists() && target_path.is_dir() {
        return Err("PDF output path cannot be a folder".to_string());
    }
    let parent = target_path
        .parent()
        .filter(|parent| !parent.as_os_str().is_empty())
        .ok_or_else(|| "PDF output directory does not exist".to_string())?;
    if !parent.exists() {
        return Err("PDF output directory does not exist".to_string());
    }
    if target_path
        .extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| extension.eq_ignore_ascii_case("pdf"))
        != Some(true)
    {
        return Err("PDF output path must end with .pdf".to_string());
    }

    let temp_root = pdf_capture_temp_root(app_data_dir);
    let canonical_temp_root = temp_root
        .canonicalize()
        .map_err(|err| format!("Failed to access Prism PDF capture temp directory: {err}"))?;
    let canonical_parent = parent
        .canonicalize()
        .map_err(|err| format!("Failed to access PDF output directory: {err}"))?;
    if canonical_parent == canonical_temp_root
        || !canonical_parent.starts_with(&canonical_temp_root)
    {
        return Err("PDF capture output must be inside Prism PDF capture temp storage".to_string());
    }

    let filename = target_path
        .file_name()
        .ok_or_else(|| "PDF output path must include a file name".to_string())?;
    Ok(canonical_parent.join(filename))
}

fn validate_pdf_capture_rect(x: f64, y: f64, width: f64, height: f64) -> Result<(), String> {
    if !x.is_finite() || !y.is_finite() || !width.is_finite() || !height.is_finite() {
        return Err("PDF capture area contains invalid numbers".to_string());
    }
    if width <= 0.0 || height <= 0.0 {
        return Err("PDF capture area size must be greater than 0".to_string());
    }
    if width > 20_000.0 || height > 200_000.0 {
        return Err("PDF capture area is too large; split the document and try again".to_string());
    }
    Ok(())
}

#[cfg(target_os = "macos")]
async fn capture_current_webview_pdf_macos(
    webview_window: tauri::WebviewWindow,
    output_path: PathBuf,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> Result<(), String> {
    use objc2::MainThreadMarker;
    use objc2_core_foundation::{CGPoint, CGRect, CGSize};
    use objc2_foundation::{NSData, NSError};
    use objc2_web_kit::{WKPDFConfiguration, WKWebView};
    use std::ptr::NonNull;
    use std::sync::mpsc;
    use std::time::Duration;

    const CREATE_PDF_TIMEOUT: Duration = Duration::from_secs(90);

    let output_path_for_capture = output_path.clone();
    let (tx, rx) = mpsc::channel();
    webview_window
        .with_webview(move |platform_webview| {
            let result = (|| -> Result<(), String> {
                let mtm = MainThreadMarker::new()
                    .ok_or_else(|| "WebKit PDF capture must run on the main thread".to_string())?;
                let configuration = unsafe { WKPDFConfiguration::new(mtm) };
                unsafe {
                    configuration.setRect(CGRect {
                        origin: CGPoint { x, y },
                        size: CGSize { width, height },
                    });
                }

                let output_path_for_callback = output_path_for_capture.clone();
                let tx_callback = tx.clone();
                let completion =
                    block2::RcBlock::new(move |pdf_data: *mut NSData, error: *mut NSError| {
                        let result = (|| -> Result<(), String> {
                            if !error.is_null() {
                                let description =
                                    unsafe { (&*error).localizedDescription().to_string() };
                                return Err(format!("WebKit PDF capture failed: {description}"));
                            }
                            if pdf_data.is_null() {
                                return Err("WebKit PDF capture returned no data".to_string());
                            }

                            let data = unsafe { &*pdf_data };
                            let length = data.length() as usize;
                            if length == 0 {
                                return Err("WebKit PDF capture returned empty data".to_string());
                            }

                            let mut bytes = vec![0_u8; length];
                            let buffer =
                                NonNull::new(bytes.as_mut_ptr().cast()).ok_or_else(|| {
                                    "Failed to allocate PDF capture buffer".to_string()
                                })?;
                            unsafe {
                                data.getBytes_length(buffer, length);
                            }
                            std::fs::write(&output_path_for_callback, bytes).map_err(|err| {
                                format!("Failed to write WebKit PDF capture file: {err}")
                            })?;
                            Ok(())
                        })();
                        let _ = tx_callback.send(result);
                    });

                // SAFETY: Tauri's with_webview provides the platform WKWebView pointer for the
                // current export worker window; createPDF is asynchronous and reports completion
                // through the copied block.
                unsafe {
                    let wk_webview = &*platform_webview.inner().cast::<WKWebView>();
                    wk_webview.createPDFWithConfiguration_completionHandler(
                        Some(&configuration),
                        &completion,
                    );
                }
                Ok(())
            })();
            if let Err(error) = result {
                let _ = tx.send(Err(error));
            }
        })
        .map_err(|err| format!("Failed to access export WebView: {err}"))?;

    tauri::async_runtime::spawn_blocking(move || {
        rx.recv_timeout(CREATE_PDF_TIMEOUT)
            .map_err(|_| "WebKit PDF capture timed out".to_string())?
    })
    .await
    .map_err(|err| format!("WebKit PDF capture task failed: {err}"))?
}

#[cfg(not(target_os = "macos"))]
async fn capture_current_webview_pdf_platform(
    _webview_window: tauri::WebviewWindow,
    _output_path: PathBuf,
    _x: f64,
    _y: f64,
    _width: f64,
    _height: f64,
) -> Result<(), String> {
    Err("Prism WebView PDF capture is not available on this platform yet".to_string())
}

#[cfg(target_os = "macos")]
async fn capture_current_webview_pdf_platform(
    webview_window: tauri::WebviewWindow,
    output_path: PathBuf,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> Result<(), String> {
    capture_current_webview_pdf_macos(webview_window, output_path, x, y, width, height).await
}

#[tauri::command]
pub fn get_pdf_capture_capability() -> PdfCaptureCapability {
    pdf_capture_capability()
}

#[tauri::command]
pub async fn capture_current_webview_pdf(
    app: AppHandle,
    webview_window: tauri::WebviewWindow,
    output_path: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> Result<(), String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|err| format!("Failed to resolve Prism app data directory: {err}"))?;
    let target_path = validate_pdf_output_path(&app_data_dir, &output_path)?;
    validate_pdf_capture_rect(x, y, width, height)?;
    capture_current_webview_pdf_platform(webview_window, target_path, x, y, width, height).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn timestamp_millis() -> u128 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|duration| duration.as_millis())
            .unwrap_or(0)
    }

    fn temp_dir(name: &str) -> PathBuf {
        let path = std::env::temp_dir().join(format!(
            "prism-pdf-capture-{}-{}-{name}",
            std::process::id(),
            timestamp_millis()
        ));
        fs::create_dir_all(&path).expect("create temp dir");
        path
    }

    #[test]
    fn validates_pdf_output_path_extension() {
        let app_data_dir = temp_dir("app-data");
        let capture_session = app_data_dir
            .join(PDF_CAPTURE_TEMP_ROOT_NAME)
            .join("session");
        fs::create_dir_all(&capture_session).expect("create capture session");
        let output_path = capture_session.join("capture-1.pdf");
        let expected_output_path = capture_session
            .canonicalize()
            .expect("canonicalize capture session")
            .join("capture-1.pdf");

        assert_eq!(
            validate_pdf_output_path(&app_data_dir, output_path.to_str().unwrap())
                .expect("pdf path should pass"),
            expected_output_path
        );
        assert!(validate_pdf_output_path(&app_data_dir, "")
            .expect_err("empty path should fail")
            .contains("empty"));
        assert!(validate_pdf_output_path(&app_data_dir, "/tmp/export.png")
            .expect_err("non-pdf path should fail")
            .contains(".pdf"));

        let _ = fs::remove_dir_all(app_data_dir);
    }

    #[test]
    fn rejects_pdf_capture_output_outside_prism_temp_storage() {
        let app_data_dir = temp_dir("app-data");
        let capture_root = app_data_dir.join(PDF_CAPTURE_TEMP_ROOT_NAME);
        fs::create_dir_all(&capture_root).expect("create capture root");
        let user_dir = temp_dir("user-documents");
        let user_pdf = user_dir.join("report.webkit-capture-1.pdf");

        assert!(
            validate_pdf_output_path(&app_data_dir, user_pdf.to_str().unwrap())
                .expect_err("user directory path should fail")
                .contains("Prism PDF capture temp storage")
        );

        let root_pdf = capture_root.join("capture-1.pdf");
        assert!(
            validate_pdf_output_path(&app_data_dir, root_pdf.to_str().unwrap())
                .expect_err("capture root path should fail")
                .contains("Prism PDF capture temp storage")
        );

        let _ = fs::remove_dir_all(app_data_dir);
        let _ = fs::remove_dir_all(user_dir);
    }

    #[test]
    fn reports_pdf_capture_capability_for_current_platform() {
        let capability = pdf_capture_capability();
        #[cfg(target_os = "macos")]
        {
            assert!(capability.supported);
            assert_eq!(capability.engine, "webkit_create_pdf");
            assert_eq!(capability.reason, None);
        }
        #[cfg(target_os = "windows")]
        {
            assert!(!capability.supported);
            assert_eq!(
                capability.reason,
                Some("webview2_pdf_capture_not_enabled".to_string())
            );
        }
        #[cfg(all(not(target_os = "macos"), not(target_os = "windows")))]
        {
            assert!(!capability.supported);
            assert_eq!(
                capability.reason,
                Some("webkitgtk_pdf_capture_not_enabled".to_string())
            );
        }
    }

    #[test]
    fn rejects_invalid_pdf_capture_rect() {
        assert!(validate_pdf_capture_rect(0.0, 0.0, 800.0, 600.0).is_ok());
        assert!(validate_pdf_capture_rect(0.0, 0.0, 0.0, 600.0)
            .expect_err("zero width should fail")
            .contains("greater than 0"));
        assert!(validate_pdf_capture_rect(0.0, f64::NAN, 800.0, 600.0)
            .expect_err("nan y should fail")
            .contains("invalid numbers"));
        assert!(validate_pdf_capture_rect(0.0, 0.0, 20_001.0, 600.0)
            .expect_err("oversized width should fail")
            .contains("too large"));
    }
}
