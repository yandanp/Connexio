//! Main shell implementation for CSH
//!
//! This module provides the main Shell struct that handles the REPL
//! (Read-Eval-Print Loop) and integrates all other components.

use std::io::{self, BufRead, Write};

use chrono::Local;

use crate::csh::ast::ExitStatus;
use crate::csh::completion::{Completer, Completion};
use crate::csh::environment::Environment;
use crate::csh::executor::Executor;
use crate::csh::history::History;
use crate::csh::parser;
use crate::csh::readline::{LineEditor, ReadlineResult};
use crate::csh::script::ScriptRunner;

/// Shell configuration
#[derive(Debug, Clone)]
pub struct ShellConfig {
    /// Prompt format string
    pub prompt: String,
    /// Whether to show welcome message
    pub show_welcome: bool,
    /// History size
    pub history_size: usize,
    /// Enable colors
    pub colors: bool,
    /// Use readline (interactive mode with completion)
    pub use_readline: bool,
}

impl Default for ShellConfig {
    fn default() -> Self {
        Self {
            prompt: String::new(), // Will be set dynamically
            show_welcome: true,
            history_size: 10000,
            colors: true,
            use_readline: true, // Enable readline by default
        }
    }
}

/// The main shell struct
pub struct Shell {
    /// Command executor
    executor: Executor,
    /// Tab completer
    completer: Completer,
    /// Line editor for interactive input
    line_editor: LineEditor,
    /// Shell configuration
    config: ShellConfig,
    /// Whether the shell should exit
    should_exit: bool,
    /// Exit code to return
    exit_code: i32,
}

impl Shell {
    /// Create a new shell instance
    pub fn new() -> Self {
        Self {
            executor: Executor::new(),
            completer: Completer::new(),
            line_editor: LineEditor::new(),
            config: ShellConfig::default(),
            should_exit: false,
            exit_code: 0,
        }
    }

    /// Create a shell with custom configuration
    pub fn with_config(config: ShellConfig) -> Self {
        Self {
            executor: Executor::new(),
            completer: Completer::new(),
            line_editor: LineEditor::new(),
            config,
            should_exit: false,
            exit_code: 0,
        }
    }

    /// Get access to the environment
    pub fn env(&self) -> &Environment {
        &self.executor.env
    }

    /// Get mutable access to the environment
    pub fn env_mut(&mut self) -> &mut Environment {
        &mut self.executor.env
    }

    /// Get access to history
    pub fn history(&self) -> &History {
        &self.executor.history
    }

    /// Get mutable access to history
    pub fn history_mut(&mut self) -> &mut History {
        &mut self.executor.history
    }

    /// Run the shell REPL (interactive mode)
    pub fn run(&mut self) -> i32 {
        // Show welcome message before enabling raw mode
        if self.config.show_welcome {
            self.show_welcome();
        }

        // Small delay to let terminal settle
        std::thread::sleep(std::time::Duration::from_millis(50));

        // Always use readline mode for interactive shells
        if self.config.use_readline {
            self.run_readline_mode()
        } else {
            self.run_simple_mode()
        }
    }

    /// Run with readline support (Tab completion, history navigation, etc.)
    fn run_readline_mode(&mut self) -> i32 {
        loop {
            let prompt = self.get_prompt();

            // Use readline for input
            match self.line_editor.readline(
                &prompt,
                &self.executor.history,
                &self.completer,
                &self.executor.env,
            ) {
                Ok(ReadlineResult::Line(input)) => {
                    let input = input.trim();

                    if input.is_empty() {
                        continue;
                    }

                    // Add to history
                    self.executor.history.add(input.to_string());

                    // Execute
                    self.execute_line(input);

                    if self.should_exit {
                        break;
                    }
                }
                Ok(ReadlineResult::Interrupted) => {
                    // Ctrl+C - just show new prompt
                    println!();
                    continue;
                }
                Ok(ReadlineResult::Eof) => {
                    // Ctrl+D on empty line
                    println!();
                    break;
                }
                Err(e) => {
                    eprintln!("csh: error reading input: {}", e);
                    break;
                }
            }
        }

        self.executor.history.save();
        self.exit_code
    }

