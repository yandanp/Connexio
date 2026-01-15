# Connexio

**Modern Windows Terminal with Session Persistence**

Connexio is a Windows terminal emulator that automatically saves and restores your sessions - tabs, working directories, and command history. Never lose your terminal setup again.

## Features (MVP)

- **Session Persistence**: Auto-save and restore tabs, directories, and history
- **Multi-Tab Support**: Work with multiple terminals simultaneously  
- **Multi-Shell Support**: PowerShell, CMD, WSL, Git Bash
- **Theme System**: 5 beautiful built-in themes with live preview
- **Windows Integration**: Explorer context menu, CLI parameters
- **Zero Configuration**: Works out of the box

## Prerequisites

Before running Connexio, ensure you have:

1. **Windows 10 (1903+) or Windows 11**

2. **Node.js 18+**
   ```
   https://nodejs.org/
   ```

3. **Rust (via rustup)**
   ```
   https://rustup.rs/
   ```

4. **Visual Studio 2022 with C++ tools**
   - Download Visual Studio Installer
   - Install "Desktop development with C++" workload
   - Include "Windows 10/11 SDK"

5. **WebView2 Runtime** (usually pre-installed on Windows 10/11)
   ```
   https://developer.microsoft.com/microsoft-edge/webview2/
   ```

## Development Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Run Development Server

**IMPORTANT**: Due to Visual Studio environment requirements, use the provided batch scripts from a **regular Windows Command Prompt** (not Git Bash, WSL, or PowerShell):

```cmd
dev.bat
```

Or to just build:

```cmd
build.bat
```

### Alternative: Visual Studio Developer Command Prompt

You can also use the Visual Studio Developer Command Prompt:

1. Open "Developer Command Prompt for VS 2022" from Start menu
2. Navigate to the project directory
3. Run:
   ```cmd
   npm run tauri:dev
   ```

## Project Structure

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

## Building for Production

From Windows Command Prompt:

```cmd
build.bat
```

The installer will be generated in `src-tauri/target/release/bundle/`.

## Tech Stack

- **Framework**: Tauri v2 (Rust + WebView2)
- **Frontend**: React 19, TypeScript, Tailwind CSS
- **Terminal**: xterm.js with WebGL acceleration
- **State**: Zustand with persistence
- **PTY**: Windows ConPTY via portable-pty

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/)
- [Tauri Extension](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode)
- [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)

## License

MIT
