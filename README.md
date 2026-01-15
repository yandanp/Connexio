# Connexio

[![GitHub release](https://img.shields.io/github/v/release/yandanp/Connexio)](https://github.com/yandanp/Connexio/releases/latest)
[![GitHub downloads](https://img.shields.io/github/downloads/yandanp/Connexio/total)](https://github.com/yandanp/Connexio/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Modern Windows Terminal with Session Persistence**

Connexio is a Windows terminal emulator that automatically saves and restores your sessions - tabs, working directories, and command history. Never lose your terminal setup again.

## 📦 Download

Get the latest release from [GitHub Releases](https://github.com/yandanp/Connexio/releases/latest):

| Package                             | Description                                                          |
| ----------------------------------- | -------------------------------------------------------------------- |
| `Connexio_x.x.x_x64-setup.exe`      | **NSIS Installer** (Recommended) - Includes context menu integration |
| `Connexio_x.x.x_x64_en-US.msi`      | **MSI Installer** - For enterprise/GPO deployment                    |
| `Connexio-x.x.x-portable-win64.zip` | **Portable** - No installation required                              |

## ✨ Features

- **Session Persistence**: Auto-save and restore tabs, directories, and history
- **Multi-Tab Support**: Work with multiple terminals simultaneously
- **Multi-Shell Support**: PowerShell, CMD, WSL, Git Bash
- **Theme System**: Beautiful built-in themes (One Dark, Dracula, Nord, Solarized, etc.)
- **Windows Integration**: Explorer context menu, CLI parameters
- **Auto-Update**: Automatic update notifications with one-click install
- **Zero Configuration**: Works out of the box

## 🖼️ Screenshots

_Coming soon_

## 🔧 System Requirements

- Windows 10 (1903+) or Windows 11
- ~50MB disk space
- WebView2 Runtime (pre-installed on Windows 10/11)

## 🛠️ Development

### Prerequisites

1. **Node.js 18+** - https://nodejs.org/
2. **Rust (via rustup)** - https://rustup.rs/
3. **Visual Studio 2022** with "Desktop development with C++" workload
4. **WebView2 Runtime** - https://developer.microsoft.com/microsoft-edge/webview2/

### Setup

```bash
# Install dependencies
npm install

# Run development server (use Windows Command Prompt)
dev.bat

# Build for production
build.bat
```

### Project Structure

```
connexio/
├── src/                    # React frontend
│   ├── components/         # UI components
│   ├── hooks/              # Custom React hooks
│   ├── stores/             # Zustand stores
│   ├── lib/                # Utilities & Tauri wrappers
│   └── types/              # TypeScript types
├── src-tauri/              # Rust backend
│   ├── src/
│   │   ├── commands/       # Tauri commands
│   │   └── pty/            # PTY/ConPTY handling
│   └── Cargo.toml
├── dev.bat                 # Development script
├── build.bat               # Build script
└── package.json
```

## 🏗️ Tech Stack

- **Framework**: Tauri v2 (Rust + WebView2)
- **Frontend**: React 19, TypeScript, Tailwind CSS
- **Terminal**: xterm.js with WebGL acceleration
- **State**: Zustand with persistence
- **PTY**: Windows ConPTY via portable-pty

## 📝 License

MIT © [yandanp](https://github.com/yandanp)

---

Made with ❤️ by [yandanp](https://github.com/yandanp)
