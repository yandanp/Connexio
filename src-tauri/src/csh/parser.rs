//! Parser for CSH
//!
//! Converts tokens into an Abstract Syntax Tree (AST).

use crate::csh::ast::{Command, CommandLine, LogicalOp, Pipeline, Redirect, RedirectType};
use crate::csh::lexer::{Lexer, LexerError, Token};

/// Parser error types
#[derive(Debug, Clone)]
pub enum ParseError {
    LexerError(LexerError),
    UnexpectedToken(String),
    UnexpectedEof,
    MissingRedirectTarget,
    EmptyPipeline,
    InvalidSyntax(String),
}

impl std::fmt::Display for ParseError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ParseError::LexerError(e) => write!(f, "Lexer error: {}", e),
            ParseError::UnexpectedToken(t) => write!(f, "Unexpected token: {}", t),
            ParseError::UnexpectedEof => write!(f, "Unexpected end of input"),
            ParseError::MissingRedirectTarget => write!(f, "Missing redirection target"),
            ParseError::EmptyPipeline => write!(f, "Empty pipeline"),
            ParseError::InvalidSyntax(msg) => write!(f, "Invalid syntax: {}", msg),
        }
    }
}

impl std::error::Error for ParseError {}

impl From<LexerError> for ParseError {
    fn from(e: LexerError) -> Self {
        ParseError::LexerError(e)
    }
}

/// The parser struct
pub struct Parser<'a> {
    lexer: Lexer<'a>,
}

impl<'a> Parser<'a> {
    pub fn new(input: &'a str) -> Self {
        Self {
            lexer: Lexer::new(input),
        }
    }

    /// Parse a complete command line
    pub fn parse(&mut self) -> Result<CommandLine, ParseError> {
        self.parse_command_line()
    }

    /// Parse a command line (may contain multiple pipelines with && || ;)
    fn parse_command_line(&mut self) -> Result<CommandLine, ParseError> {
        let mut command_line = CommandLine::new();

        // Skip leading newlines
        self.skip_newlines()?;

        // Check for empty input
        if matches!(self.lexer.peek()?, Token::Eof) {
            return Ok(command_line);
        }

        // Parse first pipeline
        let first_pipeline = self.parse_pipeline()?;
        command_line.pipelines.push(first_pipeline);

        // Parse additional pipelines with operators
        loop {
            let token = self.lexer.peek()?.clone();
            match token {
                Token::And => {
                    self.lexer.next_token()?;
                    self.skip_newlines()?;
                    let pipeline = self.parse_pipeline()?;
                    command_line.pipelines.push(pipeline);
                    command_line.operators.push(LogicalOp::And);
                }
                Token::Or => {
                    self.lexer.next_token()?;
                    self.skip_newlines()?;
                    let pipeline = self.parse_pipeline()?;
                    command_line.pipelines.push(pipeline);
                    command_line.operators.push(LogicalOp::Or);
                }
                Token::Semicolon => {
                    self.lexer.next_token()?;
                    self.skip_newlines()?;
                    // Check if there's another pipeline after the semicolon
                    if !matches!(
                        self.lexer.peek()?,
                        Token::Eof | Token::Newline | Token::Semicolon
                    ) {
                        let pipeline = self.parse_pipeline()?;
                        command_line.pipelines.push(pipeline);
                        command_line.operators.push(LogicalOp::Sequence);
                    }
                }
                Token::Newline | Token::Eof => break,
                _ => break,
            }
        }

        Ok(command_line)
    }

    /// Parse a pipeline (commands connected by |)
    fn parse_pipeline(&mut self) -> Result<Pipeline, ParseError> {
        let mut commands = Vec::new();
        let mut stdin_redirect = None;
        let mut stdout_redirects = Vec::new();
        let mut background = false;

        // Parse first command
        let (cmd, mut redirects) = self.parse_command()?;
        commands.push(cmd);

        // Handle redirects from first command
        for redirect in redirects.drain(..) {
            if matches!(redirect.redirect_type, RedirectType::StdinRead) {
                stdin_redirect = Some(redirect);
            } else {
                stdout_redirects.push(redirect);
            }
        }

        // Parse pipe chain
        loop {
            let token = self.lexer.peek()?.clone();
            match token {
                Token::Pipe => {
                    self.lexer.next_token()?;
                    self.skip_newlines()?;

                    // Move stdout redirects to the last command
                    stdout_redirects.clear();

                    let (cmd, redirects) = self.parse_command()?;
                    commands.push(cmd);

                    for redirect in redirects {
                        if matches!(redirect.redirect_type, RedirectType::StdinRead) {
                            // stdin redirect in middle of pipe is an error
                            return Err(ParseError::InvalidSyntax(
                                "Cannot use < in middle of pipeline".to_string(),
                            ));
                        } else {
                            stdout_redirects.push(redirect);
                        }
                    }
                }
                Token::Background => {
                    self.lexer.next_token()?;
                    background = true;
                    break;
                }
                _ => break,
            }
        }

        Ok(Pipeline {
            commands,
            stdin_redirect,
            stdout_redirects,
            background,
        })
    }

