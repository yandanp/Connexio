// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // On Windows release builds, we have no console (windows_subsystem = "windows").
    // portable-pty/ConPTY needs a console to function. Without one, Windows allocates
    // a new visible console (routed through Windows Terminal if it's the default).
    // Fix: allocate a hidden console before any PTY operations.
    #[cfg(all(target_os = "windows", not(debug_assertions)))]
    unsafe {
        use windows_sys::Win32::System::Console::{AllocConsole, GetConsoleWindow};
        use windows_sys::Win32::UI::WindowsAndMessaging::{ShowWindow, SW_HIDE};
        AllocConsole();
        let console_window = GetConsoleWindow();
        if console_window != std::ptr::null_mut() {
            ShowWindow(console_window, SW_HIDE);
        }
    }

    connexio_lib::run()
}
