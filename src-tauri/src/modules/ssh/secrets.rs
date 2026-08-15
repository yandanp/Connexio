use keyring::Entry;

const KEYRING_SERVICE: &str = "connexio.ssh";

#[tauri::command]
pub fn ssh_secret_set(key: String, value: String) -> Result<(), String> {
    Entry::new(KEYRING_SERVICE, &key)
        .map_err(|err| format!("Failed to open keychain entry: {}", err))?
        .set_password(&value)
        .map_err(|err| format!("Failed to save secret: {}", err))
}

#[tauri::command]
pub fn ssh_secret_get(key: String) -> Result<Option<String>, String> {
    match Entry::new(KEYRING_SERVICE, &key)
        .map_err(|err| format!("Failed to open keychain entry: {}", err))?
        .get_password()
    {
        Ok(value) => Ok(Some(value)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(err) => Err(format!("Failed to read secret: {}", err)),
    }
}

#[tauri::command]
pub fn ssh_secret_delete(key: String) -> Result<(), String> {
    match Entry::new(KEYRING_SERVICE, &key)
        .map_err(|err| format!("Failed to open keychain entry: {}", err))?
        .delete_credential()
    {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(err) => Err(format!("Failed to delete secret: {}", err)),
    }
}

#[tauri::command]
pub fn ssh_key_exists(key_path: String) -> bool {
    std::path::Path::new(&key_path).exists()
}
