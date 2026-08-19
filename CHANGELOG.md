# Changelog

## [0.6.0] — 2026-08-16

### ✨ New Features

- **Memory usage in footer** — Live RSS memory gauge in the footer bar, color-coded by footprint (green <150MB, yellow <300MB, red >300MB). Polled every 5s via `sysinfo`.
- **Worktree management** — Create, list, preview-diff, and delete git worktrees from the sidebar. Auto-opens a terminal in the new worktree. Orca-style branch preservation when unmerged commits exist.

### 🐛 Bug Fixes

- **Fix worktree delete on Windows** — Three layers of robustness: (1) PTY child process is now explicitly killed on terminal close, releasing the directory lock that orphaned shells held; (2) `git worktree remove` retries with exponential backoff for transient locks; (3) stale worktree registrations (leftover from partial deletes) are pruned and cleaned up manually.
- **Best-effort worktree delete** — A locked directory no longer blocks branch cleanup. The leftover folder is reported via `leftoverDir` so the UI shows a clear message instead of failing the whole operation.
- **Confirm dialog closes immediately** — Delete confirmation modal now dismisses instantly on click, preventing double-confirm via Enter key.
- **Prevent orphaned shell processes** — Closing a terminal tab previously leaked the child shell process on Windows. The `Child` handle is now stored and killed explicitly on close.

### 🔧 Infrastructure

- Added `sysinfo` crate (system feature only) for process memory monitoring

## [0.4.2] — 2026-06-01

First stable release on Tauri v2. Includes all features and fixes from the `0.4.x-dev` pre-release cycle.

### ✨ New Features

- **Native SSH & SFTP Manager** — Save SSH connections per project + global, one-click connect with key or password auth, integrated SFTP file browser
- **Discord Rich Presence** — Show current project and activity in Discord status
- **Adjustable UI font size** — Scale the entire app UI independently from terminal font
- **AI panel improvements** — Better chat experience with configurable model integration
- **File Explorer git status indicators** — See modified/staged/untracked files at a glance
- **Auto-Updater** — Check for updates via GitHub Releases, download & install with one click
- **New app icon** — Updated Connexio icon design with proper multi-resolution support

### 🐛 Bug Fixes

- **Fix terminal scroll-to-top on resize** — Terminal no longer jumps to top when the right sidebar is opened/closed or when Pi/CLI tools are actively outputting. Scroll preservation uses a tight threshold and lets xterm.js handle position internally.
- **Fix terminal paste and scroll glitches** — Resolved double-paste on WebView2 and scroll jank during rapid output
- **Fix SSH/SFTP editor hang on close** — SFTP state now persists correctly, editor no longer freezes when closing SSH tabs
- **Fix Windows Terminal opening separately** — PTY no longer spawns a visible console window alongside the app
- **Sidebar navigation polish** — Visual consistency and smoother interactions
- **Web preview stability** — Enhanced browser preview panel experience
- **Remove unreliable command timer** — Removed flaky timer that reported incorrect durations

### 🔧 Infrastructure

- Release workflow rewritten for multi-platform builds (Windows x64, macOS ARM, Linux x64)
- Auto-updater validated and working across all platforms
- Signing key regenerated with proper empty password handling
- Contributing guide and issue/PR templates added

---

## [0.4.0-dev.1] — 2026-05-19 (Pre-release)

> ⚠️ **Dev build** — Tauri v2 migration. Not recommended for general use yet.
> Version in binaries shows `0.4.0` (Windows/NSIS requires numeric-only versions).

### 🚀 Major: Electron → Tauri v2 Migration

Complete rewrite of the desktop backend from Electron to Tauri v2 with native Rust PTY backend for significantly better performance and smaller bundle size.

### ✨ New Features

- **Tauri v2 backend** — Native Rust PTY process management (portable-pty)
- **WebGL terminal renderer** — Hardware-accelerated rendering with on/off toggle in settings
- **Code Editor** — Built-in editor with CodeMirror 6 (JS, TS, HTML, CSS, Python, Rust, JSON, Markdown)
- **Web Preview panel** — Live preview as tab
- **File Explorer** — Full file tree with context menu and inline actions
- **AI Chat side panel** — With custom model input in settings
- **Split terminal** — Editor + terminal side-by-side layout
- **Split panes** — react-resizable-panels integration for all tab types
- **Shell integration** — OSC 7 CWD tracking with PowerShell UTF-8 support
- **Notification system** — Full notification system with AI agent hooks
- **Git module** — Complete git integration + updater stub
- **Theme, session, pinned, SSH modules** — Extended capabilities system

### 🐛 Bug Fixes

- Clipboard paste: full Rust backend takeover (no double paste on WebView2)
- Image paste detection prioritized over text for TUI agents
- PowerShell: use `-Command` instead of `-File` for UTF-8 init
- Shell integration: use `$PROFILE` instead of MyDocuments path
- Editor: save works via global keydown + button (fixed StrictMode ref issue)
- Editor tabs stay mounted across tab switches (preserve dirty state)
- Nerd Font prioritized in terminal font stack for Powerline glyphs
- Terminal data buffered before listeners mount (prevent duplicate spawns)
- PTY process inherits parent environment variables
- Window-state plugin crash on startup fixed
- File Explorer rewritten with working context menu

### 🔧 Infrastructure

- CI/CD workflow updated for Tauri builds (multi-platform: Win/macOS ARM/macOS Intel/Linux)
- Pre-release channel support via tag pattern (`v*-dev.*`, `v*-alpha.*`, `v*-beta.*`)
- Rust release profile optimized (LTO, strip symbols, panic=abort)

---

## [0.3.0] — Previous Electron Release

Last stable Electron-based release. See [v0.3.0 release](https://github.com/yandanp/Connexio/releases/tag/v0.3.0).
