/// Clipboard helpers — bypass WebView2 limitation for image paste detection

/// Check if clipboard contains an image (bypasses WebView2 limitation)
#[tauri::command]
pub fn clipboard_has_image() -> bool {
    #[cfg(target_os = "windows")]
    {
        use windows_sys::Win32::System::DataExchange::{
            OpenClipboard, CloseClipboard, IsClipboardFormatAvailable,
        };
        // CF_BITMAP = 2, CF_DIB = 8
        unsafe {
            if OpenClipboard(std::ptr::null_mut()) == 0 {
                return false;
            }
            let has_image = IsClipboardFormatAvailable(2) != 0
                || IsClipboardFormatAvailable(8) != 0;
            CloseClipboard();
            has_image
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        false
    }
}

/// Read clipboard text via OS API (bypasses WebView2 limitation)
#[tauri::command]
pub fn clipboard_read_text() -> Option<String> {
    #[cfg(target_os = "windows")]
    {
        use windows_sys::Win32::System::DataExchange::{
            OpenClipboard, CloseClipboard, GetClipboardData,
        };
        use windows_sys::Win32::System::Memory::{GlobalLock, GlobalUnlock};
        // CF_UNICODETEXT = 13
        unsafe {
            if OpenClipboard(std::ptr::null_mut()) == 0 {
                return None;
            }
            let handle = GetClipboardData(13);
            if handle.is_null() {
                CloseClipboard();
                return None;
            }
            let ptr = GlobalLock(handle) as *const u16;
            if ptr.is_null() {
                CloseClipboard();
                return None;
            }
            let mut len = 0;
            while *ptr.add(len) != 0 {
                len += 1;
            }
            let slice = std::slice::from_raw_parts(ptr, len);
            let text = String::from_utf16_lossy(slice);
            GlobalUnlock(handle);
            CloseClipboard();
            if text.is_empty() { None } else { Some(text) }
        }
    }
    #[cfg(not(target_os = "windows"))]
    {
        None
    }
}
