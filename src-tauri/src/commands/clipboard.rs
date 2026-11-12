use std::time::Duration;

use tauri::AppHandle;

const CLIPBOARD_WRITE_TIMEOUT: Duration = Duration::from_secs(5);

#[derive(Debug, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WriteClipboardRichInput {
    pub html: Option<String>,
    pub text: Option<String>,
    pub png_bytes_base64: Option<String>,
}

#[cfg(target_os = "macos")]
fn write_clipboard_rich_macos(input: &WriteClipboardRichInput) -> Result<(), String> {
    use objc2_app_kit::{
        NSPasteboard, NSPasteboardTypeHTML, NSPasteboardTypePNG, NSPasteboardTypeString,
    };
    use objc2_foundation::{NSData, NSString, NSUTF8StringEncoding};

    // NSPasteboard is documented thread-safe; generalPasteboard returns a shared instance.
    let pasteboard = NSPasteboard::generalPasteboard();
    // SAFETY: NSPasteboard is documented thread-safe and owned by AppKit.
    pasteboard.clearContents();

    if let Some(png_bytes_base64) = &input.png_bytes_base64 {
        let png_bytes = decode_base64(png_bytes_base64)?;
        if png_bytes.is_empty() {
            return Err("Clipboard image payload is empty".to_string());
        }
        let data = NSData::from_vec(png_bytes);
        // SAFETY: `data` is a valid NSData instance and the pasteboard type is an AppKit constant.
        let written = unsafe { pasteboard.setData_forType(Some(&data), NSPasteboardTypePNG) };
        if !written {
            return Err("Failed to write image/png to the system clipboard".to_string());
        }
    }

    if let Some(html) = &input.html {
        let html_data = NSString::from_str(html)
            // SAFETY: UTF-8 is always a valid NSString encoding.
            .dataUsingEncoding(NSUTF8StringEncoding)
            .ok_or_else(|| "Failed to encode clipboard HTML as UTF-8".to_string())?;
        // SAFETY: `html_data` is a valid NSData instance and the pasteboard type is an AppKit constant.
        let written = unsafe { pasteboard.setData_forType(Some(&html_data), NSPasteboardTypeHTML) };
        if !written {
            return Err("Failed to write text/html to the system clipboard".to_string());
        }
    }

    if let Some(text) = &input.text {
        // SAFETY: the string is a valid NSString instance and the pasteboard type is an AppKit constant.
        let written = unsafe {
            pasteboard.setString_forType(&NSString::from_str(text), NSPasteboardTypeString)
        };
        if !written {
            return Err("Failed to write text/plain to the system clipboard".to_string());
        }
    }

    Ok(())
}

#[cfg(target_os = "macos")]
fn decode_base64(input: &str) -> Result<Vec<u8>, String> {
    fn value_of(byte: u8) -> Option<u32> {
        match byte {
            b'A'..=b'Z' => Some(u32::from(byte - b'A')),
            b'a'..=b'z' => Some(u32::from(byte - b'a') + 26),
            b'0'..=b'9' => Some(u32::from(byte - b'0') + 52),
            b'+' => Some(62),
            b'/' => Some(63),
            _ => None,
        }
    }

    let mut output = Vec::with_capacity(input.len() / 4 * 3);
    let mut accumulator = 0_u32;
    let mut bits = 0_u32;
    for byte in input.bytes() {
        if byte == b'=' || byte == b'\n' || byte == b'\r' {
            continue;
        }
        let value = value_of(byte)
            .ok_or_else(|| "Clipboard image payload is not valid base64".to_string())?;
        accumulator = (accumulator << 6) | value;
        bits += 6;
        if bits >= 8 {
            bits -= 8;
            output.push((accumulator >> bits) as u8);
        }
    }
    Ok(output)
}

