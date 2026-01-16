//! I/O redirection handling for CSH

use std::fs::{File, OpenOptions};
use std::io::{self, Read};
use std::path::Path;

use crate::csh::ast::{Redirect, RedirectType};

/// Manages I/O redirection for a command
pub struct RedirectManager;

impl RedirectManager {
    pub fn new() -> Self {
        Self
    }

    /// Open a file for output redirection
    pub fn open_output(path: &Path, append: bool) -> io::Result<File> {
        if append {
            OpenOptions::new()
                .create(true)
                .append(true)
                .open(path)
        } else {
            File::create(path)
        }
    }

    /// Open a file for input redirection
    pub fn open_input(path: &Path) -> io::Result<File> {
        File::open(path)
    }

    /// Apply a redirect and return the file handle
    pub fn apply_redirect(redirect: &Redirect) -> io::Result<File> {
        let path = Path::new(&redirect.target);

        match redirect.redirect_type {
            RedirectType::StdoutOverwrite | RedirectType::BothOverwrite => {
                Self::open_output(path, false)
            }
            RedirectType::StdoutAppend | RedirectType::BothAppend => {
                Self::open_output(path, true)
            }
            RedirectType::StdinRead => Self::open_input(path),
            RedirectType::StderrOverwrite => Self::open_output(path, false),
            RedirectType::StderrAppend => Self::open_output(path, true),
        }
    }
}

impl Default for RedirectManager {
    fn default() -> Self {
        Self::new()
    }
}

/// Here document support (<<EOF ... EOF)
pub struct HereDoc {
    content: String,
    delimiter: String,
}

impl HereDoc {
    pub fn new(delimiter: String) -> Self {
        Self {
            content: String::new(),
            delimiter,
        }
    }

    pub fn add_line(&mut self, line: &str) -> bool {
        if line.trim() == self.delimiter {
            return true; // End of here doc
        }
        self.content.push_str(line);
        self.content.push('\n');
        false
    }

    pub fn content(&self) -> &str {
        &self.content
    }

    pub fn into_content(self) -> String {
        self.content
    }
}

/// Here string support (<<<)
pub struct HereString {
    content: String,
}

impl HereString {
    pub fn new(content: String) -> Self {
        Self { content }
    }

    pub fn content(&self) -> &str {
        &self.content
    }
}

impl Read for HereString {
    fn read(&mut self, buf: &mut [u8]) -> io::Result<usize> {
        let bytes = self.content.as_bytes();
        let to_read = std::cmp::min(buf.len(), bytes.len());
        buf[..to_read].copy_from_slice(&bytes[..to_read]);
        self.content = self.content[to_read..].to_string();
        Ok(to_read)
    }
}
