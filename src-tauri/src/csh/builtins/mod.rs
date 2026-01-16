//! Built-in commands for CSH

pub mod alias;
pub mod cat;
pub mod cd;
pub mod clear;
pub mod echo;
pub mod env_cmd;
pub mod exit;
pub mod export;
pub mod history_cmd;
pub mod ls;
pub mod pwd;
pub mod set;
pub mod unset;
pub mod which;
pub mod help;

use crate::csh::ast::ExitStatus;
use crate::csh::environment::Environment;
use crate::csh::history::History;

/// Result of a built-in command execution
#[derive(Debug)]
pub struct BuiltinResult {
    pub status: ExitStatus,
    pub output: Option<String>,
    pub error: Option<String>,
    pub should_exit: bool,
    pub exit_code: Option<i32>,
}

impl BuiltinResult {
    pub fn success() -> Self {
        Self {
            status: ExitStatus::success(),
            output: None,
            error: None,
            should_exit: false,
            exit_code: None,
        }
    }

    pub fn success_with_output(output: String) -> Self {
        Self {
            status: ExitStatus::success(),
            output: Some(output),
            error: None,
            should_exit: false,
            exit_code: None,
        }
    }

    pub fn failure(code: i32, error: String) -> Self {
        Self {
            status: ExitStatus::failure(code),
            output: None,
            error: Some(error),
            should_exit: false,
            exit_code: None,
        }
    }

    pub fn exit(code: i32) -> Self {
        Self {
            status: ExitStatus::failure(code),
            output: None,
            error: None,
            should_exit: true,
            exit_code: Some(code),
        }
    }
}

/// Built-in commands handler
pub struct Builtins {
    /// List of built-in command names
    commands: Vec<&'static str>,
}

impl Builtins {
    pub fn new() -> Self {
        Self {
            commands: vec![
                "cd", "pwd", "echo", "exit", "clear", "cls", "ls", "dir", "cat", "type",
                "env", "set", "unset", "export", "alias", "unalias", "history",
                "which", "where", "help", "true", "false",
            ],
        }
    }

    /// Check if a command is a built-in
    pub fn is_builtin(&self, name: &str) -> bool {
        self.commands.contains(&name)
    }

    /// Get all built-in command names
    pub fn list(&self) -> &[&'static str] {
        &self.commands
    }

    /// Execute a built-in command
    pub fn execute(
        &self,
        name: &str,
        args: &[String],
        env: &mut Environment,
        history: &mut History,
    ) -> BuiltinResult {
        match name {
            "cd" => cd::execute(args, env),
            "pwd" => pwd::execute(env),
            "echo" => echo::execute(args),
            "exit" => exit::execute(args),
            "clear" | "cls" => clear::execute(),
            "ls" | "dir" => ls::execute(args, env),
            "cat" | "type" => cat::execute(args, env),
            "env" => env_cmd::execute(env),
            "set" => set::execute(args, env),
            "unset" => unset::execute(args, env),
            "export" => export::execute(args, env),
            "alias" => alias::execute_alias(args, env),
            "unalias" => alias::execute_unalias(args, env),
            "history" => history_cmd::execute(args, history),
            "which" | "where" => which::execute(args, env),
            "help" => help::execute(args),
            "true" => BuiltinResult::success(),
            "false" => BuiltinResult::failure(1, String::new()),
            _ => BuiltinResult::failure(1, format!("csh: {}: command not found\n", name)),
        }
    }
}

impl Default for Builtins {
    fn default() -> Self {
        Self::new()
    }
}
