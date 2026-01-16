//! which - Locate a command

use crate::csh::builtins::BuiltinResult;
use crate::csh::environment::Environment;
use std::path::PathBuf;

pub fn execute(args: &[String], env: &Environment) -> BuiltinResult {
    if args.is_empty() {
        return BuiltinResult::failure(1, "which: missing argument\n".to_string());
    }

    let mut output = String::new();
    let path_var = env.get_value("PATH").unwrap_or_default();
    let paths: Vec<&str> = path_var.split(';').collect(); // Windows uses ;

    // Built-in commands
    let builtins = vec![
        "cd", "pwd", "echo", "exit", "clear", "cls", "ls", "dir", "cat", "type",
        "env", "set", "unset", "export", "alias", "unalias", "history",
        "which", "where", "help", "true", "false",
    ];

    for cmd in args {
        // Check if it's a builtin
        if builtins.contains(&cmd.as_str()) {
            output.push_str(&format!("{}: shell built-in command\n", cmd));
            continue;
        }

        // Check if it's an alias
        if let Some(alias_val) = env.get_alias(cmd) {
            output.push_str(&format!("{}: aliased to '{}'\n", cmd, alias_val));
            continue;
        }

        // Search in PATH
        let mut found = false;
        for path_dir in &paths {
            let dir = PathBuf::from(path_dir);

            // Try with common extensions on Windows
            let extensions = ["", ".exe", ".bat", ".cmd", ".ps1", ".com"];

            for ext in &extensions {
                let full_path = dir.join(format!("{}{}", cmd, ext));
                if full_path.exists() && full_path.is_file() {
                    output.push_str(&format!("{}\n", full_path.display()));
                    found = true;
                    break;
                }
            }

            if found {
                break;
            }
        }

        if !found {
            output.push_str(&format!("{} not found\n", cmd));
        }
    }

    BuiltinResult::success_with_output(output)
}
