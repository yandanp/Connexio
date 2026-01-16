//! Environment variable management for CSH

use std::collections::HashMap;
use std::env;
use std::path::PathBuf;

/// Manages environment variables for the shell
#[derive(Debug, Clone)]
pub struct Environment {
    /// Shell-local variables (not exported to child processes)
    local_vars: HashMap<String, String>,
    /// Exported variables (inherited by child processes)
    exported_vars: HashMap<String, String>,
    /// Aliases
    aliases: HashMap<String, String>,
    /// Current working directory
    cwd: PathBuf,
    /// Last exit code
    last_exit_code: i32,
    /// Shell PID
    shell_pid: u32,
}

impl Environment {
    pub fn new() -> Self {
        let cwd = env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
        let shell_pid = std::process::id();

        let mut env = Self {
            local_vars: HashMap::new(),
            exported_vars: HashMap::new(),
            aliases: HashMap::new(),
            cwd,
            last_exit_code: 0,
            shell_pid,
        };

        // Initialize with system environment
        for (key, value) in env::vars() {
            env.exported_vars.insert(key, value);
        }

        // Set shell-specific variables
        env.set_special_vars();

        env
    }

    fn set_special_vars(&mut self) {
        // Shell name
        self.local_vars
            .insert("SHELL_NAME".to_string(), "csh".to_string());
        self.local_vars
            .insert("SHELL_VERSION".to_string(), "0.1.0".to_string());

        // Current directory
        if let Some(cwd_str) = self.cwd.to_str() {
            self.exported_vars
                .insert("PWD".to_string(), cwd_str.to_string());
        }

        // Home directory
        if let Some(home) = dirs::home_dir() {
            if let Some(home_str) = home.to_str() {
                self.exported_vars
                    .insert("HOME".to_string(), home_str.to_string());
            }
        }

        // Username
        let username = whoami::username();
        self.exported_vars.insert("USER".to_string(), username);

        // Hostname
        if let Ok(hostname) = whoami::fallible::hostname() {
            self.exported_vars.insert("HOSTNAME".to_string(), hostname);
        }
    }

    /// Get a variable value (checks local first, then exported)
    pub fn get(&self, name: &str) -> Option<&String> {
        self.local_vars
            .get(name)
            .or_else(|| self.exported_vars.get(name))
    }

    /// Get a variable value as owned string
    pub fn get_value(&self, name: &str) -> Option<String> {
        match name {
            "?" => Some(self.last_exit_code.to_string()),
            "$" => Some(self.shell_pid.to_string()),
            "PWD" => self.cwd.to_str().map(|s| s.to_string()),
            _ => self
                .local_vars
                .get(name)
                .or_else(|| self.exported_vars.get(name))
                .cloned(),
        }
    }

    /// Set a local variable
    pub fn set(&mut self, name: &str, value: &str) {
        self.local_vars.insert(name.to_string(), value.to_string());
    }

    /// Export a variable (make it available to child processes)
    pub fn export(&mut self, name: &str, value: Option<&str>) {
        let val = value
            .map(|v| v.to_string())
            .or_else(|| self.local_vars.get(name).cloned())
            .unwrap_or_default();

        self.exported_vars.insert(name.to_string(), val.clone());
        env::set_var(name, &val);

        // Remove from local vars since it's now exported
        self.local_vars.remove(name);
    }

    /// Unset a variable
    pub fn unset(&mut self, name: &str) {
        self.local_vars.remove(name);
        self.exported_vars.remove(name);
        env::remove_var(name);
    }

    /// Get all exported variables for child processes
    pub fn get_exports(&self) -> HashMap<String, String> {
        self.exported_vars.clone()
    }

    /// Get all variables (local + exported)
    pub fn get_all(&self) -> HashMap<String, String> {
        let mut all = self.exported_vars.clone();
        for (k, v) in &self.local_vars {
            all.insert(k.clone(), v.clone());
        }
        all
    }

    /// Set the last exit code
    pub fn set_last_exit_code(&mut self, code: i32) {
        self.last_exit_code = code;
    }

