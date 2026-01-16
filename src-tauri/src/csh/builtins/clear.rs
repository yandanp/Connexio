//! clear - Clear the terminal screen

use crate::csh::builtins::BuiltinResult;

pub fn execute() -> BuiltinResult {
    // ANSI escape sequence to clear screen and move cursor to home
    BuiltinResult::success_with_output("\x1b[2J\x1b[H".to_string())
}
