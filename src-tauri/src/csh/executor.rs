//! Command executor for CSH
//!
//! Handles execution of parsed commands, including built-in commands,
//! external processes, pipes, and redirections.

use std::fs::{File, OpenOptions};
use std::io::{self, Read, Write};
use std::process::{Child, Command as ProcessCommand, Stdio};

use crate::csh::ast::{Command, CommandLine, ExitStatus, LogicalOp, Pipeline, RedirectType};
use crate::csh::builtins::Builtins;
use crate::csh::environment::Environment;
use crate::csh::history::History;

/// Command executor
pub struct Executor {
    /// Environment variables
    pub env: Environment,
    /// Command history
    pub history: History,
    /// Built-in commands handler
    builtins: Builtins,
    /// Output buffer for captured output
    output_buffer: Vec<u8>,
    /// Whether to capture output instead of printing
    capture_output: bool,
}

impl Executor {
    pub fn new() -> Self {
        let history_path = History::get_default_path();
        Self {
            env: Environment::new(),
            history: History::with_file(10000, history_path),
            builtins: Builtins::new(),
            output_buffer: Vec::new(),
            capture_output: false,
        }
    }

    /// Execute a command line
    pub fn execute(&mut self, cmd_line: &CommandLine) -> ExitStatus {
        if cmd_line.is_empty() {
            return ExitStatus::success();
        }

        let mut last_status = ExitStatus::success();
        let mut skip_next = false;

        for (i, pipeline) in cmd_line.pipelines.iter().enumerate() {
            // Check logical operators
            if i > 0 && i <= cmd_line.operators.len() {
                let op = &cmd_line.operators[i - 1];
                match op {
                    LogicalOp::And => {
                        if !last_status.is_success() {
                            skip_next = true;
                        }
                    }
                    LogicalOp::Or => {
                        if last_status.is_success() {
                            skip_next = true;
                        }
                    }
                    LogicalOp::Sequence => {
                        skip_next = false;
                    }
                }
            }

            if skip_next {
                skip_next = false;
                continue;
            }

            last_status = self.execute_pipeline(pipeline);
            self.env.set_last_exit_code(last_status.code);
        }

        last_status
    }

    /// Execute a pipeline
    pub fn execute_pipeline(&mut self, pipeline: &Pipeline) -> ExitStatus {
        if pipeline.commands.is_empty() {
            return ExitStatus::success();
        }

        // Single command - simple case
        if pipeline.commands.len() == 1 {
            return self.execute_single_command(
                &pipeline.commands[0],
                pipeline.stdin_redirect.as_ref(),
                &pipeline.stdout_redirects,
                pipeline.background,
            );
        }

        // Multiple commands - setup pipes
        self.execute_pipe_chain(pipeline)
    }

    /// Execute a single command with optional redirects
    fn execute_single_command(
        &mut self,
        cmd: &Command,
        stdin_redirect: Option<&crate::csh::ast::Redirect>,
        stdout_redirects: &[crate::csh::ast::Redirect],
        background: bool,
    ) -> ExitStatus {
        // Expand variables in command name and args
        let expanded_name = self.env.expand_variables(&cmd.name);
        let expanded_args: Vec<String> = cmd
            .args
            .iter()
            .map(|arg| self.env.expand_variables(arg))
            .collect();

        // Check for alias
        let (final_name, final_args) = if let Some(alias_expansion) = self.env.expand_alias(&expanded_name) {
            // Parse alias and prepend to args
            let mut parts: Vec<String> = alias_expansion.split_whitespace().map(|s| s.to_string()).collect();
            let alias_cmd = parts.remove(0);
            parts.extend(expanded_args);
            (alias_cmd, parts)
        } else {
            (expanded_name, expanded_args)
        };

        // Check if it's a built-in command
        if self.builtins.is_builtin(&final_name) {
            return self.execute_builtin(&final_name, &final_args, stdout_redirects);
        }

        // External command
        self.execute_external(&final_name, &final_args, stdin_redirect, stdout_redirects, background)
    }