    /// Run in simple mode (no readline, for piped input)
    fn run_simple_mode(&mut self) -> i32 {
        let stdin = io::stdin();
        let mut reader = stdin.lock();

        loop {
            // Show prompt (only if terminal)
            if atty::is(atty::Stream::Stdout) {
                self.show_prompt();
            }

            // Read line
            let mut input = String::new();
            match reader.read_line(&mut input) {
                Ok(0) => {
                    // EOF
                    if atty::is(atty::Stream::Stdout) {
                        println!();
                    }
                    break;
                }
                Ok(_) => {
                    let input = input.trim();

                    if input.is_empty() {
                        continue;
                    }

                    // Add to history
                    self.executor.history.add(input.to_string());

                    // Execute
                    self.execute_line(input);

                    if self.should_exit {
                        break;
                    }
                }
                Err(e) => {
                    eprintln!("csh: error reading input: {}", e);
                    break;
                }
            }
        }

        self.executor.history.save();
        self.exit_code
    }

    /// Execute a single line of input
    pub fn execute_line(&mut self, input: &str) -> ExitStatus {
        // Parse the input
        match parser::parse(input) {
            Ok(cmd_line) => {
                if cmd_line.is_empty() {
                    return ExitStatus::success();
                }

                // Execute the command line
                let result = self.executor.execute(&cmd_line);

                // Check for exit
                // We need to check if the last command was 'exit'
                if input.trim().starts_with("exit") {
                    self.should_exit = true;
                    self.exit_code = result.code;
                }

                result
            }
            Err(e) => {
                eprintln!("csh: {}", e);
                ExitStatus::failure(1)
            }
        }
    }

    /// Execute a script file
    pub fn execute_script(&mut self, path: &str) -> ExitStatus {
        let path = std::path::Path::new(path);
        let mut runner = ScriptRunner::new(&mut self.executor);

        match runner.run_file(path) {
            Ok(status) => status,
            Err(e) => {
                eprintln!("csh: {}", e);
                ExitStatus::failure(1)
            }
        }
    }

    /// Execute a command string (non-interactive)
    pub fn execute_command(&mut self, command: &str) -> ExitStatus {
        for line in command.lines() {
            let line = line.trim();
            if line.is_empty() || line.starts_with('#') {
                continue;
            }

            let status = self.execute_line(line);
            if self.should_exit {
                return status;
            }
        }

        ExitStatus::success()
    }

    /// Get completions for input
    pub fn get_completions(&self, input: &str) -> Vec<Completion> {
        self.completer.complete(input, &self.executor.env)
    }

    /// Generate the shell prompt
    pub fn get_prompt(&self) -> String {
        let env = &self.executor.env;

        // Get components
        let user = env.get_value("USER").unwrap_or_else(|| "user".to_string());
        let host = env.get_value("HOSTNAME").unwrap_or_else(|| "csh".to_string());
        let cwd = env.cwd();

        // Shorten path if it starts with home
        let display_path = if let Some(home) = env.get_value("HOME") {
            let cwd_str = cwd.to_string_lossy();
            if cwd_str.starts_with(&home) {
                cwd_str.replacen(&home, "~", 1)
            } else {
                cwd_str.to_string()
            }
        } else {
            cwd.to_string_lossy().to_string()
        };

        let last_exit = env.last_exit_code();
        let exit_indicator = if last_exit == 0 {
            "\x1b[32m✓\x1b[0m" // Green checkmark
        } else {
            "\x1b[31m✗\x1b[0m" // Red X
        };

        if self.config.colors {
            format!(
                "{} \x1b[1;36m{}\x1b[0m@\x1b[1;35m{}\x1b[0m \x1b[1;33m{}\x1b[0m\r\n\x1b[1;32m❯\x1b[0m ",
                exit_indicator, user, host, display_path
            )
        } else {
            format!("{} {}@{} {}\r\n> ", 
                if last_exit == 0 { "✓" } else { "✗" },
                user, host, display_path
            )
        }
    }

