//! help - Display help information

use crate::csh::builtins::BuiltinResult;

pub fn execute(args: &[String]) -> BuiltinResult {
    if args.is_empty() {
        let help = r#"
CSH - Connexio Shell v0.1.0

A modern shell for the Connexio terminal.

BUILT-IN COMMANDS:
  cd [dir]          Change directory (~ for home, - for previous)
  pwd               Print working directory
  ls [-la]          List directory contents
  cat <file>        Display file contents
  echo [text]       Print text to output
  clear / cls       Clear the screen

  env               Display all environment variables
  set VAR=value     Set a shell variable
  export VAR=value  Export variable to environment
  unset VAR         Remove a variable

  alias name=cmd    Create an alias
  unalias name      Remove an alias
  history [n]       Show command history

  which cmd         Locate a command
  help [cmd]        Show this help

  exit [code]       Exit the shell

OPERATORS:
  cmd1 | cmd2       Pipe output of cmd1 to cmd2
  cmd1 && cmd2      Run cmd2 only if cmd1 succeeds
  cmd1 || cmd2      Run cmd2 only if cmd1 fails
  cmd1 ; cmd2       Run both commands sequentially
  cmd &             Run command in background

REDIRECTIONS:
  cmd > file        Redirect stdout to file (overwrite)
  cmd >> file       Redirect stdout to file (append)
  cmd < file        Read stdin from file
  cmd 2> file       Redirect stderr to file
  cmd &> file       Redirect stdout and stderr to file

VARIABLES:
  $VAR              Expand variable VAR
  ${VAR}            Expand variable (explicit form)
  $?                Last command's exit code
  $$                Shell's process ID

SPECIAL KEYS:
  Up/Down           Navigate command history
  Tab               Command/file completion
  Ctrl+C            Cancel current command
  Ctrl+L            Clear screen

For more info: https://github.com/yandanp/connexio
"#;
        return BuiltinResult::success_with_output(help.to_string());
    }

    // Help for specific command
    let cmd = &args[0];
    let help = match cmd.as_str() {
        "cd" => "cd [directory]\n  Change the current directory.\n  cd        - Go to home directory\n  cd -      - Go to previous directory\n  cd ~/path - Go to path relative to home\n",
        "ls" => "ls [options] [path...]\n  List directory contents.\n  -a  Show hidden files\n  -l  Long format with details\n  -s  Show file sizes\n",
        "cat" => "cat [options] <file...>\n  Display file contents.\n  -n  Show line numbers\n  -E  Show $ at end of lines\n",
        "echo" => "echo [options] [text...]\n  Print text to output.\n  -n  Don't add newline at end\n  -e  Enable escape sequences (\\n, \\t, etc.)\n",
        "alias" => "alias [name=value]\n  Create or display aliases.\n  alias           - Show all aliases\n  alias ll='ls -l' - Create alias\n",
        "export" => "export [VAR=value]\n  Export variables to environment.\n  export          - Show exported variables\n  export VAR=val  - Set and export variable\n",
        "history" => "history [n]\n  Display command history.\n  history     - Show all history\n  history 10  - Show last 10 commands\n  history -c  - Clear history\n",
        _ => return BuiltinResult::failure(1, format!("help: no help for '{}'\n", cmd)),
    };

    BuiltinResult::success_with_output(help.to_string())
}
