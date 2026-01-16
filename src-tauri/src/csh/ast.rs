//! AST (Abstract Syntax Tree) definitions for CSH
//!
//! Defines the structure of parsed commands, pipelines, and redirections.

use std::fmt;

/// Represents a single command with its arguments
#[derive(Debug, Clone, PartialEq)]
pub struct Command {
    /// The command name or path
    pub name: String,
    /// Command arguments
    pub args: Vec<String>,
    /// Environment variable assignments for this command only
    pub env_assignments: Vec<(String, String)>,
}

impl Command {
    pub fn new(name: String) -> Self {
        Self {
            name,
            args: Vec::new(),
            env_assignments: Vec::new(),
        }
    }

    pub fn with_args(name: String, args: Vec<String>) -> Self {
        Self {
            name,
            args,
            env_assignments: Vec::new(),
        }
    }
}

impl fmt::Display for Command {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}", self.name)?;
        for arg in &self.args {
            write!(f, " {}", arg)?;
        }
        Ok(())
    }
}

/// Type of I/O redirection
#[derive(Debug, Clone, PartialEq)]
pub enum RedirectType {
    /// > file (overwrite stdout)
    StdoutOverwrite,
    /// >> file (append stdout)
    StdoutAppend,
    /// < file (read stdin)
    StdinRead,
    /// 2> file (redirect stderr)
    StderrOverwrite,
    /// 2>> file (append stderr)
    StderrAppend,
    /// &> file (redirect both stdout and stderr)
    BothOverwrite,
    /// &>> file (append both stdout and stderr)
    BothAppend,
}

/// I/O redirection specification
#[derive(Debug, Clone, PartialEq)]
pub struct Redirect {
    pub redirect_type: RedirectType,
    pub target: String,
}

impl Redirect {
    pub fn new(redirect_type: RedirectType, target: String) -> Self {
        Self {
            redirect_type,
            target,
        }
    }
}

/// A pipeline of commands connected by pipes
#[derive(Debug, Clone, PartialEq)]
pub struct Pipeline {
    /// Commands in the pipeline (executed left to right)
    pub commands: Vec<Command>,
    /// Input redirection (applies to first command)
    pub stdin_redirect: Option<Redirect>,
    /// Output redirections (applies to last command)
    pub stdout_redirects: Vec<Redirect>,
    /// Whether to run in background
    pub background: bool,
}

impl Pipeline {
    pub fn new(commands: Vec<Command>) -> Self {
        Self {
            commands,
            stdin_redirect: None,
            stdout_redirects: Vec::new(),
            background: false,
        }
    }

    pub fn single(command: Command) -> Self {
        Self::new(vec![command])
    }
}

/// Logical operators for combining pipelines
#[derive(Debug, Clone, PartialEq)]
pub enum LogicalOp {
    /// && - run next only if previous succeeded
    And,
    /// || - run next only if previous failed
    Or,
    /// ; - run next regardless
    Sequence,
}

/// A complete command line that may contain multiple pipelines
#[derive(Debug, Clone, PartialEq)]
pub struct CommandLine {
    /// Pipelines and their connecting operators
    pub pipelines: Vec<Pipeline>,
    pub operators: Vec<LogicalOp>,
}

impl CommandLine {
    pub fn new() -> Self {
        Self {
            pipelines: Vec::new(),
            operators: Vec::new(),
        }
    }

    pub fn single(pipeline: Pipeline) -> Self {
        Self {
            pipelines: vec![pipeline],
            operators: Vec::new(),
        }
    }

    pub fn add_pipeline(&mut self, pipeline: Pipeline, op: Option<LogicalOp>) {
        self.pipelines.push(pipeline);
        if let Some(op) = op {
            self.operators.push(op);
        }
    }

    pub fn is_empty(&self) -> bool {
        self.pipelines.is_empty()
    }
}

impl Default for CommandLine {
    fn default() -> Self {
        Self::new()
    }
}

/// Control flow statements for scripting
#[derive(Debug, Clone, PartialEq)]
pub enum Statement {
    /// A simple command line
    CommandLine(CommandLine),
    /// if condition; then commands; [elif condition; then commands;] [else commands;] fi
    If {
        condition: Box<CommandLine>,
        then_branch: Vec<Statement>,
        elif_branches: Vec<(Box<CommandLine>, Vec<Statement>)>,
        else_branch: Option<Vec<Statement>>,
    },
    /// while condition; do commands; done
    While {
        condition: Box<CommandLine>,
        body: Vec<Statement>,
    },
    /// for var in items; do commands; done
    For {
        variable: String,
        items: Vec<String>,
        body: Vec<Statement>,
    },
    /// Function definition
    Function {
        name: String,
        body: Vec<Statement>,
    },
    /// Return from function
    Return(Option<i32>),
    /// Break from loop
    Break,
    /// Continue loop
    Continue,
}

/// Result of command execution
#[derive(Debug, Clone)]
pub struct ExitStatus {
    pub code: i32,
    pub signal: Option<i32>,
}

impl ExitStatus {
    pub fn success() -> Self {
        Self { code: 0, signal: None }
    }

    pub fn failure(code: i32) -> Self {
        Self { code, signal: None }
    }

    pub fn is_success(&self) -> bool {
        self.code == 0
    }
}
