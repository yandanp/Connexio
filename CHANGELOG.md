# Changelog

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
