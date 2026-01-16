//! Lexer/Tokenizer for CSH
//!
//! Converts raw input text into a stream of tokens.

use std::iter::Peekable;
use std::str::Chars;

/// Token types for the shell language
#[derive(Debug, Clone, PartialEq)]
pub enum Token {
    /// A word (command name, argument, etc.)
    Word(String),
    /// A quoted string (preserves spaces)
    QuotedString(String),
    /// Environment variable reference ($VAR or ${VAR})
    Variable(String),
    /// Pipe operator |
    Pipe,
    /// And operator &&
    And,
    /// Or operator ||
    Or,
    /// Semicolon ;
    Semicolon,
    /// Newline
    Newline,
    /// Output redirect >
    RedirectOut,
    /// Append redirect >>
    AppendOut,
    /// Input redirect <
    RedirectIn,
    /// Stderr redirect 2>
    RedirectErr,
    /// Stderr append 2>>
    AppendErr,
    /// Both redirect &>
    RedirectBoth,
    /// Both append &>>
    AppendBoth,
    /// Background operator &
    Background,
    /// Equals sign for assignment =
    Equals,
    /// Left parenthesis (
    LeftParen,
    /// Right parenthesis )
    RightParen,
    /// Left brace {
    LeftBrace,
    /// Right brace }
    RightBrace,
    /// Comment (starts with #)
    Comment(String),
    /// End of input
    Eof,
}

/// Lexer error types
#[derive(Debug, Clone, PartialEq)]
pub enum LexerError {
    UnterminatedString(char),
    UnterminatedVariable,
    InvalidEscape(char),
    UnexpectedChar(char),
}

impl std::fmt::Display for LexerError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            LexerError::UnterminatedString(quote) => {
                write!(f, "Unterminated string starting with {}", quote)
            }
            LexerError::UnterminatedVariable => write!(f, "Unterminated variable reference"),
            LexerError::InvalidEscape(c) => write!(f, "Invalid escape sequence: \\{}", c),
            LexerError::UnexpectedChar(c) => write!(f, "Unexpected character: {}", c),
        }
    }
}

impl std::error::Error for LexerError {}

/// The lexer struct
pub struct Lexer<'a> {
    input: Peekable<Chars<'a>>,
    current_pos: usize,
    peeked_token: Option<Token>,
}

impl<'a> Lexer<'a> {
    pub fn new(input: &'a str) -> Self {
        Self {
            input: input.chars().peekable(),
            current_pos: 0,
            peeked_token: None,
        }
    }

    /// Peek at the next token without consuming it
    pub fn peek(&mut self) -> Result<&Token, LexerError> {
        if self.peeked_token.is_none() {
            self.peeked_token = Some(self.next_token()?);
        }
        Ok(self.peeked_token.as_ref().unwrap())
    }

    /// Get the next token
    pub fn next_token(&mut self) -> Result<Token, LexerError> {
        // Return peeked token if available
        if let Some(token) = self.peeked_token.take() {
            return Ok(token);
        }

        self.skip_whitespace();

        match self.input.peek().copied() {
            None => Ok(Token::Eof),
            Some('\n') => {
                self.advance();
                Ok(Token::Newline)
            }
            Some('#') => {
                // Comment - consume until end of line
                self.advance();
                let comment = self.consume_until_newline();
                Ok(Token::Comment(comment))
            }
            Some('|') => {
                self.advance();
                if self.input.peek() == Some(&'|') {
                    self.advance();
                    Ok(Token::Or)
                } else {
                    Ok(Token::Pipe)
                }
            }
            Some('&') => {
                self.advance();
                match self.input.peek() {
                    Some(&'&') => {
                        self.advance();
                        Ok(Token::And)
                    }
                    Some(&'>') => {
                        self.advance();
                        if self.input.peek() == Some(&'>') {
                            self.advance();
                            Ok(Token::AppendBoth)
                        } else {
                            Ok(Token::RedirectBoth)
                        }
                    }
                    _ => Ok(Token::Background),
                }
            }
            Some(';') => {
                self.advance();
                Ok(Token::Semicolon)
            }
            Some('>') => {
                self.advance();
                if self.input.peek() == Some(&'>') {
                    self.advance();
                    Ok(Token::AppendOut)
                } else {
                    Ok(Token::RedirectOut)
                }
            }
            Some('<') => {
                self.advance();
                Ok(Token::RedirectIn)
            }
            Some('2') => {
                // Check for 2> or 2>>
                let mut chars = self.input.clone();
                chars.next(); // consume '2'
                if chars.peek() == Some(&'>') {
                    self.advance(); // consume '2'
                    self.advance(); // consume '>'
                    if self.input.peek() == Some(&'>') {
                        self.advance();
                        Ok(Token::AppendErr)
                    } else {
                        Ok(Token::RedirectErr)
                    }
                } else {
                    self.read_word()
                }
            }
            Some('=') => {
                self.advance();
                Ok(Token::Equals)
            }
            Some('(') => {
                self.advance();
                Ok(Token::LeftParen)
            }
            Some(')') => {
                self.advance();
                Ok(Token::RightParen)
            }
            Some('{') => {
                self.advance();
                Ok(Token::LeftBrace)
            }
            Some('}') => {
                self.advance();
                Ok(Token::RightBrace)
            }
            Some('\'') => self.read_single_quoted_string(),
            Some('"') => self.read_double_quoted_string(),
            Some('$') => self.read_variable(),
            Some(_) => self.read_word(),
        }
    }

