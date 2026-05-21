use std::path::PathBuf;

fn validate_pdf_output_path(path: &str) -> Result<PathBuf, String> {
    let trimmed = path.trim();
    if trimmed.is_empty() {
        return Err("PDF output path cannot be empty".to_string());
    }
    let target_path = PathBuf::from(trimmed);
    if target_path.exists() && target_path.is_dir() {
        return Err("PDF output path cannot be a folder".to_string());
    }
    if let Some(parent) = target_path.parent() {
        if !parent.as_os_str().is_empty() && !parent.exists() {
            return Err("PDF output directory does not exist".to_string());
        }
    }
    if target_path
        .extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| extension.eq_ignore_ascii_case("pdf"))
        != Some(true)
    {
        return Err("PDF output path must end with .pdf".to_string());
    }
    Ok(target_path)
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
                if output_path_for_capture.exists() {
                    std::fs::remove_file(&output_path_for_capture)
                        .map_err(|err| format!("Failed to overwrite existing PDF file: {err}"))?;
                }

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
pub async fn capture_current_webview_pdf(
    webview_window: tauri::WebviewWindow,
    output_path: String,
    x: f64,
    y: f64,
    width: f64,
    height: f64,
) -> Result<(), String> {
    let target_path = validate_pdf_output_path(&output_path)?;
    validate_pdf_capture_rect(x, y, width, height)?;
    capture_current_webview_pdf_platform(webview_window, target_path, x, y, width, height).await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn validates_pdf_output_path_extension() {
        let output_path = std::env::temp_dir().join("prism-export-output.pdf");

        assert_eq!(
            validate_pdf_output_path(output_path.to_str().unwrap()).expect("pdf path should pass"),
            output_path
        );
        assert!(validate_pdf_output_path("")
            .expect_err("empty path should fail")
            .contains("empty"));
        assert!(validate_pdf_output_path("/tmp/export.png")
            .expect_err("non-pdf path should fail")
            .contains(".pdf"));
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
