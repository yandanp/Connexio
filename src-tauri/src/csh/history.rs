//! Command history for CSH

use std::collections::VecDeque;
use std::fs::{File, OpenOptions};
use std::io::{BufRead, BufReader, Write};
use std::path::PathBuf;

/// Manages command history
#[derive(Debug)]
pub struct History {
    /// History entries
    entries: VecDeque<String>,
    /// Maximum history size
    max_size: usize,
    /// Current position when navigating history
    position: usize,
    /// Path to history file
    file_path: Option<PathBuf>,
    /// Whether to save on each command
    autosave: bool,
}

impl History {
    pub fn new(max_size: usize) -> Self {
        Self {
            entries: VecDeque::with_capacity(max_size),
            max_size,
            position: 0,
            file_path: None,
            autosave: true,
        }
    }

    /// Create history with file persistence
    pub fn with_file(max_size: usize, file_path: PathBuf) -> Self {
        let mut history = Self::new(max_size);
        history.file_path = Some(file_path.clone());
        history.load_from_file(&file_path);
        history
    }

    /// Add a command to history
    pub fn add(&mut self, command: String) {
        // Don't add empty commands or duplicates of the last command
        if command.is_empty() {
            return;
        }

        if let Some(last) = self.entries.back() {
            if last == &command {
                return;
            }
        }

        // Don't add commands that start with space (privacy feature)
        if command.starts_with(' ') {
            return;
        }

        // Remove oldest if at capacity
        if self.entries.len() >= self.max_size {
            self.entries.pop_front();
        }

        self.entries.push_back(command);
        self.position = self.entries.len();

        // Autosave if enabled
        if self.autosave {
            self.save();
        }
    }

    /// Get previous command (for up arrow)
    pub fn previous(&mut self) -> Option<&String> {
        if self.entries.is_empty() || self.position == 0 {
            return None;
        }
        self.position -= 1;
        self.entries.get(self.position)
    }

    /// Get next command (for down arrow)
    pub fn next(&mut self) -> Option<&String> {
        if self.position >= self.entries.len() {
            return None;
        }
        self.position += 1;
        if self.position >= self.entries.len() {
            None
        } else {
            self.entries.get(self.position)
        }
    }

    /// Reset position to end
    pub fn reset_position(&mut self) {
        self.position = self.entries.len();
    }

    /// Get command at index
    pub fn get(&self, index: usize) -> Option<&String> {
        self.entries.get(index)
    }

    /// Get last N commands
    pub fn last_n(&self, n: usize) -> Vec<&String> {
        self.entries
            .iter()
            .rev()
            .take(n)
            .collect::<Vec<_>>()
            .into_iter()
            .rev()
            .collect()
    }

    /// Get all history entries
    pub fn all(&self) -> Vec<&String> {
        self.entries.iter().collect()
    }

    /// Get history size
    pub fn len(&self) -> usize {
        self.entries.len()
    }

    /// Check if history is empty
    pub fn is_empty(&self) -> bool {
        self.entries.is_empty()
    }

    /// Clear history
    pub fn clear(&mut self) {
        self.entries.clear();
        self.position = 0;
    }

    /// Search history for commands containing pattern
    pub fn search(&self, pattern: &str) -> Vec<(usize, &String)> {
        self.entries
            .iter()
            .enumerate()
            .filter(|(_, cmd)| cmd.contains(pattern))
            .collect()
    }

    /// Search history backwards for commands starting with prefix
    pub fn search_prefix(&self, prefix: &str) -> Option<&String> {
        self.entries
            .iter()
            .rev()
            .find(|cmd| cmd.starts_with(prefix))
    }

    /// Load history from file
    fn load_from_file(&mut self, path: &PathBuf) {
        if let Ok(file) = File::open(path) {
            let reader = BufReader::new(file);
            for line in reader.lines().flatten() {
                if !line.is_empty() && self.entries.len() < self.max_size {
                    self.entries.push_back(line);
                }
            }
            self.position = self.entries.len();
        }
    }

    /// Save history to file
    pub fn save(&self) {
        if let Some(ref path) = self.file_path {
            if let Some(parent) = path.parent() {
                let _ = std::fs::create_dir_all(parent);
            }

            if let Ok(mut file) = OpenOptions::new()
                .write(true)
                .create(true)
                .truncate(true)
                .open(path)
            {
                for entry in &self.entries {
                    let _ = writeln!(file, "{}", entry);
                }
            }
        }
    }

    /// Get history file path
    pub fn get_default_path() -> PathBuf {
        dirs::data_local_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("connexio")
            .join("csh_history")
    }
}

impl Default for History {
    fn default() -> Self {
        Self::new(1000)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_add_and_get() {
        let mut history = History::new(100);
        history.add("ls".to_string());
        history.add("cd /home".to_string());
        assert_eq!(history.len(), 2);
        assert_eq!(history.get(0), Some(&"ls".to_string()));
    }

    #[test]
    fn test_navigation() {
        let mut history = History::new(100);
        history.add("cmd1".to_string());
        history.add("cmd2".to_string());
        history.add("cmd3".to_string());

        assert_eq!(history.previous(), Some(&"cmd3".to_string()));
        assert_eq!(history.previous(), Some(&"cmd2".to_string()));
        assert_eq!(history.next(), Some(&"cmd3".to_string()));
    }

    #[test]
    fn test_no_duplicates() {
        let mut history = History::new(100);
        history.add("ls".to_string());
        history.add("ls".to_string());
        assert_eq!(history.len(), 1);
    }

    #[test]
    fn test_search() {
        let mut history = History::new(100);
        history.add("ls -la".to_string());
        history.add("cd /home".to_string());
        history.add("ls /tmp".to_string());

        let results = history.search("ls");
        assert_eq!(results.len(), 2);
    }
}