    /// Execute a built-in command
    fn execute_builtin(
        &mut self,
        name: &str,
        args: &[String],
        redirects: &[crate::csh::ast::Redirect],
    ) -> ExitStatus {
        // Setup output redirection if needed
        let mut output_file: Option<File> = None;
        for redirect in redirects {
            match redirect.redirect_type {
                RedirectType::StdoutOverwrite | RedirectType::BothOverwrite => {
                    let path = self.env.expand_variables(&redirect.target);
                    match File::create(&path) {
                        Ok(f) => output_file = Some(f),
                        Err(e) => {
                            self.write_error(&format!("csh: cannot create {}: {}\n", path, e));
                            return ExitStatus::failure(1);
                        }
                    }
                }
                RedirectType::StdoutAppend | RedirectType::BothAppend => {
                    let path = self.env.expand_variables(&redirect.target);
                    match OpenOptions::new().create(true).append(true).open(&path) {
                        Ok(f) => output_file = Some(f),
                        Err(e) => {
                            self.write_error(&format!("csh: cannot open {}: {}\n", path, e));
                            return ExitStatus::failure(1);
                        }
                    }
                }
                _ => {}
            }
        }

        // Execute the built-in
        let result = self.builtins.execute(name, args, &mut self.env, &mut self.history);

        // Write output
        if let Some(ref output) = result.output {
            if let Some(ref mut file) = output_file {
                let _ = file.write_all(output.as_bytes());
            } else {
                self.write_output(output);
            }
        }

        // Handle errors
        if let Some(ref error) = result.error {
            self.write_error(error);
        }

        result.status
    }

    /// Execute an external command
    fn execute_external(
        &mut self,
        name: &str,
        args: &[String],
        stdin_redirect: Option<&crate::csh::ast::Redirect>,
        stdout_redirects: &[crate::csh::ast::Redirect],
        background: bool,
    ) -> ExitStatus {
        // On Windows, run ALL external commands through cmd.exe /c
        // This lets Windows handle PATH resolution, PATHEXT, and script execution
        #[cfg(windows)]
        let (actual_command, actual_args) = {
            let mut cmd_args = vec!["/c".to_string(), name.to_string()];
            cmd_args.extend(args.iter().cloned());
            ("cmd.exe".to_string(), cmd_args)
        };
        
        #[cfg(not(windows))]
        let (actual_command, actual_args) = (name.to_string(), args.to_vec());
        
        let mut cmd = ProcessCommand::new(&actual_command);
        cmd.args(&actual_args);

        // Set environment
        cmd.envs(self.env.get_exports());
        cmd.current_dir(self.env.cwd());

        // Setup stdin
        if let Some(redirect) = stdin_redirect {
            let path = self.env.expand_variables(&redirect.target);
            match File::open(&path) {
                Ok(file) => {
                    cmd.stdin(Stdio::from(file));
                }
                Err(e) => {
                    self.write_error(&format!("csh: cannot open {}: {}\n", path, e));
                    return ExitStatus::failure(1);
                }
            }
        } else {
            cmd.stdin(Stdio::inherit());
        }

        // Setup stdout/stderr
        let mut stdout_file: Option<File> = None;
        let mut stderr_file: Option<File> = None;

        for redirect in stdout_redirects {
            let path = self.env.expand_variables(&redirect.target);
            let file = match redirect.redirect_type {
                RedirectType::StdoutOverwrite => File::create(&path),
                RedirectType::StdoutAppend => OpenOptions::new().create(true).append(true).open(&path),
                RedirectType::StderrOverwrite => File::create(&path),
                RedirectType::StderrAppend => OpenOptions::new().create(true).append(true).open(&path),
                RedirectType::BothOverwrite => File::create(&path),
                RedirectType::BothAppend => OpenOptions::new().create(true).append(true).open(&path),
                _ => continue,
            };

            match file {
                Ok(f) => {
                    match redirect.redirect_type {
                        RedirectType::StdoutOverwrite | RedirectType::StdoutAppend => {
                            stdout_file = Some(f);
                        }
                        RedirectType::StderrOverwrite | RedirectType::StderrAppend => {
                            stderr_file = Some(f);
                        }
                        RedirectType::BothOverwrite | RedirectType::BothAppend => {
                            stdout_file = Some(f.try_clone().unwrap());
                            stderr_file = Some(f);
                        }
                        _ => {}
                    }
                }
                Err(e) => {
                    self.write_error(&format!("csh: cannot create {}: {}\n", path, e));
                    return ExitStatus::failure(1);
                }
            }
        }

        if let Some(file) = stdout_file {
            cmd.stdout(Stdio::from(file));
        } else if self.capture_output {
            cmd.stdout(Stdio::piped());
        } else {
            cmd.stdout(Stdio::inherit());
        }

        if let Some(file) = stderr_file {
            cmd.stderr(Stdio::from(file));
        } else {
            cmd.stderr(Stdio::inherit());
        }

        // Spawn the process
        match cmd.spawn() {
            Ok(mut child) => {
                if background {
                    self.write_output(&format!("[{}] {}\n", child.id(), name));
                    ExitStatus::success()
                } else {
                    // Wait for completion
                    match child.wait() {
                        Ok(status) => {
                            if self.capture_output {
                                if let Some(mut stdout) = child.stdout.take() {
                                    let mut output = Vec::new();
                                    let _ = stdout.read_to_end(&mut output);
                                    self.output_buffer.extend(output);
                                }
                            }
                            ExitStatus::failure(status.code().unwrap_or(1))
                        }
                        Err(e) => {
                            self.write_error(&format!("csh: error waiting for {}: {}\n", name, e));
                            ExitStatus::failure(1)
                        }
                    }
                }
            }
            Err(e) => {
                self.write_error(&format!("csh: {}: {}\n", name, e));
                ExitStatus::failure(127)
            }
        }
    }