    /// Get the last exit code
    pub fn last_exit_code(&self) -> i32 {
        self.last_exit_code
    }

    /// Get current working directory
    pub fn cwd(&self) -> &PathBuf {
        &self.cwd
    }

    /// Set current working directory
    pub fn set_cwd(&mut self, path: PathBuf) -> std::io::Result<()> {
        env::set_current_dir(&path)?;
        self.cwd = path;

        // Update PWD
        if let Some(cwd_str) = self.cwd.to_str() {
            self.exported_vars
                .insert("PWD".to_string(), cwd_str.to_string());
            env::set_var("PWD", cwd_str);
        }

        Ok(())
    }

    /// Add an alias
    pub fn set_alias(&mut self, name: &str, value: &str) {
        self.aliases.insert(name.to_string(), value.to_string());
    }

    /// Get an alias
    pub fn get_alias(&self, name: &str) -> Option<&String> {
        self.aliases.get(name)
    }

    /// Remove an alias
    pub fn unalias(&mut self, name: &str) {
        self.aliases.remove(name);
    }

    /// Get all aliases
    pub fn get_aliases(&self) -> &HashMap<String, String> {
        &self.aliases
    }

    /// Expand variables in a string
    pub fn expand_variables(&self, input: &str) -> String {
        let mut result = String::new();
        let mut chars = input.chars().peekable();

        while let Some(c) = chars.next() {
            if c == '$' {
                if chars.peek() == Some(&'{') {
                    // ${VAR} syntax
                    chars.next(); // consume '{'
                    let mut var_name = String::new();
                    while let Some(&ch) = chars.peek() {
                        if ch == '}' {
                            chars.next();
                            break;
                        }
                        var_name.push(ch);
                        chars.next();
                    }
                    if let Some(value) = self.get_value(&var_name) {
                        result.push_str(&value);
                    }
                } else if chars.peek().map(|c| c.is_alphabetic() || *c == '_' || *c == '?') == Some(true) {
                    // $VAR syntax
                    let mut var_name = String::new();
                    while let Some(&ch) = chars.peek() {
                        if ch.is_alphanumeric() || ch == '_' {
                            var_name.push(ch);
                            chars.next();
                        } else if ch == '?' && var_name.is_empty() {
                            var_name.push(ch);
                            chars.next();
                            break;
                        } else {
                            break;
                        }
                    }
                    if let Some(value) = self.get_value(&var_name) {
                        result.push_str(&value);
                    }
                } else {
                    result.push(c);
                }
            } else if c == '~' && result.is_empty() {
                // Tilde expansion at start
                if let Some(home) = self.get_value("HOME") {
                    result.push_str(&home);
                } else {
                    result.push(c);
                }
            } else {
                result.push(c);
            }
        }

        result
    }

    /// Expand an alias if it exists
    pub fn expand_alias(&self, command: &str) -> Option<String> {
        self.aliases.get(command).cloned()
    }
}

impl Default for Environment {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_set_and_get() {
        let mut env = Environment::new();
        env.set("FOO", "bar");
        assert_eq!(env.get_value("FOO"), Some("bar".to_string()));
    }

    #[test]
    fn test_export() {
        let mut env = Environment::new();
        env.set("FOO", "bar");
        env.export("FOO", None);
        assert!(env.exported_vars.contains_key("FOO"));
    }

    #[test]
    fn test_expand_variables() {
        let mut env = Environment::new();
        env.set("NAME", "World");
        let result = env.expand_variables("Hello $NAME!");
        assert_eq!(result, "Hello World!");
    }

    #[test]
    fn test_expand_braces() {
        let mut env = Environment::new();
        env.set("NAME", "World");
        let result = env.expand_variables("Hello ${NAME}!");
        assert_eq!(result, "Hello World!");
    }

    #[test]
    fn test_alias() {
        let mut env = Environment::new();
        env.set_alias("ll", "ls -la");
        assert_eq!(env.get_alias("ll"), Some(&"ls -la".to_string()));
    }
}
