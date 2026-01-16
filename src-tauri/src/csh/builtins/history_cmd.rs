//! history - Display command history

use crate::csh::builtins::BuiltinResult;
use crate::csh::history::History;

pub fn execute(args: &[String], history: &mut History) -> BuiltinResult {
    // Parse count argument
    let count = if args.is_empty() {
        history.len()
    } else if args[0] == "-c" {
        // Clear history
        history.clear();
        return BuiltinResult::success();
    } else {
        args[0].parse::<usize>().unwrap_or(history.len())
    };

    let mut output = String::new();
    let entries = history.last_n(count);
    let start_idx = history.len().saturating_sub(count);

    for (i, entry) in entries.iter().enumerate() {
        output.push_str(&format!("{:5}  {}\n", start_idx + i + 1, entry));
    }

    BuiltinResult::success_with_output(output)
}
