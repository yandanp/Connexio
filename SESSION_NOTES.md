# Connexio Development Session Notes

## Session: January 17, 2025

### Summary
Bug fixes session culminating in v0.3.1 release.

---

## Bugs Fixed

### 1. npm/bun/artisan/composer not working in CSH
- **Problem**: External commands like npm, bun, artisan, composer weren't executing properly in CSH shell
- **Root Cause**: Commands weren't being run through Windows command processor
- **File**: `src-tauri/src/csh/executor.rs`
- **Fix**: Run ALL external commands through `cmd.exe /c` on Windows

### 2. Mouse scroll not working + Prompt duplicating on history navigation
- **Problem**: Couldn't scroll in terminal, and prompts duplicated when using up/down arrow keys for history
- **Files**: 
  - `src/styles/globals.css` - Added CSS for scroll
  - `src-tauri/src/csh/readline.rs` - Fixed `redraw_line()` to only redraw last line of prompt
- **Fix**: CSS overflow handling + improved prompt redraw logic for multi-line prompts

### 3. Ctrl+C not stopping processes properly
- **Problem**: Single Ctrl+C didn't stop processes, double Ctrl+C killed entire shell and restarted terminal
- **Root Cause**: No mechanism to kill child processes without killing parent shell
- **Files Modified**:
  - `src-tauri/src/pty/manager.rs` - Added `kill_child_processes()` with recursive descendant process killing using Windows ToolHelp32 API
  - `src-tauri/src/commands/pty_commands.rs` - Added `kill_child_processes` command
  - `src-tauri/src/lib.rs` - Registered new command
  - `src-tauri/Cargo.toml` - Added Windows features: `Win32_System_Threading`, `Win32_System_Diagnostics_ToolHelp`
  - `src/lib/tauri.ts` - Added `killChildProcesses()` function
  - `src/components/terminal/TerminalViewport.tsx` - Updated Ctrl+C handler
  - `src/App.tsx` - Reset `hasExited` flag on shell respawn
- **Fix**: Implemented recursive process tree killing using Windows ToolHelp32 API

---

## Current Behavior (After Fixes)

| Shortcut | Behavior |
|----------|----------|
| Single Ctrl+C | Sends `\x03` (ETX) to PTY for graceful interrupt |
| Double Ctrl+C (within 500ms) | Kills all child processes, shell stays alive |
| Ctrl+Shift+K | Immediately kills child processes |
| Process Exit | Shell auto-respawns in same tab |

---

## Release v0.3.1

### Completed Steps
1. ✅ Updated version in `package.json`, `Cargo.toml`, `tauri.conf.json` to `0.3.1`
2. ✅ Updated `CHANGELOG.md` with all fixes
3. ✅ Committed and pushed to GitHub
4. ✅ Created git tag `v0.3.1`
5. ✅ Improved `scripts/release.cjs` with flexible version handling
6. ✅ Fixed `scripts/build-installer.ps1` Unicode encoding issues
7. ✅ Built with signing key (from `.tauri-key` file)
8. ✅ Created GitHub release with all artifacts
9. ✅ Uploaded `latest.json` for auto-updater

### Release Assets
- `Connexio_0.3.1_x64-setup.exe` (NSIS installer)
- `Connexio_0.3.1_x64_en-US.msi` (MSI installer)
- Signature files (`.sig`) for both installers
- `latest.json` for auto-updater

### Release URL
https://github.com/yandanp/Connexio/releases/tag/v0.3.1

---

## Key Files Modified

| File | Changes |
|------|---------|
| `src-tauri/src/pty/manager.rs` | Added `kill_child_processes()` with recursive process tree killing |
| `src-tauri/src/commands/pty_commands.rs` | Added `kill_child_processes` Tauri command |
| `src-tauri/src/lib.rs` | Registered `kill_child_processes` command |
| `src-tauri/Cargo.toml` | Added Windows API features for process management |
| `src/components/terminal/TerminalViewport.tsx` | Fixed Ctrl+C/Ctrl+Shift+K to use `killChildProcesses`, auto-respawn shell |
| `src/App.tsx` | Reset `hasExited` flag in `handleTerminalReady` |
| `src/lib/tauri.ts` | Added `killChildProcesses()` function |
| `src/styles/globals.css` | Added xterm scroll fix |
| `src-tauri/src/csh/executor.rs` | Run external commands through `cmd.exe /c` |
| `src-tauri/src/csh/readline.rs` | Fixed prompt redraw for history navigation |
| `scripts/release.cjs` | Improved with flexible version handling |
| `scripts/build-installer.ps1` | Fixed Unicode encoding issues |
| `CHANGELOG.md` | Added v0.3.1 release notes |

---

## Notes

### Signing Key Location
- Private key: `.tauri-key` (in project root, gitignored)
- Public key: Configured in `src-tauri/tauri.conf.json` under `plugins.updater.pubkey`
- Password: Required when building with signing

### Build Commands
```bash
# Set environment variables and build
export TAURI_SIGNING_PRIVATE_KEY="$(cat .tauri-key)"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD="your-password"
npm run tauri build

# Or use the release script
npm run release
```

### Auto-Update Endpoint
```
https://github.com/yandanp/Connexio/releases/latest/download/latest.json
```
