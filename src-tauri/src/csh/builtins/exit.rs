//! exit - Exit the shell

use crate::csh::builtins::BuiltinResult;

pub fn execute(args: &[String]) -> BuiltinResult {
    let code = if args.is_empty() {
        0
    } else {
        args[0].parse::<i32>().unwrap_or(0)
    };

    BuiltinResult::exit(code)
}
