# Changelog

All notable changes to Connexio will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.4.0] - 2025-01-17

### Added

- **Expandable Workspace Sidebar** - Hover to expand sidebar from 56px to 200px, showing full workspace names
  - Pin button to keep sidebar expanded permanently
  - Full workspace names visible when expanded (no more guessing from initials!)
  - Tab count displayed inline when expanded
  - Active workspace indicator
  - Smooth 200ms transition animation
- **Delete Confirmation Dialog** - Prevents accidental workspace deletion
  - Shows warning about tabs that will be closed
  - Lists consequences before confirming
- **Shared Workspace Utilities** - New `src/lib/workspace-utils.ts` with reusable functions
  - `getWorkspaceInitials()` - Extract initials from workspace name
  - `getWorkspaceColor()` - Get or generate workspace color
  - `validateWorkspaceName()` - Input validation
  - `formatWorkspaceDate()` - Date formatting

### Fixed

- **Terminal scroll rendering artifacts** - Disabled WebGL renderer to fix characters "sticking" during scroll
  - Affects long output sessions (e.g., OpenCode with large context)
  - Canvas renderer provides stable rendering without visual glitches
  - Bundle size reduced by ~110KB as bonus
- **Memory leak in terminal output buffer** - Added `MAX_EARLY_OUTPUT_BUFFER_SIZE` limit

### Changed

- **Workspace name input validation** - Maximum 50 characters enforced
- **Code quality improvements in TerminalViewport**
  - Replaced `(term as any)` with type-safe WeakMap pattern
  - Extracted magic numbers to named constants with documentation
  - Simplified cleanup logic with `clearTerminalExtras()` function
- **Sidebar width** - Increased collapsed width from 48px to 56px for better touch targets

---

## [0.3.1] - 2025-01-17

### Fixed

- **Ctrl+C now properly stops running processes** - Double Ctrl+C (within 500ms) kills child processes without restarting the shell
- **CSH process termination** - Fixed Ctrl+C and Ctrl+Shift+K for CSH shell by implementing recursive descendant process killing
- **Terminal no longer restarts after stopping a process** - Shell stays alive, only child processes are terminated
- **Title bar no longer shows [exited]** - Fixed hasExited flag reset after shell respawn
- **Auto-respawn shell** - When a process exits or is killed, the shell automatically respawns in the same tab
- **Mouse scroll not working** - Fixed terminal viewport scroll by adding proper CSS overflow handling
- **Prompt duplicating on history navigation** - Fixed `redraw_line()` in CSH to only redraw the last line of multi-line prompts
- **npm/bun/artisan/composer not working in CSH** - Fixed external command execution by running ALL commands through `cmd.exe /c` on Windows

### Added

- `kill_child_processes` command - Kills all descendant processes (children, grandchildren, etc.) without killing the parent shell
- Recursive process tree traversal using Windows ToolHelp32 API for finding all descendant processes
- Windows API features: `Win32_System_Threading`, `Win32_System_Diagnostics_ToolHelp`

### Changed

- Ctrl+Shift+K now kills child processes instead of the entire PTY session
- Double Ctrl+C behavior improved to only kill running commands, not the shell itself
- Single Ctrl+C sends ETX (0x03) to PTY for graceful interrupt
- Improved release script with flexible version handling and `--build-only` flag

---

## [0.3.0] - 2025-01-16

### Added

- **CSH (Connexio Shell)** - A custom shell built in Rust, integrated into Connexio
  - Full-featured shell with REPL (Read-Eval-Print Loop)
  - Built-in commands: `cd`, `pwd`, `ls`, `cat`, `echo`, `clear`, `exit`, `env`, `set`, `unset`, `export`, `alias`, `unalias`, `history`, `which`, `help`
  - External command execution (spawn any system program)
  - Pipe support (`cmd1 | cmd2 | cmd3`)
  - I/O redirection (`>`, `>>`, `<`, `2>`, `&>`)
  - Logical operators (`&&`, `||`, `;`)
  - Background execution (`&`)
  - Environment variable expansion (`$VAR`, `${VAR}`, `$?`, `$$`)
  - Command aliases
  - Persistent command history
  - Tab completion for commands and files
  - Colorful prompt with username@hostname, path, and exit status indicator
  - Colored `ls` output (directories in blue, executables in green)
  - Script execution support (`.csh` files)
- CSH available as new shell option in tab dropdown (cyan colored icon)

### Changed

- Updated shell type definitions to include `csh`
- Added CSH to all shell selector dropdowns and settings

---

## [0.2.3] - 2024-01-16

### Added

- Auto-updater with update notification dialog
- Release management scripts
- Portable build option

### Fixed

- Session persistence validation on startup
- Tab close behavior improvements

---

## [0.2.2] - 2024-01-15

### Added

- Workspace management with multiple workspaces support
- Workspace sidebar for quick switching
- Workspace colors and customization

### Changed

- Improved tab bar styling
- Better dark/light theme support

---

## [0.2.1] - 2024-01-14

### Added

- Theme picker with 10+ built-in themes
- Custom theme support
- Settings dialog with tabbed sections

### Fixed

- Terminal resize handling
- Font rendering improvements

---

## [0.2.0] - 2024-01-14

### Added

- Multi-tab terminal support
- Drag and drop tab reordering
- Tab rename functionality
- Session persistence (tabs restored on restart)
- Multiple shell support (PowerShell, CMD, WSL, Git Bash)

### Changed

- Complete UI overhaul with modern design
- Improved title bar with traffic light buttons

---

## [0.1.0] - 2024-01-13

### Added

- Initial release
- Basic terminal emulator with xterm.js
- PTY support via Tauri
- PowerShell integration
- Basic theming support

---

[0.3.1]: https://github.com/yandanp/connexio/compare/v0.3.0...v0.3.1
[0.3.0]: https://github.com/yandanp/connexio/compare/v0.2.3...v0.3.0
[0.2.3]: https://github.com/yandanp/connexio/compare/v0.2.2...v0.2.3
[0.2.2]: https://github.com/yandanp/connexio/compare/v0.2.1...v0.2.2
[0.2.1]: https://github.com/yandanp/connexio/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/yandanp/connexio/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/yandanp/connexio/releases/tag/v0.1.0
