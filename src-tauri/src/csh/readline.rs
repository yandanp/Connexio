//! Readline - Interactive line editing with completion support
//!
//! This module provides a readline-like interface for CSH with:
//! - Tab completion for commands and paths
//! - History navigation (Up/Down arrows)
//! - Cursor movement (Left/Right/Home/End)
//! - Line editing (Backspace, Delete, Ctrl+U, Ctrl+K)
//! - Ctrl+C to cancel, Ctrl+D for EOF
//!
//! Works both in standalone mode and inside PTY (ConPTY on Windows).

use std::io::{self, Read, Stdout, Write};

use crate::csh::completion::{Completer, Completion};
use crate::csh::environment::Environment;
use crate::csh::history::History;

/// Result of a readline operation
#[derive(Debug)]
pub enum ReadlineResult {
    /// User entered a line
    Line(String),
    /// User pressed Ctrl+C (cancel)
    Interrupted,
    /// User pressed Ctrl+D on empty line (EOF)
    Eof,
}

/// Escape sequence parser state
#[derive(Debug, Clone, PartialEq)]
enum EscapeState {
    Normal,
    Escape,      // Got ESC
    Csi,         // Got ESC [
    CsiParam,    // Got ESC [ with parameters
}

/// Line editor state
pub struct LineEditor {
    /// Current line buffer
    buffer: String,
    /// Cursor position in buffer (character index)
    cursor: usize,
    /// History index (-1 = current input)
    history_index: i32,
    /// Saved current input when browsing history
    saved_input: String,
    /// Completions cache
    completions: Vec<Completion>,
    /// Current completion index (for cycling)
    completion_index: usize,
    /// Whether we're in completion mode
    in_completion: bool,
    /// Prompt string (for re-rendering)
    prompt: String,
    /// Escape sequence state
    escape_state: EscapeState,
    /// Escape sequence parameter buffer
    escape_params: String,
    /// Whether user has typed anything (to avoid redraw on initial resize)
    has_input: bool,
}

impl LineEditor {
    pub fn new() -> Self {
        Self {
            buffer: String::new(),
            cursor: 0,
            history_index: -1,
            saved_input: String::new(),
            completions: Vec::new(),
            completion_index: 0,
            in_completion: false,
            prompt: String::new(),
            escape_state: EscapeState::Normal,
            escape_params: String::new(),
            has_input: false,
        }
    }

    /// Read a line with the given prompt
    pub fn readline(
        &mut self,
        prompt: &str,
        history: &History,
        completer: &Completer,
        env: &Environment,
    ) -> io::Result<ReadlineResult> {
        // Store prompt info
        self.prompt = prompt.to_string();

        // Reset state
        self.buffer.clear();
        self.cursor = 0;
        self.history_index = -1;
        self.saved_input.clear();
        self.completions.clear();
        self.in_completion = false;
        self.escape_state = EscapeState::Normal;
        self.escape_params.clear();
        self.has_input = false;

        // Print prompt
        let mut stdout = io::stdout();
        write!(stdout, "{}", prompt)?;
        stdout.flush()?;

        // Enable raw mode using crossterm
        // This works for both real terminals and ConPTY
        let raw_mode_result = crossterm::terminal::enable_raw_mode();
        
        let result = match raw_mode_result {
            Ok(_) => {
                // Raw mode enabled successfully - use crossterm events
                let res = self.read_loop_crossterm(&mut stdout, history, completer, env);
                let _ = crossterm::terminal::disable_raw_mode();
                res
            }
            Err(_) => {
                // Raw mode failed - try raw byte reading
                self.read_loop_raw(&mut stdout, history, completer, env)
            }
        };

        // Print newline after input
        println!();

        result
    }