    /// Parse a single command with its arguments and redirects
    fn parse_command(&mut self) -> Result<(Command, Vec<Redirect>), ParseError> {
        let mut name = String::new();
        let mut args = Vec::new();
        let mut redirects = Vec::new();
        let mut env_assignments = Vec::new();

        // Check for environment assignments before command
        loop {
            let token = self.lexer.peek()?.clone();
            match token {
                Token::Word(word) if word.contains('=') && name.is_empty() => {
                    self.lexer.next_token()?;
                    if let Some((var, val)) = word.split_once('=') {
                        env_assignments.push((var.to_string(), val.to_string()));
                    }
                }
                _ => break,
            }
        }

        // Parse command name and arguments
        loop {
            let token = self.lexer.peek()?.clone();
            match token {
                Token::Word(word) => {
                    self.lexer.next_token()?;
                    if name.is_empty() {
                        name = word;
                    } else {
                        args.push(word);
                    }
                }
                Token::QuotedString(s) => {
                    self.lexer.next_token()?;
                    if name.is_empty() {
                        name = s;
                    } else {
                        args.push(s);
                    }
                }
                Token::Variable(var) => {
                    self.lexer.next_token()?;
                    let var_ref = format!("${{{}}}", var);
                    if name.is_empty() {
                        name = var_ref;
                    } else {
                        args.push(var_ref);
                    }
                }
                Token::RedirectOut
                | Token::AppendOut
                | Token::RedirectIn
                | Token::RedirectErr
                | Token::AppendErr
                | Token::RedirectBoth
                | Token::AppendBoth => {
                    let redirect = self.parse_redirect()?;
                    redirects.push(redirect);
                }
                _ => break,
            }
        }

        if name.is_empty() && env_assignments.is_empty() {
            return Err(ParseError::EmptyPipeline);
        }

        // If only env assignments, treat as export
        if name.is_empty() && !env_assignments.is_empty() {
            // This is just variable assignment
            name = "export".to_string();
            for (var, val) in env_assignments {
                args.push(format!("{}={}", var, val));
            }
            return Ok((Command::with_args(name, args), redirects));
        }

        let mut cmd = Command::with_args(name, args);
        cmd.env_assignments = env_assignments;

        Ok((cmd, redirects))
    }

    /// Parse a redirection
    fn parse_redirect(&mut self) -> Result<Redirect, ParseError> {
        let token = self.lexer.next_token()?;
        let redirect_type = match token {
            Token::RedirectOut => RedirectType::StdoutOverwrite,
            Token::AppendOut => RedirectType::StdoutAppend,
            Token::RedirectIn => RedirectType::StdinRead,
            Token::RedirectErr => RedirectType::StderrOverwrite,
            Token::AppendErr => RedirectType::StderrAppend,
            Token::RedirectBoth => RedirectType::BothOverwrite,
            Token::AppendBoth => RedirectType::BothAppend,
            _ => return Err(ParseError::UnexpectedToken(format!("{:?}", token))),
        };

        // Get the target file
        let target_token = self.lexer.next_token()?;
        let target = match target_token {
            Token::Word(w) => w,
            Token::QuotedString(s) => s,
            Token::Variable(v) => format!("${{{}}}", v),
            Token::Eof => return Err(ParseError::MissingRedirectTarget),
            _ => return Err(ParseError::UnexpectedToken(format!("{:?}", target_token))),
        };

        Ok(Redirect::new(redirect_type, target))
    }

    fn skip_newlines(&mut self) -> Result<(), ParseError> {
        while matches!(self.lexer.peek()?, Token::Newline) {
            self.lexer.next_token()?;
        }
        Ok(())
    }
}

/// Convenience function to parse a command line
pub fn parse(input: &str) -> Result<CommandLine, ParseError> {
    let mut parser = Parser::new(input);
    parser.parse()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_simple_command() {
        let cmd_line = parse("ls -la").unwrap();
        assert_eq!(cmd_line.pipelines.len(), 1);
        assert_eq!(cmd_line.pipelines[0].commands.len(), 1);
        assert_eq!(cmd_line.pipelines[0].commands[0].name, "ls");
        assert_eq!(cmd_line.pipelines[0].commands[0].args, vec!["-la"]);
    }

    #[test]
    fn test_pipeline() {
        let cmd_line = parse("ls | grep foo | wc -l").unwrap();
        assert_eq!(cmd_line.pipelines.len(), 1);
        assert_eq!(cmd_line.pipelines[0].commands.len(), 3);
        assert_eq!(cmd_line.pipelines[0].commands[0].name, "ls");
        assert_eq!(cmd_line.pipelines[0].commands[1].name, "grep");
        assert_eq!(cmd_line.pipelines[0].commands[2].name, "wc");
    }

    #[test]
    fn test_redirect() {
        let cmd_line = parse("echo hello > output.txt").unwrap();
        assert_eq!(cmd_line.pipelines[0].stdout_redirects.len(), 1);
        assert_eq!(
            cmd_line.pipelines[0].stdout_redirects[0].redirect_type,
            RedirectType::StdoutOverwrite
        );
        assert_eq!(
            cmd_line.pipelines[0].stdout_redirects[0].target,
            "output.txt"
        );
    }

    #[test]
    fn test_logical_operators() {
        let cmd_line = parse("cmd1 && cmd2 || cmd3").unwrap();
        assert_eq!(cmd_line.pipelines.len(), 3);
        assert_eq!(cmd_line.operators.len(), 2);
        assert_eq!(cmd_line.operators[0], LogicalOp::And);
        assert_eq!(cmd_line.operators[1], LogicalOp::Or);
    }

    #[test]
    fn test_background() {
        let cmd_line = parse("sleep 10 &").unwrap();
        assert!(cmd_line.pipelines[0].background);
    }
}