    /// Execute a pipeline of commands connected by pipes
    fn execute_pipe_chain(&mut self, pipeline: &Pipeline) -> ExitStatus {
        let mut children: Vec<Child> = Vec::new();
        let cmd_count = pipeline.commands.len();

        for (i, cmd) in pipeline.commands.iter().enumerate() {
            let expanded_name = self.env.expand_variables(&cmd.name);
            let expanded_args: Vec<String> = cmd
                .args
                .iter()
                .map(|arg| self.env.expand_variables(arg))
                .collect();

            // On Windows, run ALL external commands through cmd.exe /c
            #[cfg(windows)]
            let (actual_command, actual_args) = {
                let mut cmd_args = vec!["/c".to_string(), expanded_name.clone()];
                cmd_args.extend(expanded_args.iter().cloned());
                ("cmd.exe".to_string(), cmd_args)
            };
            
            #[cfg(not(windows))]
            let (actual_command, actual_args) = (expanded_name.clone(), expanded_args.clone());

            let mut process = ProcessCommand::new(&actual_command);
            process.args(&actual_args);
            process.envs(self.env.get_exports());
            process.current_dir(self.env.cwd());

            // Setup stdin
            if i == 0 {
                // First command - check for input redirect
                if let Some(redirect) = &pipeline.stdin_redirect {
                    let path = self.env.expand_variables(&redirect.target);
                    match File::open(&path) {
                        Ok(file) => process.stdin(Stdio::from(file)),
                        Err(e) => {
                            self.write_error(&format!("csh: cannot open {}: {}\n", path, e));
                            return ExitStatus::failure(1);
                        }
                    };
                } else {
                    process.stdin(Stdio::inherit());
                }
            } else {
                // Take stdout from previous command
                if let Some(prev_child) = children.last_mut() {
                    if let Some(stdout) = prev_child.stdout.take() {
                        process.stdin(Stdio::from(stdout));
                    }
                }
            }

            // Setup stdout
            if i == cmd_count - 1 {
                // Last command - check for output redirect
                let mut has_redirect = false;
                for redirect in &pipeline.stdout_redirects {
                    let path = self.env.expand_variables(&redirect.target);
                    let file = match redirect.redirect_type {
                        RedirectType::StdoutOverwrite | RedirectType::BothOverwrite => {
                            File::create(&path)
                        }
                        RedirectType::StdoutAppend | RedirectType::BothAppend => {
                            OpenOptions::new().create(true).append(true).open(&path)
                        }
                        _ => continue,
                    };

                    match file {
                        Ok(f) => {
                            process.stdout(Stdio::from(f));
                            has_redirect = true;
                        }
                        Err(e) => {
                            self.write_error(&format!("csh: cannot create {}: {}\n", path, e));
                            return ExitStatus::failure(1);
                        }
                    }
                }

                if !has_redirect {
                    process.stdout(Stdio::inherit());
                }
            } else {
                // Not last - pipe to next command
                process.stdout(Stdio::piped());
            }

            process.stderr(Stdio::inherit());

            match process.spawn() {
                Ok(child) => children.push(child),
                Err(e) => {
                    self.write_error(&format!("csh: {}: {}\n", expanded_name, e));
                    return ExitStatus::failure(127);
                }
            }
        }

        // Wait for all children
        let mut last_status = ExitStatus::success();
        for mut child in children {
            match child.wait() {
                Ok(status) => {
                    last_status = ExitStatus::failure(status.code().unwrap_or(1));
                }
                Err(e) => {
                    self.write_error(&format!("csh: error waiting for process: {}\n", e));
                    last_status = ExitStatus::failure(1);
                }
            }
        }

        last_status
    }

    /// Write to stdout
    pub fn write_output(&mut self, text: &str) {
        if self.capture_output {
            self.output_buffer.extend(text.as_bytes());
        } else {
            print!("{}", text);
            let _ = io::stdout().flush();
        }
    }

    /// Write to stderr
    pub fn write_error(&self, text: &str) {
        eprint!("{}", text);
        let _ = io::stderr().flush();
    }

    /// Set capture mode and return captured output
    pub fn capture(&mut self, capture: bool) -> Vec<u8> {
        self.capture_output = capture;
        if !capture {
            std::mem::take(&mut self.output_buffer)
        } else {
            Vec::new()
        }
    }
}

impl Default for Executor {
    fn default() -> Self {
        Self::new()
    }
}