    /// Read loop using crossterm events
    fn read_loop_crossterm(
        &mut self,
        stdout: &mut Stdout,
        history: &History,
        completer: &Completer,
        env: &Environment,
    ) -> io::Result<ReadlineResult> {
        use crossterm::event::{self, Event, KeyCode, KeyEvent, KeyModifiers, KeyEventKind};

        loop {
            // Poll for events with a timeout
            if event::poll(std::time::Duration::from_millis(100))? {
                let event = event::read()?;

                match event {
                    Event::Key(KeyEvent {
                        code,
                        modifiers,
                        kind: KeyEventKind::Press, // Only handle Press events, ignore Release
                        ..
                    }) => {
                        // Handle Ctrl combinations first
                        if modifiers.contains(KeyModifiers::CONTROL) {
                            match code {
                                KeyCode::Char('c') => {
                                    write!(stdout, "^C")?;
                                    stdout.flush()?;
                                    return Ok(ReadlineResult::Interrupted);
                                }
                                KeyCode::Char('d') => {
                                    if self.buffer.is_empty() {
                                        return Ok(ReadlineResult::Eof);
                                    } else {
                                        self.delete_char(stdout)?;
                                    }
                                }
                                KeyCode::Char('l') => {
                                    self.clear_screen(stdout)?;
                                }
                                KeyCode::Char('u') => {
                                    self.delete_to_start(stdout)?;
                                }
                                KeyCode::Char('k') => {
                                    self.delete_to_end(stdout)?;
                                }
                                KeyCode::Char('a') => {
                                    self.move_to_start(stdout)?;
                                }
                                KeyCode::Char('e') => {
                                    self.move_to_end(stdout)?;
                                }
                                KeyCode::Char('w') => {
                                    self.delete_word_backward(stdout)?;
                                }
                                _ => {}
                            }
                            continue;
                        }

                        // Reset completion mode on non-Tab key
                        if code != KeyCode::Tab {
                            self.in_completion = false;
                            self.completions.clear(); // Clear old completions
                        }

                        match code {
                            KeyCode::Enter => {
                                return Ok(ReadlineResult::Line(self.buffer.clone()));
                            }
                            KeyCode::Tab => {
                                self.handle_tab(stdout, completer, env)?;
                            }
                            KeyCode::Backspace => {
                                self.delete_char_backward(stdout)?;
                            }
                            KeyCode::Delete => {
                                self.delete_char(stdout)?;
                            }
                            KeyCode::Left => {
                                self.move_left(stdout)?;
                            }
                            KeyCode::Right => {
                                self.move_right(stdout)?;
                            }
                            KeyCode::Up => {
                                self.history_prev(stdout, history)?;
                            }
                            KeyCode::Down => {
                                self.history_next(stdout, history)?;
                            }
                            KeyCode::Home => {
                                self.move_to_start(stdout)?;
                            }
                            KeyCode::End => {
                                self.move_to_end(stdout)?;
                            }
                            KeyCode::Char(c) => {
                                self.has_input = true;
                                self.insert_char(c, stdout)?;
                            }
                            _ => {}
                        }
                    }
                    Event::Key(_) => {
                        // Ignore key release and repeat events
                    }
                    Event::Resize(_, _) => {
                        // Only redraw on resize if user has typed something
                        // This avoids duplicate prompts on initial terminal setup
                        if self.has_input {
                            self.redraw_line(stdout)?;
                        }
                    }
                    _ => {}
                }
            }
        }
    }

