//! cat - Concatenate and display file contents

use crate::csh::builtins::BuiltinResult;
use crate::csh::environment::Environment;
use std::fs;
use std::path::PathBuf;

pub fn execute(args: &[String], env: &Environment) -> BuiltinResult {
    if args.is_empty() {
        return BuiltinResult::failure(1, "cat: missing file operand\n".to_string());
    }

    let mut show_line_numbers = false;
    let mut show_ends = false;
    let mut files: Vec<PathBuf> = Vec::new();

    // Parse arguments
    for arg in args {
        if arg.starts_with('-') && arg.len() > 1 {
            for c in arg[1..].chars() {
                match c {
                    'n' => show_line_numbers = true,
                    'E' => show_ends = true,
                    'e' => {
                        show_ends = true;
                    }
                    _ => {}
                }
            }
        } else {
            let path = if arg.starts_with("~/") {
                if let Some(home) = env.get_value("HOME") {
                    PathBuf::from(home).join(&arg[2..])
                } else {
                    PathBuf::from(arg)
                }
            } else {
                PathBuf::from(arg)
            };

            let path = if path.is_absolute() {
                path
            } else {
                env.cwd().join(path)
            };

            files.push(path);
        }
    }

    if files.is_empty() {
        return BuiltinResult::failure(1, "cat: missing file operand\n".to_string());
    }

    let mut output = String::new();
    let mut line_number = 1;

    for file_path in &files {
        match fs::read_to_string(file_path) {
            Ok(contents) => {
                for line in contents.lines() {
                    if show_line_numbers {
                        output.push_str(&format!("{:6}  ", line_number));
                        line_number += 1;
                    }

                    output.push_str(line);

                    if show_ends {
                        output.push('$');
                    }

                    output.push('\n');
                }
            }
            Err(e) => {
                return BuiltinResult::failure(
                    1,
                    format!("cat: {}: {}\n", file_path.display(), e),
                );
            }
        }
    }

    BuiltinResult::success_with_output(output)
}
