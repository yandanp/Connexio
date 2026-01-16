//! pwd - Print working directory

use crate::csh::builtins::BuiltinResult;
use crate::csh::environment::Environment;

pub fn execute(env: &Environment) -> BuiltinResult {
    if let Some(cwd) = env.cwd().to_str() {
        BuiltinResult::success_with_output(format!("{}\n", cwd))
    } else {
        BuiltinResult::failure(1, "pwd: cannot get current directory\n".to_string())
    }
}
