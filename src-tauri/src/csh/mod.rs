//! CSH - Connexio Shell
//!
//! A modern, cross-platform shell built in Rust for the Connexio terminal.
//! Features:
//! - Built-in commands (cd, ls, cat, echo, pwd, clear, exit, env, history, alias)
//! - External command execution
//! - Pipes and redirection
//! - Environment variables
//! - Command history
//! - Tab completion with readline support
//! - Scripting support

pub mod ast;
pub mod builtins;
pub mod completion;
pub mod environment;
pub mod executor;
pub mod history;
pub mod lexer;
pub mod parser;
pub mod pipes;
pub mod readline;
pub mod redirect;
pub mod script;
pub mod shell;

// Re-exports
pub use environment::Environment;
pub use executor::Executor;
pub use history::History;
pub use readline::LineEditor;
pub use shell::Shell;