    /// Tokenize the entire input
    pub fn tokenize(&mut self) -> Result<Vec<Token>, LexerError> {
        let mut tokens = Vec::new();
        loop {
            let token = self.next_token()?;
            if token == Token::Eof {
                tokens.push(token);
                break;
            }
            tokens.push(token);
        }
        Ok(tokens)
    }

    fn advance(&mut self) -> Option<char> {
        self.current_pos += 1;
        self.input.next()
    }

    fn skip_whitespace(&mut self) {
        while let Some(&c) = self.input.peek() {
            if c == ' ' || c == '\t' || c == '\r' {
                self.advance();
            } else {
                break;
            }
        }
    }

    fn consume_until_newline(&mut self) -> String {
        let mut result = String::new();
        while let Some(&c) = self.input.peek() {
            if c == '\n' {
                break;
            }
            result.push(self.advance().unwrap());
        }
        result
    }

    fn read_single_quoted_string(&mut self) -> Result<Token, LexerError> {
        self.advance(); // consume opening quote
        let mut result = String::new();

        loop {
            match self.input.peek().copied() {
                None => return Err(LexerError::UnterminatedString('\'')),
                Some('\'') => {
                    self.advance();
                    break;
                }
                Some(c) => {
                    result.push(c);
                    self.advance();
                }
            }
        }

        Ok(Token::QuotedString(result))
    }

    fn read_double_quoted_string(&mut self) -> Result<Token, LexerError> {
        self.advance(); // consume opening quote
        let mut result = String::new();

        loop {
            match self.input.peek().copied() {
                None => return Err(LexerError::UnterminatedString('"')),
                Some('"') => {
                    self.advance();
                    break;
                }
                Some('\\') => {
                    self.advance();
                    match self.input.peek().copied() {
                        None => return Err(LexerError::UnterminatedString('"')),
                        Some('n') => {
                            result.push('\n');
                            self.advance();
                        }
                        Some('t') => {
                            result.push('\t');
                            self.advance();
                        }
                        Some('r') => {
                            result.push('\r');
                            self.advance();
                        }
                        Some('\\') => {
                            result.push('\\');
                            self.advance();
                        }
                        Some('"') => {
                            result.push('"');
                            self.advance();
                        }
                        Some('$') => {
                            result.push('$');
                            self.advance();
                        }
                        Some(c) => {
                            // Unknown escape, preserve as-is
                            result.push('\\');
                            result.push(c);
                            self.advance();
                        }
                    }
                }
                Some('$') => {
                    // Variable expansion in double quotes
                    let var_token = self.read_variable()?;
                    if let Token::Variable(var) = var_token {
                        result.push_str(&format!("${{{}}}", var));
                    }
                }
                Some(c) => {
                    result.push(c);
                    self.advance();
                }
            }
        }

        Ok(Token::QuotedString(result))
    }

