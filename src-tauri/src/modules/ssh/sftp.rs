use std::fs;
use std::io::{Read, Write};
use std::path::Path;

use super::connection::ssh_connect_session;
use super::types::{SFTPEntry, SSHConnection};

#[tauri::command]
pub fn ssh_sftp_list(
    connection: SSHConnection,
    path: String,
    password: Option<String>,
) -> Result<Vec<SFTPEntry>, String> {
    std::thread::spawn(move || {
        let session = ssh_connect_session(&connection, password.as_deref())?;
        let sftp = session
            .sftp()
            .map_err(|err| format!("Failed to open SFTP session: {}", err))?;
        let entries = sftp
            .readdir(Path::new(&path))
            .map_err(|err| format!("Failed to list remote directory: {}", err))?;

        let mut result = entries
            .into_iter()
            .filter_map(|(entry_path, stat)| {
                let name = entry_path.file_name()?.to_string_lossy().to_string();
                if name == "." || name == ".." {
                    return None;
                }
                let full_path = if path.ends_with('/') {
                    format!("{}{}", path, name)
                } else {
                    format!("{}/{}", path, name)
                };
                Some(SFTPEntry {
                    name,
                    path: full_path,
                    is_dir: stat.is_dir(),
                    size: stat.size,
                    modified_time: stat.mtime,
                })
            })
            .collect::<Vec<_>>();
        result.sort_by(|a, b| {
            b.is_dir
                .cmp(&a.is_dir)
                .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
        });
        Ok(result)
    })
    .join()
    .map_err(|_| "SFTP list task panicked".to_string())?
}

#[tauri::command]
pub fn ssh_sftp_download(
    connection: SSHConnection,
    remote_path: String,
    local_path: String,
    password: Option<String>,
) -> Result<(), String> {
    std::thread::spawn(move || {
        let session = ssh_connect_session(&connection, password.as_deref())?;
        let sftp = session
            .sftp()
            .map_err(|err| format!("Failed to open SFTP session: {}", err))?;
        let mut remote = sftp
            .open(Path::new(&remote_path))
            .map_err(|err| format!("Failed to open remote file: {}", err))?;
        let mut local = fs::File::create(&local_path)
            .map_err(|err| format!("Failed to create local file: {}", err))?;
        std::io::copy(&mut remote, &mut local)
            .map_err(|err| format!("Failed to download file: {}", err))?;
        Ok(())
    })
    .join()
    .map_err(|_| "SFTP download task panicked".to_string())?
}

#[tauri::command]
pub fn ssh_sftp_upload(
    connection: SSHConnection,
    local_path: String,
    remote_path: String,
    password: Option<String>,
) -> Result<(), String> {
    // Check file size before uploading (limit: 100 MB)
    const MAX_UPLOAD_BYTES: u64 = 100 * 1024 * 1024;
    let metadata = fs::metadata(&local_path)
        .map_err(|err| format!("Failed to read local file info: {}", err))?;
    if metadata.len() > MAX_UPLOAD_BYTES {
        return Err(format!(
            "File too large ({:.1} MB). Maximum upload size is 100 MB.",
            metadata.len() as f64 / 1024.0 / 1024.0
        ));
    }
    std::thread::spawn(move || {
        let session = ssh_connect_session(&connection, password.as_deref())?;
        let sftp = session
            .sftp()
            .map_err(|err| format!("Failed to open SFTP session: {}", err))?;
        let mut local = fs::File::open(&local_path)
            .map_err(|err| format!("Failed to open local file: {}", err))?;
        let mut remote = sftp
            .create(Path::new(&remote_path))
            .map_err(|err| format!("Failed to create remote file: {}", err))?;
        std::io::copy(&mut local, &mut remote)
            .map_err(|err| format!("Failed to upload file: {}", err))?;
        Ok(())
    })
    .join()
    .map_err(|_| "SFTP upload task panicked".to_string())?
}

#[tauri::command]
pub fn ssh_sftp_read(
    connection: SSHConnection,
    path: String,
    password: Option<String>,
) -> Result<String, String> {
    std::thread::spawn(move || {
        let session = ssh_connect_session(&connection, password.as_deref())?;
        let sftp = session
            .sftp()
            .map_err(|err| format!("Failed to open SFTP session: {}", err))?;
        let mut file = sftp
            .open(Path::new(&path))
            .map_err(|err| format!("Failed to open remote file: {}", err))?;
        let mut content = String::new();
        file.read_to_string(&mut content)
            .map_err(|err| format!("Failed to read remote file as UTF-8: {}", err))?;
        Ok(content)
    })
    .join()
    .map_err(|_| "SFTP read task panicked".to_string())?
}

#[tauri::command]
pub fn ssh_sftp_write(
    connection: SSHConnection,
    path: String,
    content: String,
    password: Option<String>,
) -> Result<(), String> {
    std::thread::spawn(move || {
        let session = ssh_connect_session(&connection, password.as_deref())?;
        let sftp = session
            .sftp()
            .map_err(|err| format!("Failed to open SFTP session: {}", err))?;
        let mut file = sftp
            .create(Path::new(&path))
            .map_err(|err| format!("Failed to create remote file: {}", err))?;
        file.write_all(content.as_bytes())
            .map_err(|err| format!("Failed to write remote file: {}", err))
    })
    .join()
    .map_err(|_| "SFTP write task panicked".to_string())?
}

#[tauri::command]
pub fn ssh_sftp_mkdir(
    connection: SSHConnection,
    path: String,
    password: Option<String>,
) -> Result<(), String> {
    std::thread::spawn(move || {
        let session = ssh_connect_session(&connection, password.as_deref())?;
        let sftp = session
            .sftp()
            .map_err(|err| format!("Failed to open SFTP session: {}", err))?;
        sftp.mkdir(Path::new(&path), 0o755)
            .map_err(|err| format!("Failed to create remote directory: {}", err))
    })
    .join()
    .map_err(|_| "SFTP mkdir task panicked".to_string())?
}

#[tauri::command]
pub fn ssh_sftp_delete(
    connection: SSHConnection,
    path: String,
    is_dir: bool,
    password: Option<String>,
) -> Result<(), String> {
    std::thread::spawn(move || {
        let session = ssh_connect_session(&connection, password.as_deref())?;
        let sftp = session
            .sftp()
            .map_err(|err| format!("Failed to open SFTP session: {}", err))?;
        if is_dir {
            sftp.rmdir(Path::new(&path))
                .map_err(|err| format!("Failed to remove remote directory: {}", err))
        } else {
            sftp.unlink(Path::new(&path))
                .map_err(|err| format!("Failed to remove remote file: {}", err))
        }
    })
    .join()
    .map_err(|_| "SFTP delete task panicked".to_string())?
}

#[tauri::command]
pub fn ssh_sftp_rename(
    connection: SSHConnection,
    old_path: String,
    new_path: String,
    password: Option<String>,
) -> Result<(), String> {
    std::thread::spawn(move || {
        let session = ssh_connect_session(&connection, password.as_deref())?;
        let sftp = session
            .sftp()
            .map_err(|err| format!("Failed to open SFTP session: {}", err))?;
        sftp.rename(Path::new(&old_path), Path::new(&new_path), None)
            .map_err(|err| format!("Failed to rename remote path: {}", err))
    })
    .join()
    .map_err(|_| "SFTP rename task panicked".to_string())?
}
