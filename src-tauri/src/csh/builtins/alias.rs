//! alias - Manage command aliases

use crate::csh::builtins::BuiltinResult;
use crate::csh::environment::Environment;

/// alias command - define or display aliases
pub fn execute_alias(args: &[String], env: &mut Environment) -> BuiltinResult {
    if args.is_empty() {
        // Show all aliases
        let mut output = String::new();
        let aliases = env.get_aliases();

        if aliases.is_empty() {
            return BuiltinResult::success();
        }

        let mut sorted: Vec<_> = aliases.iter().collect();
        sorted.sort_by(|a, b| a.0.cmp(b.0));

        for (name, value) in sorted {
            output.push_str(&format!("alias {}='{}'\n", name, value));
        }

        return BuiltinResult::success_with_output(output);
    }

    for arg in args {
        if let Some((name, value)) = arg.split_once('=') {
            // Remove surrounding quotes if present
            let value = value.trim_matches(|c| c == '\'' || c == '"');
            env.set_alias(name, value);
        } else {
            // Show specific alias
            if let Some(value) = env.get_alias(arg) {
                return BuiltinResult::success_with_output(format!(
                    "alias {}='{}'\n",
                    arg, value
                ));
            } else {
                return BuiltinResult::failure(
                    1,
                    format!("alias: {}: not found\n", arg),
                );
            }
        }
    }

    BuiltinResult::success()
}

/// unalias command - remove aliases
pub fn execute_unalias(args: &[String], env: &mut Environment) -> BuiltinResult {
    if args.is_empty() {
        return BuiltinResult::failure(1, "unalias: not enough arguments\n".to_string());
    }

    for arg in args {
        if arg == "-a" {
            // Remove all aliases
            let aliases: Vec<_> = env.get_aliases().keys().cloned().collect();
            for name in aliases {
                env.unalias(&name);
            }
        } else {
            env.unalias(arg);
        }
    }

    BuiltinResult::success()
}
