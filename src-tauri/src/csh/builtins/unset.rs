//! unset - Remove shell variables

use crate::csh::builtins::BuiltinResult;
use crate::csh::environment::Environment;

pub fn execute(args: &[String], env: &mut Environment) -> BuiltinResult {
    if args.is_empty() {
        return BuiltinResult::failure(1, "unset: not enough arguments\n".to_string());
    }

    for arg in args {
        env.unset(arg);
    }

    BuiltinResult::success()
}