    /// Read loop using raw byte reading (fallback)
    fn read_loop_raw(
        &mut self,
        stdout: &mut Stdout,
        history: &History,
        completer: &Completer,
        env: &Environment,
    ) -> io::Result<ReadlineResult> {
        let stdin = io::stdin();
        let mut stdin = stdin.lock();
        let mut buf = [0u8; 1];

        loop {
            if stdin.read(&mut buf)? == 0 {
                return Ok(ReadlineResult::Eof);
            }

            let byte = buf[0];

            // Handle escape sequences
            match self.escape_state {
                EscapeState::Normal => {
                    match byte {
                        0x1B => {
                            self.escape_state = EscapeState::Escape;
                            self.escape_params.clear();
                        }
                        0x03 => {
                            write!(stdout, "^C")?;
                            stdout.flush()?;
                            return Ok(ReadlineResult::Interrupted);
                        }
                        0x04 => {
                            if self.buffer.is_empty() {
                                return Ok(ReadlineResult::Eof);
                            } else {
                                self.delete_char(stdout)?;
                            }
                        }
                        0x09 => {
                            self.handle_tab(stdout, completer, env)?;
                        }
                        0x0D | 0x0A => {
                            return Ok(ReadlineResult::Line(self.buffer.clone()));
                        }
                        0x7F | 0x08 => {
                            self.in_completion = false;
                            self.delete_char_backward(stdout)?;
                        }
                        0x01 => self.move_to_start(stdout)?,
                        0x05 => self.move_to_end(stdout)?,
                        0x0B => self.delete_to_end(stdout)?,
                        0x15 => self.delete_to_start(stdout)?,
                        0x17 => self.delete_word_backward(stdout)?,
                        0x0C => self.clear_screen(stdout)?,
                        0x20..=0x7E => {
                            self.in_completion = false;
                            self.insert_char(byte as char, stdout)?;
                        }
                        _ => {
                            if byte >= 0xC0 {
                                self.in_completion = false;
                                let char_result = self.read_utf8_char(&mut stdin, byte)?;
                                if let Some(c) = char_result {
                                    self.insert_char(c, stdout)?;
                                }
                            }
                        }
                    }
                }
                EscapeState::Escape => {
                    match byte {
                        b'[' | b'O' => {
                            self.escape_state = EscapeState::Csi;
                        }
                        _ => {
                            self.escape_state = EscapeState::Normal;
                        }
                    }
                }
                EscapeState::Csi | EscapeState::CsiParam => {
                    match byte {
                        b'0'..=b'9' | b';' => {
                            self.escape_params.push(byte as char);
                            self.escape_state = EscapeState::CsiParam;
                        }
                        b'A' => {
                            self.escape_state = EscapeState::Normal;
                            self.in_completion = false;
                            self.history_prev(stdout, history)?;
                        }
                        b'B' => {
                            self.escape_state = EscapeState::Normal;
                            self.in_completion = false;
                            self.history_next(stdout, history)?;
                        }
                        b'C' => {
                            self.escape_state = EscapeState::Normal;
                            self.move_right(stdout)?;
                        }
                        b'D' => {
                            self.escape_state = EscapeState::Normal;
                            self.move_left(stdout)?;
                        }
                        b'H' => {
                            self.escape_state = EscapeState::Normal;
                            self.move_to_start(stdout)?;
                        }
                        b'F' => {
                            self.escape_state = EscapeState::Normal;
                            self.move_to_end(stdout)?;
                        }
                        b'~' => {
                            self.escape_state = EscapeState::Normal;
                            match self.escape_params.as_str() {
                                "1" | "7" => self.move_to_start(stdout)?,
                                "4" | "8" => self.move_to_end(stdout)?,
                                "3" => self.delete_char(stdout)?,
                                _ => {}
                            }
                        }
                        _ => {
                            self.escape_state = EscapeState::Normal;
                        }
                    }
                }
            }
        }
    }

    /// Read a multi-byte UTF-8 character
    fn read_utf8_char<R: Read>(&self, reader: &mut R, first_byte: u8) -> io::Result<Option<char>> {
        let width = if first_byte & 0xE0 == 0xC0 { 2 }
        else if first_byte & 0xF0 == 0xE0 { 3 }
        else if first_byte & 0xF8 == 0xF0 { 4 }
        else { return Ok(None); };

        let mut bytes = vec![first_byte];
        for _ in 1..width {
            let mut buf = [0u8; 1];
            if reader.read(&mut buf)? == 0 {
                return Ok(None);
            }
            bytes.push(buf[0]);
        }

        Ok(String::from_utf8(bytes).ok().and_then(|s| s.chars().next()))
    }

    /// Insert a character at cursor position
    fn insert_char(&mut self, c: char, stdout: &mut Stdout) -> io::Result<()> {
        let byte_pos = self.cursor_to_byte_pos();
        self.buffer.insert(byte_pos, c);
        self.cursor += 1;

        if self.cursor == self.buffer.chars().count() {
            write!(stdout, "{}", c)?;
        } else {
            self.redraw_from_cursor(stdout)?;
        }

        stdout.flush()?;
        Ok(())
    }

    fn cursor_to_byte_pos(&self) -> usize {
        self.buffer.char_indices().nth(self.cursor).map(|(i, _)| i).unwrap_or(self.buffer.len())
    }

