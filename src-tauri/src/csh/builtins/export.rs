//! export - Export variables to environment

use crate::csh::builtins::BuiltinResult;
use crate::csh::environment::Environment;

pub fn execute(args: &[String], env: &mut Environment) -> BuiltinResult {
    if args.is_empty() {
        // Show all exported variables
        let mut output = String::new();
        let mut vars: Vec<_> = env.get_exports().into_iter().collect();
        vars.sort_by(|a, b| a.0.cmp(&b.0));

        for (key, value) in vars {
            output.push_str(&format!("export {}=\"{}\"\n", key, value));
        }

        return BuiltinResult::success_with_output(output);
    }

    for arg in args {
        if let Some((name, value)) = arg.split_once('=') {
            env.export(name, Some(value));
        } else {
            // Export existing variable
            env.export(arg, None);
        }
    }

    BuiltinResult::success()
}
