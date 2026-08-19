use std::io::Write;

// ─── PTY Bridge ─────────────────────────────────────────────────────────────

pub(super) fn write_session(
    session: &mut crate::modules::pty::TerminalSession,
    data: &[u8],
) -> Result<(), String> {
    match session {
        crate::modules::pty::TerminalSession::Local(s) => {
            s.writer.write_all(data).map_err(|e| e.to_string())?;
            Ok(())
        }
        crate::modules::pty::TerminalSession::Ssh(s) => {
            let mut ch = s.channel.lock().map_err(|_| "lock poisoned")?;
            ch.write_all(data).map_err(|e| e.to_string())?;
            ch.flush().map_err(|e| e.to_string())?;
            Ok(())
        }
    }
}

pub(super) fn resize_session(
    session: &mut crate::modules::pty::TerminalSession,
    cols: u16,
    rows: u16,
) -> Result<(), String> {
    use portable_pty::PtySize;
    match session {
        crate::modules::pty::TerminalSession::Local(s) => {
            s.master
                .resize(PtySize {
                    rows,
                    cols,
                    pixel_width: 0,
                    pixel_height: 0,
                })
                .map_err(|e| e.to_string())?;
            s.cols = cols;
            s.rows = rows;
            Ok(())
        }
        crate::modules::pty::TerminalSession::Ssh(s) => {
            let mut ch = s.channel.lock().map_err(|_| "lock poisoned")?;
            ch.request_pty_size(cols as u32, rows as u32, None, None)
                .map_err(|e| e.to_string())?;
            s.cols = cols;
            s.rows = rows;
            Ok(())
        }
    }
}