    fn delete_char_backward(&mut self, stdout: &mut Stdout) -> io::Result<()> {
        if self.cursor == 0 { return Ok(()); }

        self.cursor -= 1;
        let byte_pos = self.cursor_to_byte_pos();
        self.buffer.remove(byte_pos);

        write!(stdout, "\x1b[D")?;
        self.redraw_from_cursor(stdout)?;
        Ok(())
    }

    fn delete_char(&mut self, stdout: &mut Stdout) -> io::Result<()> {
        let char_count = self.buffer.chars().count();
        if self.cursor >= char_count { return Ok(()); }

        let byte_pos = self.cursor_to_byte_pos();
        self.buffer.remove(byte_pos);
        self.redraw_from_cursor(stdout)?;
        Ok(())
    }

    fn delete_to_start(&mut self, stdout: &mut Stdout) -> io::Result<()> {
        if self.cursor == 0 { return Ok(()); }

        let byte_pos = self.cursor_to_byte_pos();
        self.buffer = self.buffer[byte_pos..].to_string();
        self.cursor = 0;
        self.redraw_line(stdout)?;
        Ok(())
    }

    fn delete_to_end(&mut self, stdout: &mut Stdout) -> io::Result<()> {
        let char_count = self.buffer.chars().count();
        if self.cursor >= char_count { return Ok(()); }

        let byte_pos = self.cursor_to_byte_pos();
        self.buffer.truncate(byte_pos);
        write!(stdout, "\x1b[K")?;
        stdout.flush()?;
        Ok(())
    }

    fn delete_word_backward(&mut self, stdout: &mut Stdout) -> io::Result<()> {
        if self.cursor == 0 { return Ok(()); }

        let byte_pos = self.cursor_to_byte_pos();
        let before = &self.buffer[..byte_pos];
        let end = before.trim_end().len();
        let start = before[..end].rfind(|c: char| c.is_whitespace()).map(|i| i + 1).unwrap_or(0);
        let chars_removed = before[start..].chars().count();
        
        self.buffer = format!("{}{}", &self.buffer[..start], &self.buffer[byte_pos..]);
        self.cursor -= chars_removed;
        self.redraw_line(stdout)?;
        Ok(())
    }

    fn move_left(&mut self, stdout: &mut Stdout) -> io::Result<()> {
        if self.cursor == 0 { return Ok(()); }
        self.cursor -= 1;
        write!(stdout, "\x1b[D")?;
        stdout.flush()?;
        Ok(())
    }

    fn move_right(&mut self, stdout: &mut Stdout) -> io::Result<()> {
        let char_count = self.buffer.chars().count();
        if self.cursor >= char_count { return Ok(()); }
        self.cursor += 1;
        write!(stdout, "\x1b[C")?;
        stdout.flush()?;
        Ok(())
    }

    fn move_to_start(&mut self, stdout: &mut Stdout) -> io::Result<()> {
        if self.cursor > 0 {
            write!(stdout, "\x1b[{}D", self.cursor)?;
            self.cursor = 0;
            stdout.flush()?;
        }
        Ok(())
    }

    fn move_to_end(&mut self, stdout: &mut Stdout) -> io::Result<()> {
        let char_count = self.buffer.chars().count();
        let move_by = char_count - self.cursor;
        if move_by > 0 {
            write!(stdout, "\x1b[{}C", move_by)?;
            self.cursor = char_count;
            stdout.flush()?;
        }
        Ok(())
    }

    fn history_prev(&mut self, stdout: &mut Stdout, history: &History) -> io::Result<()> {
        let history_len = history.len() as i32;
        if history_len == 0 { return Ok(()); }

        if self.history_index == -1 {
            self.saved_input = self.buffer.clone();
        }

        if self.history_index < history_len - 1 {
            self.history_index += 1;
            if let Some(entry) = history.get(history.len() - 1 - self.history_index as usize) {
                self.buffer = entry.clone();
                self.cursor = self.buffer.chars().count();
                self.redraw_line(stdout)?;
            }
        }
        Ok(())
    }

