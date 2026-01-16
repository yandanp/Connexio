//! Tab completion for CSH

use std::fs;
use std::path::{Path, PathBuf};

use crate::csh::builtins::Builtins;
use crate::csh::environment::Environment;

/// Completion result
#[derive(Debug, Clone)]
pub struct Completion {
    /// The completed text
    pub text: String,
    /// Display text (may include extra info)
    pub display: String,
    /// Whether this is a directory (for adding /)
    pub is_dir: bool,
}

/// Tab completion handler
pub struct Completer {
    builtins: Vec<String>,
}

impl Completer {
    pub fn new() -> Self {
        let builtins = Builtins::new();
        Self {
            builtins: builtins.list().iter().map(|s| s.to_string()).collect(),
        }
    }

    /// Get completions for the given input
    pub fn complete(&self, input: &str, env: &Environment) -> Vec<Completion> {
        let trimmed = input.trim();

        if trimmed.is_empty() {
            return Vec::new();
        }

        // Split into words
        let words: Vec<&str> = trimmed.split_whitespace().collect();

        if words.is_empty() {
            return Vec::new();
        }

        // Check if we're completing the first word (command) or arguments
        let is_first_word = words.len() == 1 && !input.ends_with(' ');

        if is_first_word {
            // Complete command name
            self.complete_command(&words[0], env)
        } else {
            // Complete file path
            let last_word = if input.ends_with(' ') {
                ""
            } else {
                words.last().unwrap_or(&"")
            };
            self.complete_path(last_word, env)
        }
    }

    /// Complete a command name (builtins, aliases, PATH commands)
    fn complete_command(&self, prefix: &str, env: &Environment) -> Vec<Completion> {
        let mut completions = Vec::new();

        // Add matching builtins
        for builtin in &self.builtins {
            if builtin.starts_with(prefix) {
                completions.push(Completion {
                    text: builtin.clone(),
                    display: format!("{} (builtin)", builtin),
                    is_dir: false,
                });
            }
        }

        // Add matching aliases
        for (name, value) in env.get_aliases() {
            if name.starts_with(prefix) {
                completions.push(Completion {
                    text: name.clone(),
                    display: format!("{} (alias: {})", name, value),
                    is_dir: false,
                });
            }
        }

        // Add matching commands from PATH
        if let Some(path_var) = env.get_value("PATH") {
            for dir in path_var.split(';') {
                if let Ok(entries) = fs::read_dir(dir) {
                    for entry in entries.filter_map(|e| e.ok()) {
                        let name = entry.file_name().to_string_lossy().to_string();

                        // Remove extension for display on Windows
                        let display_name = name
                            .strip_suffix(".exe")
                            .or_else(|| name.strip_suffix(".bat"))
                            .or_else(|| name.strip_suffix(".cmd"))
                            .or_else(|| name.strip_suffix(".ps1"))
                            .unwrap_or(&name);

                        if display_name.to_lowercase().starts_with(&prefix.to_lowercase()) {
                            // Avoid duplicates
                            if !completions.iter().any(|c| c.text == display_name) {
                                completions.push(Completion {
                                    text: display_name.to_string(),
                                    display: display_name.to_string(),
                                    is_dir: false,
                                });
                            }
                        }
                    }
                }
            }
        }

        // Sort and deduplicate
        completions.sort_by(|a, b| a.text.cmp(&b.text));
        completions.dedup_by(|a, b| a.text == b.text);

        completions
    }

    /// Complete a file path
    fn complete_path(&self, prefix: &str, env: &Environment) -> Vec<Completion> {
        let mut completions = Vec::new();

        // Handle tilde expansion
        let (dir, file_prefix) = if prefix.starts_with("~/") {
            if let Some(home) = env.get_value("HOME") {
                let expanded = prefix.replacen("~", &home, 1);
                let path = Path::new(&expanded);
                if let Some(parent) = path.parent() {
                    (
                        parent.to_path_buf(),
                        path.file_name()
                            .map(|s| s.to_string_lossy().to_string())
                            .unwrap_or_default(),
                    )
                } else {
                    (PathBuf::from(&home), String::new())
                }
            } else {
                return completions;
            }
        } else if prefix.contains('/') || prefix.contains('\\') {
            let path = Path::new(prefix);
            if let Some(parent) = path.parent() {
                let parent_path = if parent.as_os_str().is_empty() {
                    env.cwd().clone()
                } else if parent.is_absolute() {
                    parent.to_path_buf()
                } else {
                    env.cwd().join(parent)
                };
                (
                    parent_path,
                    path.file_name()
                        .map(|s| s.to_string_lossy().to_string())
                        .unwrap_or_default(),
                )
            } else {
                (env.cwd().clone(), prefix.to_string())
            }
        } else {
            (env.cwd().clone(), prefix.to_string())
        };

        // Read directory entries
        if let Ok(entries) = fs::read_dir(&dir) {
            for entry in entries.filter_map(|e| e.ok()) {
                let name = entry.file_name().to_string_lossy().to_string();

                if name.to_lowercase().starts_with(&file_prefix.to_lowercase()) {
                    let is_dir = entry.path().is_dir();
                    let display = if is_dir {
                        format!("{}/", name)
                    } else {
                        name.clone()
                    };

                    completions.push(Completion {
                        text: name,
                        display,
                        is_dir,
                    });
                }
            }
        }

        // Sort: directories first, then alphabetically
        completions.sort_by(|a, b| {
            match (a.is_dir, b.is_dir) {
                (true, false) => std::cmp::Ordering::Less,
                (false, true) => std::cmp::Ordering::Greater,
                _ => a.text.cmp(&b.text),
            }
        });

        completions
    }

    /// Get the common prefix of all completions
    pub fn common_prefix(completions: &[Completion]) -> String {
        if completions.is_empty() {
            return String::new();
        }

        if completions.len() == 1 {
            return completions[0].text.clone();
        }

        let first = &completions[0].text;
        let mut prefix_len = first.len();

        for completion in &completions[1..] {
            let common = first
                .chars()
                .zip(completion.text.chars())
                .take_while(|(a, b)| a.to_lowercase().next() == b.to_lowercase().next())
                .count();
            prefix_len = std::cmp::min(prefix_len, common);
        }

        first[..prefix_len].to_string()
    }
}

impl Default for Completer {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_common_prefix() {
        let completions = vec![
            Completion {
                text: "hello".to_string(),
                display: "hello".to_string(),
                is_dir: false,
            },
            Completion {
                text: "help".to_string(),
                display: "help".to_string(),
                is_dir: false,
            },
        ];

        assert_eq!(Completer::common_prefix(&completions), "hel");
    }
}
