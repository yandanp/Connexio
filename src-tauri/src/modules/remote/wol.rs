// ─── Wake-on-LAN ────────────────────────────────────────────────────────────

pub(super) fn send_magic_packet(mac: &str, broadcast_ip: &str, port: u16) -> Result<(), String> {
    let mac_bytes = parse_mac(mac)?;
    let mut packet = Vec::with_capacity(102);
    packet.extend_from_slice(&[0xFF; 6]);
    for _ in 0..16 {
        packet.extend_from_slice(&mac_bytes);
    }

    let socket = std::net::UdpSocket::bind("0.0.0.0:0")
        .map_err(|e| format!("Failed to bind UDP socket: {}", e))?;
    socket
        .set_broadcast(true)
        .map_err(|e| format!("Failed to enable broadcast: {}", e))?;
    socket
        .send_to(&packet, format!("{}:{}", broadcast_ip, port))
        .map_err(|e| format!("Failed to send WoL packet: {}", e))?;
    Ok(())
}

fn parse_mac(mac: &str) -> Result<[u8; 6], String> {
    let cleaned = mac.replace([':', '-'], "");
    if cleaned.len() != 12 {
        return Err("MAC address must be 12 hex digits".to_string());
    }

    let mut bytes = [0u8; 6];
    for i in 0..6 {
        let part = &cleaned[i * 2..i * 2 + 2];
        bytes[i] = u8::from_str_radix(part, 16)
            .map_err(|_| "MAC address contains invalid hex".to_string())?;
    }
    Ok(bytes)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_valid_mac() {
        assert_eq!(
            parse_mac("aa:bb:cc:dd:ee:ff").unwrap(),
            [0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff]
        );
    }

    #[test]
    fn rejects_invalid_mac() {
        assert!(parse_mac("not-a-mac").is_err());
        assert!(parse_mac("aa:bb:cc:dd:ee").is_err());
    }
}