    fn history_next(&mut self, stdout: &mut Stdout, history: &History) -> io::Result<()> {
        if self.history_index <= 0 {
            if self.history_index == 0 {
                self.history_index = -1;
                self.buffer = self.saved_input.clone();
                self.cursor = self.buffer.chars().count();
                self.redraw_line(stdout)?;
            }
            return Ok(());
        }

        self.history_index -= 1;
        if let Some(entry) = history.get(history.len() - 1 - self.history_index as usize) {
            self.buffer = entry.clone();
            self.cursor = self.buffer.chars().count();
            self.redraw_line(stdout)?;
        }
        Ok(())
    }

    fn handle_tab(&mut self, stdout: &mut Stdout, completer: &Completer, env: &Environment) -> io::Result<()> {
        // If already in completion mode with valid completions, cycle through them
        if self.in_completion && !self.completions.is_empty() {
            self.completion_index = (self.completion_index + 1) % self.completions.len();
            
            // Get current filename (not full path) and path prefix
            let current_filename = self.get_completion_filename();
            let path_prefix = self.get_completion_prefix();
            
            if !current_filename.is_empty() {
                // Move back and clear just the filename part
                write!(stdout, "\x1b[{}D\x1b[K", current_filename.chars().count())?;
            }
            
            // Get the completion and write it
            let completion = &self.completions[self.completion_index];
            let mut text = completion.text.clone();
            if completion.is_dir && !text.ends_with('/') && !text.ends_with('\\') {
                text.push('/');
            }
            write!(stdout, "{}", text)?;
            stdout.flush()?;
            
            // Update buffer with path prefix preserved
            let current_word = self.get_completion_word();
            let word_start = self.buffer.len() - current_word.len();
            let full_completion = format!("{}{}", path_prefix, text);
            self.buffer = format!("{}{}", &self.buffer[..word_start], full_completion);
            self.cursor = self.buffer.chars().count();
            
            return Ok(());
        }

        // Get fresh completions
        self.completions = completer.complete(&self.buffer, env);
        self.completion_index = 0;

        if self.completions.is_empty() {
            // No completions - ring bell
            write!(stdout, "\x07")?;
            stdout.flush()?;
            self.in_completion = false;
            return Ok(());
        }

        if self.completions.len() == 1 {
            // Single match: complete immediately
            self.apply_completion_inline(stdout)?;
            self.in_completion = false;
            self.completions.clear();
        } else {
            // Multiple matches
            let common = Completer::common_prefix(&self.completions);
            let current_filename = self.get_completion_filename();
            
            if common.len() > current_filename.len() {
                // Apply common prefix inline
                self.apply_common_prefix_inline(&common, stdout)?;
            }
            
            // Enter completion mode for cycling
            self.in_completion = true;
        }
        Ok(())
    }

    fn get_completion_word(&self) -> String {
        self.buffer.split_whitespace().last().unwrap_or("").to_string()
    }

    /// Get just the filename part of the completion word (after last / or \)
    fn get_completion_filename(&self) -> String {
        let word = self.get_completion_word();
        // Find last path separator
        let last_sep = word.rfind(|c| c == '/' || c == '\\').map(|i| i + 1).unwrap_or(0);
        word[last_sep..].to_string()
    }

    /// Get the directory prefix of the completion word (before the filename)
    fn get_completion_prefix(&self) -> String {
        let word = self.get_completion_word();
        // Find last path separator
        if let Some(last_sep) = word.rfind(|c| c == '/' || c == '\\') {
            word[..=last_sep].to_string()
        } else {
            String::new()
        }
    }

