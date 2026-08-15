use super::protocol::PowerAction;

// ─── Power Controls ─────────────────────────────────────────────────────────

pub(super) fn run_power_action(action: PowerAction) -> Result<(), String> {
    match action {
        PowerAction::Lock => lock_host(),
        PowerAction::Sleep => sleep_host(),
    }
}

#[cfg(target_os = "windows")]
fn lock_host() -> Result<(), String> {
    std::process::Command::new("rundll32.exe")
        .args(["user32.dll,LockWorkStation"])
        .spawn()
        .map_err(|e| format!("Failed to lock workstation: {}", e))?;
    Ok(())
}

#[cfg(target_os = "windows")]
fn sleep_host() -> Result<(), String> {
    std::process::Command::new("rundll32.exe")
        .args(["powrprof.dll,SetSuspendState", "0,1,0"])
        .spawn()
        .map_err(|e| format!("Failed to sleep workstation: {}", e))?;
    Ok(())
}

#[cfg(target_os = "macos")]
fn lock_host() -> Result<(), String> {
    std::process::Command::new("pmset")
        .args(["displaysleepnow"])
        .spawn()
        .map_err(|e| format!("Failed to lock display: {}", e))?;
    Ok(())
}

#[cfg(target_os = "macos")]
fn sleep_host() -> Result<(), String> {
    std::process::Command::new("pmset")
        .args(["sleepnow"])
        .spawn()
        .map_err(|e| format!("Failed to sleep host: {}", e))?;
    Ok(())
}

#[cfg(target_os = "linux")]
fn lock_host() -> Result<(), String> {
    std::process::Command::new("loginctl")
        .args(["lock-session"])
        .spawn()
        .map_err(|e| format!("Failed to lock session: {}", e))?;
    Ok(())
}

#[cfg(target_os = "linux")]
fn sleep_host() -> Result<(), String> {
    std::process::Command::new("systemctl")
        .args(["suspend"])
        .spawn()
        .map_err(|e| format!("Failed to suspend host: {}", e))?;
    Ok(())
}
