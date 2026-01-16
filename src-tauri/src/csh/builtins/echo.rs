//! echo - Print arguments

use crate::csh::builtins::BuiltinResult;

pub fn execute(args: &[String]) -> BuiltinResult {
    let mut newline = true;
    let mut escape = false;
    let mut start_idx = 0;

    // Parse options
    for (i, arg) in args.iter().enumerate() {
        if arg == "-n" {
            newline = false;
            start_idx = i + 1;
        } else if arg == "-e" {
            escape = true;
            start_idx = i + 1;
        } else if arg == "-E" {
            escape = false;
            start_idx = i + 1;
        } else if arg.starts_with('-') && arg.len() > 1 {
            // Combined options like -ne
            for c in arg[1..].chars() {
                match c {
                    'n' => newline = false,
                    'e' => escape = true,
                    'E' => escape = false,
                    _ => break,
                }
            }
            start_idx = i + 1;
        } else {
            break;
        }
    }

    let output_args = &args[start_idx..];
    let mut output = output_args.join(" ");

    if escape {
        output = process_escapes(&output);
    }

    if newline {
        output.push('\n');
    }

    BuiltinResult::success_with_output(output)
}

fn process_escapes(input: &str) -> String {
    let mut result = String::new();
    let mut chars = input.chars().peekable();

    while let Some(c) = chars.next() {
        if c == '\\' {
            match chars.next() {
                Some('n') => result.push('\n'),
                Some('t') => result.push('\t'),
                Some('r') => result.push('\r'),
                Some('\\') => result.push('\\'),
                Some('0') => {
                    // Octal escape
                    let mut octal = String::new();
                    for _ in 0..3 {
                        if let Some(&c) = chars.peek() {
                            if c >= '0' && c <= '7' {
                                octal.push(chars.next().unwrap());
                            } else {
                                break;
                            }
                        }
                    }
                    if let Ok(code) = u8::from_str_radix(&octal, 8) {
                        result.push(code as char);
                    }
                }
                Some('x') => {
                    // Hex escape
                    let mut hex = String::new();
                    for _ in 0..2 {
                        if let Some(&c) = chars.peek() {
                            if c.is_ascii_hexdigit() {
                                hex.push(chars.next().unwrap());
                            } else {
                                break;
                            }
                        }
                    }
                    if let Ok(code) = u8::from_str_radix(&hex, 16) {
                        result.push(code as char);
                    }
                }
                Some('a') => result.push('\x07'), // Bell
                Some('b') => result.push('\x08'), // Backspace
                Some('f') => result.push('\x0C'), // Form feed
                Some('v') => result.push('\x0B'), // Vertical tab
                Some('c') => break,               // Stop output
                Some(other) => {
                    result.push('\\');
                    result.push(other);
                }
                None => result.push('\\'),
            }
        } else {
            result.push(c);
        }
    }

    result
}