#[cfg(target_os = "macos")]
async fn write_clipboard_rich_platform(
    app_handle: AppHandle,
    input: WriteClipboardRichInput,
) -> Result<(), String> {
    let (tx, rx) = std::sync::mpsc::channel();
    app_handle
        .run_on_main_thread(move || {
            let result = write_clipboard_rich_macos(&input);
            let _ = tx.send(result);
        })
        .map_err(|err| format!("Failed to schedule clipboard write: {err}"))?;

    tauri::async_runtime::spawn_blocking(move || {
        rx.recv_timeout(CLIPBOARD_WRITE_TIMEOUT)
            .map_err(|_| "Clipboard write timed out".to_string())?
    })
    .await
    .map_err(|err| format!("Clipboard write task failed: {err}"))?
}

#[cfg(not(target_os = "macos"))]
async fn write_clipboard_rich_platform(
    _app_handle: AppHandle,
    _input: WriteClipboardRichInput,
) -> Result<(), String> {
    Err("Rich clipboard write is not available on this platform yet".to_string())
}

/// WKWebView 的 navigator.clipboard.write 在 await 之后会丢失用户手势而失败
/// （WebKit bug 222262），因此富文本/图片统一走 NSPasteboard 原生写入。
#[tauri::command]
pub async fn write_clipboard_rich(
    app_handle: AppHandle,
    input: WriteClipboardRichInput,
) -> Result<(), String> {
    write_clipboard_rich_platform(app_handle, input).await
}

#[derive(Debug, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClipboardPayload {
    pub html: Option<String>,
    pub text: Option<String>,
}

#[cfg(target_os = "macos")]
fn read_clipboard_payload_macos() -> ClipboardPayload {
    use objc2_app_kit::{NSPasteboard, NSPasteboardTypeHTML, NSPasteboardTypeString};

    // NSPasteboard is documented thread-safe; generalPasteboard returns a shared instance.
    let pasteboard = NSPasteboard::generalPasteboard();
    // SAFETY: NSPasteboard is documented thread-safe and owned by AppKit.
    let html = unsafe { pasteboard.stringForType(NSPasteboardTypeHTML) };
    // SAFETY: same as above.
    let text = unsafe { pasteboard.stringForType(NSPasteboardTypeString) };

    ClipboardPayload {
        html: html.map(|value| value.to_string()),
        text: text.map(|value| value.to_string()),
    }
}

#[cfg(target_os = "macos")]
async fn read_clipboard_payload_platform(app_handle: AppHandle) -> Result<ClipboardPayload, String> {
    let (tx, rx) = std::sync::mpsc::channel();
    app_handle
        .run_on_main_thread(move || {
            let _ = tx.send(read_clipboard_payload_macos());
        })
        .map_err(|err| format!("Failed to schedule clipboard read: {err}"))?;

    tauri::async_runtime::spawn_blocking(move || {
        rx.recv_timeout(CLIPBOARD_WRITE_TIMEOUT)
            .map_err(|_| "Clipboard read timed out".to_string())
    })
    .await
    .map_err(|err| format!("Clipboard read task failed: {err}"))?
}

#[cfg(not(target_os = "macos"))]
async fn read_clipboard_payload_platform(_app_handle: AppHandle) -> Result<ClipboardPayload, String> {
    Err("Clipboard read is not available on this platform yet".to_string())
}

/// WKWebView 的 navigator.clipboard.read/readText 需要瞬时用户手势，
/// 由原生菜单触发的命令拿不到手势，会弹授权框或直接失败，
/// 因此「粘贴为纯文本」与命令面板粘贴统一走 NSPasteboard 原生读取。
#[tauri::command]
pub async fn read_clipboard_payload(app_handle: AppHandle) -> Result<ClipboardPayload, String> {
    read_clipboard_payload_platform(app_handle).await
}

#[cfg(test)]
mod tests {
    use super::decode_base64;

    #[test]
    fn decodes_base64_with_and_without_padding() {
        assert_eq!(decode_base64("AQID").unwrap(), vec![1, 2, 3]);
        assert_eq!(decode_base64("AQIDBA==").unwrap(), vec![1, 2, 3, 4]);
        assert!(decode_base64("AQ!D").is_err());
    }
}