    fn read_variable(&mut self) -> Result<Token, LexerError> {
        self.advance(); // consume $

        let mut var_name = String::new();

        match self.input.peek().copied() {
            Some('{') => {
                // ${VAR} syntax
                self.advance();
                loop {
                    match self.input.peek().copied() {
                        None => return Err(LexerError::UnterminatedVariable),
                        Some('}') => {
                            self.advance();
                            break;
                        }
                        Some(c) => {
                            var_name.push(c);
                            self.advance();
                        }
                    }
                }
            }
            Some(c) if c.is_alphabetic() || c == '_' => {
                // $VAR syntax
                while let Some(&c) = self.input.peek() {
                    if c.is_alphanumeric() || c == '_' {
                        var_name.push(c);
                        self.advance();
                    } else {
                        break;
                    }
                }
            }
            Some('?') => {
                // $? - last exit code
                self.advance();
                var_name.push('?');
            }
            Some('$') => {
                // $$ - current PID
                self.advance();
                var_name.push('$');
            }
            Some('0'..='9') => {
                // $0-$9 - positional parameters
                var_name.push(self.advance().unwrap());
            }
            _ => {
                // Just a literal $
                return Ok(Token::Word("$".to_string()));
            }
        }

        Ok(Token::Variable(var_name))
    }

    fn read_word(&mut self) -> Result<Token, LexerError> {
        let mut word = String::new();

        while let Some(&c) = self.input.peek() {
            match c {
                // Word terminators
                ' ' | '\t' | '\r' | '\n' | '|' | '&' | ';' | '>' | '<' | '(' | ')' | '{' | '}'
                | '#' => break,
                // Handle escape sequences
                '\\' => {
                    self.advance();
                    if let Some(&next) = self.input.peek() {
                        word.push(next);
                        self.advance();
                    }
                }
                // Handle quotes within words
                '\'' | '"' => {
                    let quoted = if c == '\'' {
                        self.read_single_quoted_string()?
                    } else {
                        self.read_double_quoted_string()?
                    };
                    if let Token::QuotedString(s) = quoted {
                        word.push_str(&s);
                    }
                }
                // Handle variables within words
                '$' => {
                    let var = self.read_variable()?;
                    match var {
                        Token::Variable(v) => word.push_str(&format!("${{{}}}", v)),
                        Token::Word(w) => word.push_str(&w),
                        _ => {}
                    }
                }
                _ => {
                    word.push(c);
                    self.advance();
                }
            }
        }

        Ok(Token::Word(word))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_simple_command() {
        let mut lexer = Lexer::new("ls -la");
        let tokens = lexer.tokenize().unwrap();
        assert_eq!(
            tokens,
            vec![
                Token::Word("ls".to_string()),
                Token::Word("-la".to_string()),
                Token::Eof,
            ]
        );
    }

    #[test]
    fn test_pipe() {
        let mut lexer = Lexer::new("ls | grep foo");
        let tokens = lexer.tokenize().unwrap();
        assert_eq!(
            tokens,
            vec![
                Token::Word("ls".to_string()),
                Token::Pipe,
                Token::Word("grep".to_string()),
                Token::Word("foo".to_string()),
                Token::Eof,
            ]
        );
    }

    #[test]
    fn test_redirect() {
        let mut lexer = Lexer::new("echo hello > file.txt");
        let tokens = lexer.tokenize().unwrap();
        assert_eq!(
            tokens,
            vec![
                Token::Word("echo".to_string()),
                Token::Word("hello".to_string()),
                Token::RedirectOut,
                Token::Word("file.txt".to_string()),
                Token::Eof,
            ]
        );
    }

    #[test]
    fn test_quoted_string() {
        let mut lexer = Lexer::new("echo 'hello world'");
        let tokens = lexer.tokenize().unwrap();
        assert_eq!(
            tokens,
            vec![
                Token::Word("echo".to_string()),
                Token::QuotedString("hello world".to_string()),
                Token::Eof,
            ]
        );
    }

    #[test]
    fn test_variable() {
        let mut lexer = Lexer::new("echo $HOME");
        let tokens = lexer.tokenize().unwrap();
        assert_eq!(
            tokens,
            vec![
                Token::Word("echo".to_string()),
                Token::Variable("HOME".to_string()),
                Token::Eof,
            ]
        );
    }

    #[test]
    fn test_logical_operators() {
        let mut lexer = Lexer::new("cmd1 && cmd2 || cmd3");
        let tokens = lexer.tokenize().unwrap();
        assert_eq!(
            tokens,
            vec![
                Token::Word("cmd1".to_string()),
                Token::And,
                Token::Word("cmd2".to_string()),
                Token::Or,
                Token::Word("cmd3".to_string()),
                Token::Eof,
            ]
        );
    }
}