    /// Apply completion inline - just extend the current text without redrawing prompt
    fn apply_completion_inline(&mut self, stdout: &mut Stdout) -> io::Result<()> {
        if self.completions.is_empty() { return Ok(()); }

        let completion = &self.completions[self.completion_index];
        let current_filename = self.get_completion_filename();
        let prefix = self.get_completion_prefix();
        
        // Build full completion with prefix
        let mut new_text = completion.text.clone();
        if completion.is_dir && !new_text.ends_with('/') && !new_text.ends_with('\\') {
            new_text.push('/');
        }
        let full_completion = format!("{}{}", prefix, new_text);
        
        // Calculate what to append
        let current_word = self.get_completion_word();
        let append_text = if full_completion.len() > current_word.len() && full_completion.starts_with(&current_word) {
            full_completion[current_word.len()..].to_string()
        } else if new_text.len() > current_filename.len() && new_text.starts_with(&current_filename) {
            // Just append the difference to filename
            new_text[current_filename.len()..].to_string()
        } else {
            // Need to clear current filename and write new
            if !current_filename.is_empty() {
                write!(stdout, "\x1b[{}D\x1b[K", current_filename.chars().count())?;
            }
            new_text.clone()
        };
        
        // Update buffer
        let word_start = self.buffer.len() - current_word.len();
        self.buffer = format!("{}{}", &self.buffer[..word_start], full_completion);
        self.cursor = self.buffer.chars().count();
        
        // Print the appended/new text
        write!(stdout, "{}", append_text)?;
        stdout.flush()?;
        
        self.has_input = true;
        Ok(())
    }

    /// Apply common prefix inline - just extend the current text
    fn apply_common_prefix_inline(&mut self, prefix: &str, stdout: &mut Stdout) -> io::Result<()> {
        let current_filename = self.get_completion_filename();
        let path_prefix = self.get_completion_prefix();
        
        // Calculate what to append (comparing with filename, not full word)
        let append_text = if prefix.len() > current_filename.len() && prefix.starts_with(&current_filename) {
            prefix[current_filename.len()..].to_string()
        } else {
            return Ok(()); // Nothing to append
        };
        
        // Update buffer with path prefix + common prefix
        let current_word = self.get_completion_word();
        let word_start = self.buffer.len() - current_word.len();
        let full_completion = format!("{}{}", path_prefix, prefix);
        self.buffer = format!("{}{}", &self.buffer[..word_start], full_completion);
        self.cursor = self.buffer.chars().count();
        
        // Print the appended text
        write!(stdout, "{}", append_text)?;
        stdout.flush()?;
        
        self.has_input = true;
        Ok(())
    }

    fn clear_screen(&mut self, stdout: &mut Stdout) -> io::Result<()> {
        write!(stdout, "\x1b[2J\x1b[H")?;
        self.redraw_line(stdout)?;
        Ok(())
    }

    /// Get the last line of the prompt (for redrawing without duplicating multi-line prompts)
    fn get_prompt_last_line(&self) -> &str {
        // Find the last newline in the prompt and return everything after it
        if let Some(pos) = self.prompt.rfind('\n') {
            &self.prompt[pos + 1..]
        } else {
            &self.prompt
        }
    }
    
    /// Count how many lines the prompt spans
    fn get_prompt_line_count(&self) -> usize {
        self.prompt.matches('\n').count() + 1
    }

    fn redraw_line(&self, stdout: &mut Stdout) -> io::Result<()> {
        // For history navigation, we only need to redraw the current input line
        // The first line of the prompt (status bar) should stay unchanged
        // 
        // Strategy:
        // 1. Go to start of current line with \r
        // 2. Clear only the current line with \x1b[K (not \x1b[J which clears everything below)
        // 3. Print only the last line of prompt (e.g., "❯ ") and the buffer
        
        let prompt_last_line = self.get_prompt_last_line();
        
        // \r = go to start of line, \x1b[K = clear from cursor to end of LINE (not screen)
        write!(stdout, "\r\x1b[K{}{}", prompt_last_line, self.buffer)?;
        
        // Position cursor correctly within the buffer
        let char_count = self.buffer.chars().count();
        let cursor_offset = char_count - self.cursor;
        if cursor_offset > 0 {
            write!(stdout, "\x1b[{}D", cursor_offset)?;
        }
        stdout.flush()?;
        Ok(())
    }

    fn redraw_from_cursor(&self, stdout: &mut Stdout) -> io::Result<()> {
        let byte_pos = self.cursor_to_byte_pos();
        let after_cursor = &self.buffer[byte_pos..];
        write!(stdout, "\x1b[K{}", after_cursor)?;
        let after_chars = after_cursor.chars().count();
        if after_chars > 0 {
            write!(stdout, "\x1b[{}D", after_chars)?;
        }
        stdout.flush()?;
        Ok(())
    }
}

impl Default for LineEditor {
    fn default() -> Self {
        Self::new()
    }
}
