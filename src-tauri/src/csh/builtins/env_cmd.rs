//! env - Display environment variables

use crate::csh::builtins::BuiltinResult;
use crate::csh::environment::Environment;

pub fn execute(env: &Environment) -> BuiltinResult {
    let mut output = String::new();

    let mut vars: Vec<_> = env.get_all().into_iter().collect();
    vars.sort_by(|a, b| a.0.cmp(&b.0));

    for (key, value) in vars {
        output.push_str(&format!("{}={}\n", key, value));
    }

    BuiltinResult::success_with_output(output)
}