    /// Show the prompt
    fn show_prompt(&self) {
        print!("{}", self.get_prompt());
        let _ = io::stdout().flush();
    }

    /// Show welcome message
    fn show_welcome(&self) {
        let version = "0.2.0";
        let date = Local::now().format("%Y-%m-%d");

        if self.config.colors {
            // Use \r\n for proper display in raw mode / PTY
            print!("\x1b[1;36m\r\n");
            print!("   _____ _____ _    _ \r\n");
            print!("  / ____/ ____| |  | |\r\n");
            print!(" | |   | (___ | |__| |\r\n");
            print!(" | |    \\___ \\|  __  |\r\n");
            print!(" | |___ ____) | |  | |\r\n");
            print!("  \\_____|_____/|_|  |_|\r\n");
            print!("\x1b[0m\r\n");
            print!("\x1b[1;33mConnexio Shell\x1b[0m v{} ({})\r\n", version, date);
            print!("Type \x1b[1;32mhelp\x1b[0m for available commands.\r\n");
            print!("\x1b[90mTab completion and history navigation enabled.\x1b[0m\r\n");
            print!("\x1b[90mTip: Use Ctrl+Shift+K to force kill a running process.\x1b[0m\r\n\r\n");
        } else {
            print!("CSH - Connexio Shell v{} ({})\r\n", version, date);
            print!("Type 'help' for available commands.\r\n\r\n");
        }
        let _ = io::stdout().flush();
    }

    /// Check if shell should exit
    pub fn should_exit(&self) -> bool {
        self.should_exit
    }

    /// Get exit code
    pub fn exit_code(&self) -> i32 {
        self.exit_code
    }

    /// Request shell exit
    pub fn request_exit(&mut self, code: i32) {
        self.should_exit = true;
        self.exit_code = code;
    }
}

impl Default for Shell {
    fn default() -> Self {
        Self::new()
    }
}

/// Entry point for CSH as a standalone binary
pub fn main() -> i32 {
    let args: Vec<String> = std::env::args().collect();

    let mut shell = Shell::new();
    shell.config.show_welcome = true;

    if args.len() > 1 {
        // Execute script or command
        if args[1] == "-c" && args.len() > 2 {
            // Execute command string - don't show welcome, no readline
            shell.config.show_welcome = false;
            shell.config.use_readline = false;
            let command = args[2..].join(" ");
            let status = shell.execute_command(&command);
            return status.code;
        } else if args[1] == "--help" || args[1] == "-h" {
            println!("CSH - Connexio Shell v0.2.0");
            println!();
            println!("Usage:");
            println!("  csh                Run interactive shell");
            println!("  csh -c <command>   Execute command and exit");
            println!("  csh <script>       Execute script file");
            println!("  csh --help         Show this help");
            println!();
            println!("Interactive Features:");
            println!("  Tab          Command and path completion");
            println!("  Up/Down      Navigate command history");
            println!("  Ctrl+R       Reverse history search");
            println!("  Ctrl+C       Cancel current line");
            println!("  Ctrl+D       Exit shell (on empty line)");
            println!("  Ctrl+L       Clear screen");
            println!("  Ctrl+A/E     Move to start/end of line");
            println!("  Ctrl+W       Delete word backward");
            return 0;
        } else if args[1] == "--version" || args[1] == "-V" {
            println!("CSH - Connexio Shell v0.2.0");
            return 0;
        } else {
            // Execute script file - don't show welcome, no readline
            shell.config.show_welcome = false;
            shell.config.use_readline = false;
            let status = shell.execute_script(&args[1]);
            return status.code;
        }
    }

    // Interactive mode
    shell.run()
}
