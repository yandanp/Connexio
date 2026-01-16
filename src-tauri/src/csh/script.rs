//! Script execution for CSH
//!
//! Handles execution of .csh script files.

use std::fs;
use std::path::Path;

use crate::csh::ast::ExitStatus;
use crate::csh::executor::Executor;
use crate::csh::parser;

/// Script executor
pub struct ScriptRunner<'a> {
    executor: &'a mut Executor,
}

impl<'a> ScriptRunner<'a> {
    pub fn new(executor: &'a mut Executor) -> Self {
        Self { executor }
    }

    /// Execute a script file
    pub fn run_file(&mut self, path: &Path) -> Result<ExitStatus, String> {
        let content = fs::read_to_string(path)
            .map_err(|e| format!("Cannot read script {}: {}", path.display(), e))?;

        self.run_script(&content)
    }

    /// Execute a script string
    pub fn run_script(&mut self, script: &str) -> Result<ExitStatus, String> {
        let mut last_status = ExitStatus::success();

        for (line_num, line) in script.lines().enumerate() {
            let line = line.trim();

            // Skip empty lines and comments
            if line.is_empty() || line.starts_with('#') {
                continue;
            }

            // Parse and execute the line
            match parser::parse(line) {
                Ok(cmd_line) => {
                    if !cmd_line.is_empty() {
                        last_status = self.executor.execute(&cmd_line);

                        // Check for exit command
                        if self.should_exit() {
                            break;
                        }
                    }
                }
                Err(e) => {
                    return Err(format!("Line {}: {}", line_num + 1, e));
                }
            }
        }

        Ok(last_status)
    }

    fn should_exit(&self) -> bool {
        // Check if the last command was 'exit'
        // This would be tracked in the executor
        false
    }
}

/// Check if a file is a CSH script
pub fn is_csh_script(path: &Path) -> bool {
    if let Some(ext) = path.extension() {
        return ext == "csh";
    }

    // Check for shebang
    if let Ok(content) = fs::read_to_string(path) {
        if let Some(first_line) = content.lines().next() {
            return first_line.starts_with("#!") && first_line.contains("csh");
        }
    }

    false
}

/// Load and parse a script file
pub fn load_script(path: &Path) -> Result<Vec<String>, String> {
    let content = fs::read_to_string(path)
        .map_err(|e| format!("Cannot read {}: {}", path.display(), e))?;

    let mut lines = Vec::new();
    let mut current_line = String::new();

    for line in content.lines() {
        let trimmed = line.trim();

        // Handle line continuation with backslash
        if trimmed.ends_with('\\') {
            current_line.push_str(&trimmed[..trimmed.len() - 1]);
            current_line.push(' ');
            continue;
        }

        current_line.push_str(trimmed);

        // Skip empty lines and comments
        if !current_line.is_empty() && !current_line.starts_with('#') {
            lines.push(current_line.clone());
        }

        current_line.clear();
    }

    Ok(lines)
}
