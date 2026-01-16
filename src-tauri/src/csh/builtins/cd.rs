//! cd - Change directory command

use crate::csh::builtins::BuiltinResult;
use crate::csh::environment::Environment;
use std::path::PathBuf;

pub fn execute(args: &[String], env: &mut Environment) -> BuiltinResult {
    let target = if args.is_empty() {
        // No args - go to home directory
        if let Some(home) = env.get_value("HOME") {
            PathBuf::from(home)
        } else {
            return BuiltinResult::failure(1, "cd: HOME not set\n".to_string());
        }
    } else if args[0] == "-" {
        // cd - : go to previous directory
        if let Some(oldpwd) = env.get_value("OLDPWD") {
            PathBuf::from(oldpwd)
        } else {
            return BuiltinResult::failure(1, "cd: OLDPWD not set\n".to_string());
        }
    } else if args[0] == "~" || args[0].starts_with("~/") {
        // Handle tilde expansion
        if let Some(home) = env.get_value("HOME") {
            if args[0] == "~" {
                PathBuf::from(home)
            } else {
                PathBuf::from(home).join(&args[0][2..])
            }
        } else {
            return BuiltinResult::failure(1, "cd: HOME not set\n".to_string());
        }
    } else {
        // Regular path
        let path = PathBuf::from(&args[0]);
        if path.is_absolute() {
            path
        } else {
            env.cwd().join(&args[0])
        }
    };

    // Canonicalize the path
    let target = match target.canonicalize() {
        Ok(p) => normalize_path(p),
        Err(e) => {
            return BuiltinResult::failure(
                1,
                format!("cd: {}: {}\n", args.get(0).unwrap_or(&"~".to_string()), e),
            );
        }
    };

    // Check if it's a directory
    if !target.is_dir() {
        return BuiltinResult::failure(
            1,
            format!(
                "cd: {}: Not a directory\n",
                args.get(0).unwrap_or(&"~".to_string())
            ),
        );
    }

    // Save old directory
    let old_cwd = env.cwd().to_str().map(|s| s.to_string());
    if let Some(cwd_str) = old_cwd {
        env.export("OLDPWD", Some(&cwd_str));
    }

    // Change directory
    if let Err(e) = env.set_cwd(target) {
        return BuiltinResult::failure(1, format!("cd: {}\n", e));
    }

    BuiltinResult::success()
}

/// Normalize path by removing Windows extended path prefix (\\?\)
fn normalize_path(path: PathBuf) -> PathBuf {
    let path_str = path.to_string_lossy();
    
    // Remove \\?\ prefix on Windows
    if path_str.starts_with(r"\\?\") {
        PathBuf::from(&path_str[4..])
    } else {
        path
    }
}
