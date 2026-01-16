//! set - Set shell variables

use crate::csh::builtins::BuiltinResult;
use crate::csh::environment::Environment;

pub fn execute(args: &[String], env: &mut Environment) -> BuiltinResult {
    if args.is_empty() {
        // Show all variables
        let mut output = String::new();
        let mut vars: Vec<_> = env.get_all().into_iter().collect();
        vars.sort_by(|a, b| a.0.cmp(&b.0));

        for (key, value) in vars {
            output.push_str(&format!("{}={}\n", key, value));
        }

        return BuiltinResult::success_with_output(output);
    }

    // Parse VAR=value or VAR value
    for arg in args {
        if let Some((name, value)) = arg.split_once('=') {
            env.set(name, value);
        } else if args.len() >= 2 {
            // set VAR value
            let name = &args[0];
            let value = args[1..].join(" ");
            env.set(name, &value);
            return BuiltinResult::success();
        }
    }

    BuiltinResult::success()
}
