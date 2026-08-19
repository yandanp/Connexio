// ─── Tailscale Detection ────────────────────────────────────────────────────

pub(super) fn detect_tailscale_ip() -> Option<String> {
    detect_tailscale_ip_from_interfaces()
        .or_else(detect_tailscale_ip_from_cli)
        .or_else(detect_tailscale_ip_from_windows_powershell)
}

fn detect_tailscale_ip_from_interfaces() -> Option<String> {
    let interfaces = local_ip_address::list_afinet_netifas().ok()?;
    interfaces.into_iter().find_map(|(name, ip)| {
        let std::net::IpAddr::V4(v4) = ip else {
            return None;
        };
        let is_tailscale_range = is_tailscale_ipv4(v4);
        let name_hint = name.to_lowercase().contains("tailscale");
        if is_tailscale_range || name_hint {
            Some(v4.to_string())
        } else {
            None
        }
    })
}

fn detect_tailscale_ip_from_cli() -> Option<String> {
    let candidates = [
        "tailscale".to_string(),
        #[cfg(target_os = "windows")]
        "C:\\Program Files\\Tailscale\\tailscale.exe".to_string(),
    ];

    for binary in candidates {
        let Ok(output) = std::process::Command::new(binary)
            .args(["ip", "-4"])
            .output()
        else {
            continue;
        };
        if !output.status.success() {
            continue;
        }
        let stdout = String::from_utf8_lossy(&output.stdout);
        for line in stdout.lines() {
            if let Ok(ip) = line.trim().parse::<std::net::Ipv4Addr>() {
                if is_tailscale_ipv4(ip) {
                    return Some(ip.to_string());
                }
            }
        }
    }
    None
}

#[cfg(target_os = "windows")]
fn detect_tailscale_ip_from_windows_powershell() -> Option<String> {
    let script = "Get-NetIPAddress -AddressFamily IPv4 | Select-Object -ExpandProperty IPAddress";
    let output = std::process::Command::new("powershell")
        .args(["-NoProfile", "-Command", script])
        .output()
        .ok()?;
    if !output.status.success() {
        return None;
    }
    let stdout = String::from_utf8_lossy(&output.stdout);
    stdout.lines().find_map(|line| {
        let ip = line.trim().parse::<std::net::Ipv4Addr>().ok()?;
        is_tailscale_ipv4(ip).then(|| ip.to_string())
    })
}

#[cfg(not(target_os = "windows"))]
fn detect_tailscale_ip_from_windows_powershell() -> Option<String> {
    None
}

fn is_tailscale_ipv4(ip: std::net::Ipv4Addr) -> bool {
    let octets = ip.octets();
    // Tailscale assigns IPs from 100.64.0.0/10.
    octets[0] == 100 && (64..=127).contains(&octets[1])
}
