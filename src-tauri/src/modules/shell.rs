/// Shell utility functions

pub fn default_shell() -> String {
    #[cfg(target_os = "windows")]
    {
        let pwsh7 = "C:\\Program Files\\PowerShell\\7\\pwsh.exe";
        if std::path::Path::new(pwsh7).exists() {
            return pwsh7.to_string();
        }
        "powershell.exe".to_string()
    }
    #[cfg(not(target_os = "windows"))]
    {
        std::env::var("SHELL").unwrap_or_else(|_| "/bin/bash".to_string())
    }
}
